// Correo automático de respuesta a quien rellena el formulario de la prueba.
//
// La landing NO puede crear cuentas: no tiene base de datos. Las cuentas las
// crea la web app (Supabase). Así que este correo no manda credenciales que no
// existen: confirma la solicitud, dice qué pasa ahora y ofrece los atajos que
// sí están disponibles. Los bloques opcionales sólo aparecen si configuras su
// variable de entorno; mientras no lo hagas, el correo sigue teniendo sentido.
//
//   DEMO_URL         vídeo o grabación de 2-3 minutos enseñando el producto
//   MEETING_URL      enlace de reserva de cita (Calendly, Cal.com…)
//   DEMO_LOGIN_URL   cuenta de demostración compartida (+ DEMO_USER, DEMO_PASS)
//
// Ver docs/CORREO-PRUEBA.md.
const { siteUrl } = require('./config');

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const env = (k) => (process.env[k] || '').trim();

const CONTACTO = 'agroganera@gmail.com';
const TELEFONO = '645 56 29 42';

/** Bloques del cuerpo: cada uno con título, texto y, si procede, un botón. */
function bloques(lead) {
  const web = siteUrl();
  const out = [];

  out.push({
    titulo: 'Qué pasa ahora',
    texto: lead.phone
      ? `Te llamamos al ${esc(lead.phone)} en menos de 24 horas laborables para activar tu cuenta y cargar tu inventario de explotaciones y ganaderos. <strong>La prueba empieza a contar desde ese momento</strong>, no desde hoy, para que no pierdas días.`
      : 'Te escribimos en menos de 24 horas laborables para activar tu cuenta y cargar tu inventario de explotaciones y ganaderos. <strong>La prueba empieza a contar desde ese momento</strong>, no desde hoy, para que no pierdas días.',
  });

  if (env('DEMO_URL')) {
    out.push({
      titulo: 'Mientras tanto, mira cómo funciona',
      texto: 'Tres minutos: un ganadero escribe por WhatsApp y el trámite llega preparado a la gestoría.',
      boton: { texto: 'Ver cómo funciona', url: env('DEMO_URL') },
    });
  }

  if (env('DEMO_LOGIN_URL')) {
    out.push({
      titulo: 'Entra ahora mismo a curiosear',
      texto: 'Cuenta de demostración con datos de ejemplo:<br>'
        + `Usuario: <strong>${esc(env('DEMO_USER'))}</strong><br>`
        + `Contraseña: <strong>${esc(env('DEMO_PASS'))}</strong><br>`
        + '<em>Es una cuenta compartida con datos ficticios. No metas datos reales de tus ganaderos.</em>',
      boton: { texto: 'Abrir la demostración', url: env('DEMO_LOGIN_URL') },
    });
  }

  if (env('MEETING_URL')) {
    out.push({
      titulo: '¿Prefieres elegir tú la hora?',
      texto: 'Reserva el hueco que mejor te venga y te llamamos entonces.',
      boton: { texto: 'Reservar una llamada', url: env('MEETING_URL') },
    });
  }

  out.push({
    titulo: '¿No quieres esperar?',
    texto: 'Si ya lo tienes claro, puedes activar la prueba tú mismo en dos minutos. '
      + 'Pedimos tarjeta, pero <strong>no se cobra nada hasta el día 16</strong> y cancelas cuando quieras.',
    boton: { texto: 'Empezar la prueba ahora', url: `${web}/#planes` },
  });

  return out;
}

function html(lead) {
  const saludo = lead.name ? `Hola ${esc(lead.name.split(' ')[0])},` : 'Hola,';
  const quien = lead.company ? ` para <strong>${esc(lead.company)}</strong>` : '';
  const cuerpo = bloques(lead).map((b) => `
    <tr><td style="padding:0 0 28px">
      <p style="margin:0 0 6px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#ec3013;font-weight:700">${esc(b.titulo)}</p>
      <p style="margin:0;font-size:16px;line-height:1.55;color:#201e1d">${b.texto}</p>
      ${b.boton ? `<p style="margin:14px 0 0"><a href="${esc(b.boton.url)}" style="display:inline-block;background:#ec3013;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 20px">${esc(b.boton.texto)}</a></p>` : ''}
    </td></tr>`).join('');

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f3f2f2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f2f2;padding:32px 16px">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;padding:36px 32px;font-family:Arial,Helvetica,sans-serif">
    <tr><td style="padding:0 0 24px">
      <p style="margin:0;font-size:22px;font-weight:800;letter-spacing:-.02em;color:#201e1d">GANERA</p>
    </td></tr>
    <tr><td style="padding:0 0 24px">
      <p style="margin:0 0 10px;font-size:17px;color:#201e1d">${saludo}</p>
      <p style="margin:0;font-size:16px;line-height:1.55;color:#201e1d">Gracias por pedir los <strong>15 días de prueba</strong> de Ganera${quien}. Lo hemos recibido.</p>
    </td></tr>
    ${cuerpo}
    <tr><td style="border-top:1px solid #d7d3d3;padding:22px 0 0">
      <p style="margin:0;font-size:14px;line-height:1.6;color:#605d5d">
        Cualquier duda, responde a este correo o llámanos al <a href="tel:+34645562942" style="color:#ae1800">${TELEFONO}</a>.<br>
        Antonio y Álvaro · Ganera · <a href="${esc(siteUrl())}" style="color:#ae1800">ganera.es</a>
      </p>
    </td></tr>
    <tr><td style="padding:18px 0 0">
      <p style="margin:0;font-size:11px;line-height:1.5;color:#9b9797">
        Recibes este correo porque has solicitado una prueba en ganera.es. Tratamos tus datos para atender esa solicitud;
        puedes consultar el detalle y ejercer tus derechos en <a href="${esc(siteUrl())}/legal/privacidad" style="color:#9b9797">la política de privacidad</a>.
      </p>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

/** Versión en texto plano: algunos gestores leen el correo así. */
function texto(lead) {
  const web = siteUrl();
  const saludo = lead.name ? `Hola ${lead.name.split(' ')[0]},` : 'Hola,';
  const limpio = (s) => s.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '');
  const cuerpo = bloques(lead)
    .map((b) => `${b.titulo.toUpperCase()}\n${limpio(b.texto)}${b.boton ? `\n${b.boton.texto}: ${b.boton.url}` : ''}`)
    .join('\n\n');
  return `${saludo}

Gracias por pedir los 15 días de prueba de Ganera${lead.company ? ` para ${lead.company}` : ''}. Lo hemos recibido.

${cuerpo}

Cualquier duda, responde a este correo o llámanos al ${TELEFONO}.
Antonio y Álvaro · Ganera · ${web}

Recibes este correo porque has solicitado una prueba en ganera.es.
Privacidad: ${web}/legal/privacidad`;
}

const asunto = (lead) => (lead.company ? `Tu prueba de Ganera · ${lead.company}` : 'Tu prueba de Ganera');

module.exports = { html, texto, asunto, CONTACTO };
