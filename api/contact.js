// POST /api/contact — formulario general de /contacto.
const { notify, isEmail, clean, readBody } = require('./_lib/notify');
const { proteger, linea } = require('./_lib/guard');

module.exports = async (req, res) => {
  if (!proteger(req, res, { nombre: 'contact', max: 5, ventanaMs: 10 * 60_000 })) return;
  const b = readBody(req);
  if (b.website) return res.status(200).json({ ok: true }); // honeypot

  const msg = {
    name: linea(b.name, 120),
    company: linea(b.company, 160),
    email: linea(b.email, 254),
    phone: linea(b.phone, 40),
    message: clean(b.message, 4000), // admite saltos de línea
  };
  if (!msg.name || !msg.message || !isEmail(msg.email)) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }
  try {
    await notify(`Nuevo mensaje de contacto · ${msg.name}`, { ...msg, received: new Date().toISOString() });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: 'No se ha podido enviar el mensaje' });
  }
};
