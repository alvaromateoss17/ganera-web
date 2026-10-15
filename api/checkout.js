// POST /api/checkout — crea la Checkout Session de la suscripción con prueba de 15 días.
// Recibe { plan, periodo?, email?, ganerai? } y devuelve { url } para redirigir.
//
// El webhook de Stripe NO vive aquí: lo implementa la web app de Ganera, que es la
// que tiene la base de datos. Ver docs/INTEGRACION-APP.md.
const { readBody, clean, isEmail } = require('./_lib/notify');
const { siteUrl, checkoutEnabled, trialDays } = require('./_lib/config');
const { stripe, priceId, complementoPriceId, PLANES, PERIODOS } = require('./_lib/stripe');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!checkoutEnabled()) {
    return res.status(503).json({
      error: 'El pago con tarjeta todavía no está activo. Solicita la prueba en /prueba-15-dias y la activamos nosotros.',
    });
  }

  const b = readBody(req);
  const plan = clean(b.plan, 20).toLowerCase();
  const periodo = (clean(b.periodo, 10).toLowerCase() || 'anual');
  const email = clean(b.email, 254);

  if (!PLANES[plan]) {
    return res.status(400).json({ error: 'Plan no válido.' });
  }
  if (!PERIODOS[periodo]) {
    return res.status(400).json({ error: 'Periodo de facturación no válido.' });
  }
  const price = priceId(plan, periodo);
  if (!price) {
    console.error(`Falta el Price ID de Stripe para plan=${plan} periodo=${periodo}`);
    return res.status(503).json({ error: 'Este plan todavía no se puede contratar online. Escríbenos y lo activamos.' });
  }

  const line_items = [{ price, quantity: 1 }];
  if (b.ganerai) {
    const extra = complementoPriceId('ganerai');
    if (extra) line_items.push({ price: extra, quantity: 1 });
    else console.error('Falta STRIPE_PRICE_GANERAI; se continúa sin el complemento.');
  }

  const base = siteUrl();
  const dias = trialDays();
  const taxRate = (process.env.STRIPE_TAX_RATE_ID || '').trim();

  const subscription_data = {
    trial_period_days: dias,
    trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
    metadata: { plan, periodo, source: 'ganera-web' },
  };
  if (taxRate) subscription_data.default_tax_rates = [taxRate];

  try {
    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      line_items,
      subscription_data,
      payment_method_collection: 'always',
      tax_id_collection: { enabled: true },
      billing_address_collection: 'required',
      ...(isEmail(email) ? { customer_email: email } : {}),
      locale: 'es',
      allow_promotion_codes: true,
      consent_collection: { terms_of_service: 'required' },
      custom_text: {
        terms_of_service_acceptance: {
          message: `Acepto las [Condiciones de contratación](${base}/terminos) y el [Contrato de encargo del tratamiento](${base}/encargo-tratamiento).`,
        },
        submit: {
          message: `Hoy no se te cobra nada. Al terminar los ${dias} días de prueba se cobrará automáticamente la suscripción salvo que la canceles antes.`,
        },
      },
      success_url: `${base}/gracias?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/#planes`,
      metadata: { plan, periodo, source: 'ganera-web' },
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    // Nunca devolvemos el detalle de Stripe al navegador.
    console.error('Stripe checkout error', { plan, periodo, type: err && err.type, code: err && err.code, message: err && err.message });
    return res.status(502).json({ error: 'No se ha podido abrir el pago. Inténtalo de nuevo o escríbenos a agroganera@gmail.com.' });
  }
};
