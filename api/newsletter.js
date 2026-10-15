// POST /api/newsletter — footer subscription form.
const { notify, isEmail, clean, readBody } = require('./_lib/notify');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const b = readBody(req);
  const email = clean(b.email, 254);
  if (!isEmail(email)) return res.status(400).json({ error: 'Email no válido' });
  // Sin consentimiento expreso no hay suscripción: es la base jurídica (art. 6.1.a RGPD).
  if (b.consent !== true && b.consent !== 'si' && b.consent !== 'on') {
    return res.status(400).json({ error: 'Falta el consentimiento para recibir el boletín' });
  }
  try {
    await notify('Nueva suscripción a la newsletter de Ganera', {
      email,
      consent: 'sí, casilla marcada por el usuario',
      received: new Date().toISOString(),
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: 'No se ha podido registrar la suscripción' });
  }
};
