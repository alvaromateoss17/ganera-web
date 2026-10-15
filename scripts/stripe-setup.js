#!/usr/bin/env node
// Crea en Stripe los productos y precios de Ganera a partir de _partials/precios.json.
//
//   npm run stripe:setup
//
// Es idempotente: los productos llevan un id fijo (ganera_base…) y los precios
// una lookup_key, así que ejecutarlo dos veces no duplica nada. Lee la clave de
// .env.local; si es una sk_test_ trabaja en el entorno de prueba y no mueve
// dinero real. Al terminar imprime las variables listas para pegar en Vercel.
const fs = require('fs');
const path = require('path');
require('./env').cargar();

const ROOT = path.join(__dirname, '..');
const Stripe = require('stripe');

const KEY = (process.env.STRIPE_SECRET_KEY || '').trim();
if (!KEY) {
  console.error('\n  Falta STRIPE_SECRET_KEY.\n\n  Crea un archivo .env.local en la raíz del proyecto con:\n    STRIPE_SECRET_KEY=sk_test_…\n\n  (.env.local está en .gitignore: la clave no se sube a GitHub.)\n');
  process.exit(1);
}
const MODO = KEY.startsWith('sk_live_') ? 'ACTIVO (dinero real)' : 'PRUEBA';
const stripe = new Stripe(KEY);

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, '_partials', 'precios.json'), 'utf8'));
const EUR = (n) => Math.round(n * 100); // 69 € → 6900 céntimos

/** Producto con id fijo: lo recupera si existe, lo crea si no. */
async function producto(id, name, description) {
  try {
    const p = await stripe.products.retrieve(id);
    console.log(`  = producto ${id} (ya existía)`);
    return p;
  } catch (err) {
    if (err.code !== 'resource_missing') throw err;
    const p = await stripe.products.create({ id, name, description, metadata: { origen: 'ganera-web' } });
    console.log(`  + producto ${id} — ${name}`);
    return p;
  }
}

/** Precio identificado por lookup_key: no se duplica entre ejecuciones. */
async function precio(lookup_key, product, importe, interval) {
  const { data } = await stripe.prices.list({ lookup_keys: [lookup_key], limit: 1 });
  if (data.length) {
    console.log(`  = precio ${lookup_key} → ${data[0].id} (ya existía)`);
    return data[0];
  }
  const p = await stripe.prices.create({
    product,
    lookup_key,
    currency: 'eur',
    unit_amount: EUR(importe),
    recurring: { interval },
    metadata: { origen: 'ganera-web' },
  });
  console.log(`  + precio ${lookup_key} → ${p.id} (${importe} € / ${interval === 'month' ? 'mes' : 'año'})`);
  return p;
}

/** IVA 21 %. Los tax rates no se pueden modificar, así que se busca por descripción. */
async function iva() {
  const { data } = await stripe.taxRates.list({ limit: 100, active: true });
  const ya = data.find((t) => t.percentage === 21 && t.country === 'ES' && !t.inclusive);
  if (ya) {
    console.log(`  = IVA 21 % → ${ya.id} (ya existía)`);
    return ya;
  }
  const t = await stripe.taxRates.create({
    display_name: 'IVA',
    description: 'IVA 21 % (España)',
    percentage: 21,
    inclusive: false,
    country: 'ES',
  });
  console.log(`  + IVA 21 % → ${t.id}`);
  return t;
}

(async () => {
  const cuenta = await stripe.accounts.retrieve();
  console.log(`\n  Cuenta: ${cuenta.id}${cuenta.settings && cuenta.settings.dashboard && cuenta.settings.dashboard.display_name ? ` (${cuenta.settings.dashboard.display_name})` : ''}`);
  console.log(`  Modo:   ${MODO}\n`);
  if (MODO.startsWith('ACTIVO')) {
    console.log('  ⚠️  Estás usando una clave de producción. Ctrl+C si no era la intención.\n');
  }

  const env = [];

  console.log('  Planes');
  for (const plan of cfg.planes) {
    const prod = await producto(
      `ganera_${plan.id}`,
      `Ganera ${plan.nombre}`,
      `Plan ${plan.nombre} de Ganera: hasta ${plan.ganaderos} ganaderos gestionados. Precios sin IVA.`
    );
    const m = await precio(`ganera_${plan.id}_mensual`, prod.id, plan.mensual, 'month');
    const a = await precio(`ganera_${plan.id}_anual`, prod.id, plan.anual, 'year');
    const N = plan.id.toUpperCase().replace('-', '_');
    env.push([`STRIPE_PRICE_${N}_MENSUAL`, m.id], [`STRIPE_PRICE_${N}_ANUAL`, a.id]);
  }

  console.log('\n  Complemento');
  const ia = cfg.servicios.find((s) => s.nombre === 'GaneraAI');
  if (ia) {
    const prod = await producto('ganera_ganerai', 'GaneraAI', `${ia.detalle} Precio sin IVA.`);
    const p = await precio('ganera_ganerai_mensual', prod.id, 49, 'month');
    env.push(['STRIPE_PRICE_GANERAI', p.id]);
  }

  console.log('\n  Impuestos');
  const tax = await iva();
  env.push(['STRIPE_TAX_RATE_ID', tax.id]);

  console.log('\n──────────────────────────────────────────────────────────────');
  console.log('  Variables para Vercel:\n');
  for (const [k, v] of env) console.log(`${k}=${v}`);
  console.log('──────────────────────────────────────────────────────────────');

  // Escribe los valores en .env.local para ahorrar el copia y pega, que es
  // donde más fácil se cuela un error. Sólo toca las claves que genera este
  // script: no pisa STRIPE_SECRET_KEY ni el resto de tu configuración.
  const envFile = path.join(ROOT, '.env.local');
  if (fs.existsSync(envFile)) {
    let txt = fs.readFileSync(envFile, 'utf8');
    let tocadas = 0;
    for (const [k, v] of env) {
      const re = new RegExp(`^${k}=.*$`, 'm');
      if (re.test(txt)) txt = txt.replace(re, `${k}=${v}`);
      else txt += `${txt.endsWith('\n') ? '' : '\n'}${k}=${v}\n`;
      tocadas++;
    }
    fs.writeFileSync(envFile, txt);
    console.log(`\n  ✓ Escritas ${tocadas} variables en .env.local — no tienes que copiar nada.`);
    console.log('    Reinicia el servidor para que las cargue:  Ctrl+C  y  npm run dev');
  } else {
    console.log('\n  No hay .env.local: copia las variables de arriba a mano.');
  }
  console.log(`
  Falta un paso que SOLO se hace en el panel, no por API:

    Stripe → Configuración → Público (Business details) →
    "Terms of service URL" = https://ganera.es/terminos

  Sin eso, consent_collection falla y el Checkout no abre.
  Ponlo también en modo prueba, no solo en producción.
`);
})().catch((err) => {
  console.error('\n  Error de Stripe:', err.message);
  if (err.code) console.error('  code:', err.code);
  process.exit(1);
});
