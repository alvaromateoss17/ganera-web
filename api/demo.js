// POST /api/demo — trial request from /demo.
const { notify, isEmail, clean, readBody } = require('./_lib/notify');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const b = readBody(req);
  if (b.website) return res.status(200).json({ ok: true }); // honeypot: silently drop bots

  const lead = {
    name: clean(b.name, 120),
    company: clean(b.company, 160),
    email: clean(b.email, 254),
    phone: clean(b.phone, 40),
    region: clean(b.region, 60),
    plan: clean(b.plan, 20),
    message: clean(b.message, 2000),
  };
  if (!lead.name || !lead.company || !lead.region || !isEmail(lead.email)) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }
  try {
    await notify(`Nueva prueba Ganera · ${lead.company}`, { ...lead, received: new Date().toISOString() });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: 'No se ha podido registrar la solicitud' });
  }
};
