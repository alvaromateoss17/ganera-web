#!/usr/bin/env node
// Envía la auto-respuesta de la prueba a una dirección real, para verla en la
// bandeja de entrada tal y como la recibirá un cliente.
//
//   npm run correo:prueba -- tu@correo.es
require('./env').cargar();
const { enviar } = require('../api/_lib/notify');
const emails = require('../api/_lib/emails');

const destino = process.argv[2];
if (!destino || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino)) {
  console.error('\n  Uso:  npm run correo:prueba -- tu@correo.es\n');
  process.exit(1);
}
if (!process.env.RESEND_API_KEY) {
  console.error('\n  Falta RESEND_API_KEY en .env.local.\n  Resend → API Keys → Create API Key.\n');
  process.exit(1);
}

const lead = {
  name: 'Marta Sánchez',
  company: 'Gestoría de prueba',
  email: destino,
  phone: '645 00 11 22',
  region: 'Extremadura',
  plan: 'gestion',
};

const remitente = process.env.LEADS_FROM_EMAIL || 'Ganera <onboarding@resend.dev>';
console.log(`\n  De:    ${remitente}`);
console.log(`  Para:  ${destino}`);
console.log(`  Asunto: ${emails.asunto(lead)}\n`);

enviar({ to: destino, subject: emails.asunto(lead), html: emails.html(lead), text: emails.texto(lead), replyTo: emails.CONTACTO })
  .then((ok) => {
    console.log(ok ? '  ✓ Enviado. Míralo en tu bandeja (y en spam, por si acaso).\n'
                   : '  ✗ No se envió: falta configuración.\n');
  })
  .catch((err) => {
    console.error('\n  ✗ Error:', err.message);
    if (/domain is not verified|not verified/i.test(err.message)) {
      console.error('    El dominio aún no está verificado en Resend. Dale a "Verify DNS Records".');
    }
    if (/403|unauthorized|invalid/i.test(err.message)) {
      console.error('    Revisa la clave: Resend → API Keys. Debe empezar por re_.');
    }
    console.error('');
    process.exit(1);
  });
