// POST /api/newsletter — suscripción del pie de página.
const { notify, isEmail, readBody } = require('./_lib/notify');
const { proteger, linea } = require('./_lib/guard');

module.exports = async (req, res) => {
  if (!proteger(req, res, { nombre: 'newsletter', max: 5, ventanaMs: 10 * 60_000 })) return;
  const b = readBody(req);
  const email = linea(b.email, 254);
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
