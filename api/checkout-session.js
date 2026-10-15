// GET /api/checkout-session?session_id=… — datos mínimos para la página /gracias.
// Devuelve SOLO: estado, email de la cuenta, plan y fin de la prueba.
// Ni identificadores internos completos, ni nada relativo al medio de pago.
const { clean } = require('./_lib/notify');
const { checkoutEnabled } = require('./_lib/config');
const { stripe, nombrePlan } = require('./_lib/stripe');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'no-store');

  if (!checkoutEnabled()) {
    return res.status(503).json({ error: 'El pago con tarjeta todavía no está activo.' });
  }

  const query = req.query || Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
  const id = clean(query.session_id, 200);
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) {
    return res.status(400).json({ error: 'Falta el identificador de la sesión.' });
  }

  try {
    const session = await stripe().checkout.sessions.retrieve(id, { expand: ['customer', 'subscription'] });
    if (session.status !== 'complete') {
      return res.status(404).json({ error: 'Sesión no encontrada o sin completar.' });
    }

    const sub = session.subscription && typeof session.subscription === 'object' ? session.subscription : null;
    const meta = (sub && sub.metadata) || session.metadata || {};
    const trialEnd = sub && sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
    const email =
      session.customer_details && session.customer_details.email
        ? session.customer_details.email
        : (session.customer && typeof session.customer === 'object' && session.customer.email) || null;

    return res.status(200).json({
      status: 'complete',
      email,
      plan: meta.plan || null,
      planNombre: meta.plan ? nombrePlan(meta.plan) : null,
      periodo: meta.periodo || null,
      trialEnd,
    });
  } catch (err) {
    if (err && (err.statusCode === 404 || err.code === 'resource_missing')) {
      return res.status(404).json({ error: 'Sesión no encontrada o sin completar.' });
    }
    console.error('Stripe session error', { type: err && err.type, code: err && err.code, message: err && err.message });
    return res.status(502).json({ error: 'No se han podido recuperar los datos de la suscripción.' });
  }
};
