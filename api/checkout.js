// POST /api/checkout — crea la Checkout Session de la suscripción.
// Recibe { plan, periodo?, email?, ganerai?, prueba? } y devuelve { url }.
//
// prueba (por defecto true): abre la suscripción con los 15 días de prueba.
// prueba:false es la compra directa, para quien ya conoce el producto y no
// quiere esperar: se cobra el primer periodo al confirmar.
//
// El webhook de Stripe NO vive aquí: lo implementa la web app de Ganera, que es la
// que tiene la base de datos. Ver docs/INTEGRACION-APP.md.
const { readBody, clean, isEmail } = require('./_lib/notify');
const { siteUrl, legalUrl, checkoutEnabled, trialDays } = require('./_lib/config');
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
  const conPrueba = b.prueba !== false; // sólo un false explícito salta la prueba

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

  const base = siteUrl();      // vuelta del Checkout: puede ser localhost en pruebas
  const legal = legalUrl();    // documentos legales: siempre la URL pública
  const dias = trialDays();
  const taxRate = (process.env.STRIPE_TAX_RATE_ID || '').trim();

  const meta = { plan, periodo, prueba: String(conPrueba), source: 'ganera-web' };
  const subscription_data = { metadata: meta };
  if (conPrueba) {
    subscription_data.trial_period_days = dias;
    subscription_data.trial_settings = { end_behavior: { missing_payment_method: 'cancel' } };
  }
  if (taxRate) subscription_data.default_tax_rates = [taxRate];

  const avisoSubmit = conPrueba
    ? `Hoy no se te cobra nada. Al terminar los ${dias} días de prueba se cobrará automáticamente la suscripción salvo que la canceles antes.`
    : 'Al confirmar se cobra el primer periodo de la suscripción. Se renueva automáticamente y puedes cancelarla cuando quieras desde tu cuenta.';

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
          message: `Acepto las [Condiciones de contratación](${legal}/terminos) y el [Contrato de encargo del tratamiento](${legal}/encargo-tratamiento).`,
        },
        submit: { message: avisoSubmit },
      },
      success_url: `${base}/gracias?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/#planes`,
      metadata: meta,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    // Nunca devolvemos el detalle de Stripe al navegador; al log, todo.
    const msg = (err && err.message) || '';
    console.error('Stripe checkout error', { plan, periodo, conPrueba, type: err && err.type, code: err && err.code, message: msg });
    if (/terms of service/i.test(msg)) {
      console.error(
        'PISTA: consent_collection exige la URL de las condiciones en el panel de Stripe. ' +
        'Configuración → Público → "Terms of service URL" = ' + legal + '/terminos (también en modo prueba).'
      );
    }
    return res.status(502).json({ error: 'No se ha podido abrir el pago. Inténtalo de nuevo o escríbenos a agroganera@gmail.com.' });
  }
};
