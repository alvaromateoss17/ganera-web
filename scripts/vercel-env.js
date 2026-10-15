#!/usr/bin/env node
// Imprime las variables listas para pegar en Vercel, leyéndolas de .env.local.
//
//   npm run vercel:env
//
// Marca cuáles son del entorno de prueba y a qué entorno de Vercel va cada una.
// Nunca imprime la clave secreta entera: eso se copia del panel de Stripe.
require('./env').cargar();

const v = (k) => (process.env[k] || '').trim();
const esPrueba = /^(sk|rk)_test_/.test(v('STRIPE_SECRET_KEY'));

const PRECIOS = [
  'STRIPE_PRICE_BASE_MENSUAL', 'STRIPE_PRICE_BASE_ANUAL',
  'STRIPE_PRICE_GESTION_MENSUAL', 'STRIPE_PRICE_GESTION_ANUAL',
  'STRIPE_PRICE_PLUS_MENSUAL', 'STRIPE_PRICE_PLUS_ANUAL',
  'STRIPE_PRICE_GANERAI', 'STRIPE_TAX_RATE_ID',
];

const linea = '─'.repeat(64);
console.log(`\n${linea}`);
console.log('  Vercel → Settings → Environment Variables');
console.log(linea);

if (esPrueba) {
  console.log(`
  ⚠️  Lo que tienes en .env.local es del ENTORNO DE PRUEBA de Stripe.

  Estos Price ID NO existen en la cuenta real: el día que actives la
  cuenta buena hay que volver a ejecutar \`npm run stripe:setup\` con la
  clave sk_live_ y usar los identificadores que salgan entonces.

  Mientras tanto, pégalos en el entorno PREVIEW de Vercel, no en
  Production: así puedes probarlo en una URL de verdad sin que un
  cliente se tope con una pasarela de prueba.
`);
}

console.log('  ── Siempre, en Production y Preview ──\n');
console.log('CHECKOUT_ENABLED=false');
console.log('PUBLIC_SITE_URL=https://ganera.es');
console.log(`APP_LOGIN_URL=${v('APP_LOGIN_URL') || 'https://app.ganera.es/login'}`);

console.log(`\n  ── Stripe (entorno ${esPrueba ? 'PREVIEW' : 'PRODUCTION'}) ──\n`);
console.log('STRIPE_SECRET_KEY=     ← cópiala del panel de Stripe, no de aquí');
let faltan = 0;
for (const k of PRECIOS) {
  if (v(k)) console.log(`${k}=${v(k)}`);
  else { console.log(`${k}=     ← FALTA: ejecuta npm run stripe:setup`); faltan++; }
}

console.log('\n  ── Correo (cuando configures Resend) ──\n');
console.log('RESEND_API_KEY=        ← de resend.com');
console.log(`LEADS_TO_EMAIL=${v('LEADS_TO_EMAIL') || 'agroganera@gmail.com'}`);
console.log('LEADS_FROM_EMAIL=Ganera <hola@ganera.es>');

console.log(`\n${linea}`);
console.log(`
  El día que tengas la cuenta real de Stripe:

    1. npm run stripe:setup   con la clave sk_live_ en .env.local
    2. Pega en Vercel → Production la clave y los Price ID nuevos
    3. Cambia CHECKOUT_ENABLED a true
    4. Redespliega (Vercel → Deployments → Redeploy)

  Hasta el paso 3, los botones de pago no se muestran y la web se
  comporta igual que hoy. Y si se colara una clave de prueba en el
  dominio real, /api/checkout lo bloquea solo.
`);
if (faltan) console.log(`  ⚠️  Faltan ${faltan} variables en .env.local.\n`);
