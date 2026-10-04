// POST /api/contact — general contact form at /contacto.
const { notify, isEmail, clean, readBody } = require('./_lib/notify');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const b = readBody(req);
  if (b.website) return res.status(200).json({ ok: true }); // honeypot

  const msg = {
    name: clean(b.name, 120),
    company: clean(b.company, 160),
    email: clean(b.email, 254),
    phone: clean(b.phone, 40),
    message: clean(b.message, 4000),
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
