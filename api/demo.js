// POST /api/demo — solicitud de prueba desde /prueba-15-dias.
const { notify, enviar, isEmail, clean, readBody } = require('./_lib/notify');
const { proteger, limitar, linea } = require('./_lib/guard');
const emails = require('./_lib/emails');

module.exports = async (req, res) => {
  if (!proteger(req, res, { nombre: 'demo', max: 5, ventanaMs: 10 * 60_000 })) return;
  const b = readBody(req);
  if (b.website) return res.status(200).json({ ok: true }); // honeypot: descarta bots en silencio

  const lead = {
    name: linea(b.name, 120),
    company: linea(b.company, 160),
    email: linea(b.email, 254),
    phone: linea(b.phone, 40),
    region: linea(b.region, 60),
    plan: linea(b.plan, 20),
    message: clean(b.message, 2000), // admite saltos de línea
  };
  if (!lead.name || !lead.company || !lead.region || !isEmail(lead.email)) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  try {
    // 1. El aviso para nosotros. Si esto falla, la solicitud se ha perdido.
    await notify(`Nueva prueba Ganera · ${lead.company}`, { ...lead, received: new Date().toISOString() });
  } catch (err) {
    console.error('Aviso interno fallido', err);
    return res.status(502).json({ error: 'No se ha podido registrar la solicitud' });
  }

  // 2. La respuesta automática al interesado. Como sale hacia la dirección que
  //    alguien ha escrito en un formulario, se limita a una por dirección y
  //    hora: sin esto, cualquiera podría usar nuestro dominio para inundar el
  //    buzón de un tercero, y Resend nos suspendería la cuenta.
  if (limitar(`autorespuesta:${lead.email.toLowerCase()}`, 1, 60 * 60_000)) {
    console.warn('Auto-respuesta omitida: ya se envió una a esta dirección hace menos de una hora', lead.email);
  } else {
    try {
      await enviar({
        to: lead.email,
        subject: emails.asunto(lead),
        html: emails.html(lead),
        text: emails.texto(lead),
        replyTo: emails.CONTACTO,
      });
    } catch (err) {
      // La solicitud ya está registrada: se anota y seguimos, nunca devolvemos error por esto.
      console.error('Auto-respuesta fallida para', lead.email, err.message);
    }
  }

  return res.status(200).json({ ok: true });
};
