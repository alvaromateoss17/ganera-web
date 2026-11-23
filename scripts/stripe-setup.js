#!/usr/bin/env node
// Crea en Stripe los productos y precios de Ganera a partir de _partials/precios.json.
//
//   npm run stripe:setup
//
// Precios con IVA incluido (21 %). Productos nuevos (sufijo _inc); los antiguos
// (ganera_base, ganera_gestion, …) se archivan y sus precios se desactivan.
// Idempotente: productos por id fijo, precios por lookup_key.
const fs = require('fs');
const path = require('path');
require('./env').cargar();

const ROOT = path.join(__dirname, '..');
const Stripe = require('stripe');

const KEY = (process.env.STRIPE_SECRET_KEY || '').trim();
if (!KEY) {
  console.error('\n  Falta STRIPE_SECRET_KEY.\n\n  Crea un archivo .env.local en la raíz del proyecto con:\n    STRIPE_SECRET_KEY=sk_test_…   (o sk_live_… en producción)\n\n  (.env.local está en .gitignore: la clave no se sube a GitHub.)\n');
  process.exit(1);
}
const MODO = (KEY.startsWith('sk_live_') || KEY.startsWith('rk_live_'))
  ? 'ACTIVO (dinero real)'
  : 'PRUEBA';
const stripe = new Stripe(KEY);

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, '_partials', 'precios.json'), 'utf8'));
const EUR = (n) => Math.round(n * 100); // 84 € → 8400 céntimos

/** Ids de productos antiguos (sin IVA incluido). Se archivan al migrar. */
const PRODUCTOS_ANTIGUOS = ['ganera_base', 'ganera_gestion', 'ganera_plus', 'ganera_ganerai'];

/** lookup_keys de precios antiguos: se les quita la clave y se desactivan. */
const LOOKUP_ANTIGUOS = [
  'ganera_base_mensual', 'ganera_base_anual',
  'ganera_gestion_mensual', 'ganera_gestion_anual',
  'ganera_plus_mensual', 'ganera_plus_anual',
  'ganera_ganerai_mensual',
];

async function producto(id, name, description) {
  try {
    const p = await stripe.products.retrieve(id);
    if (p.active === false) {
      await stripe.products.update(id, { active: true, name, description });
      console.log(`  = producto ${id} (reactivado)`);
    } else {
      await stripe.products.update(id, { name, description });
      console.log(`  = producto ${id} (ya existía)`);
    }
    return p;
  } catch (err) {
    if (err.code !== 'resource_missing') throw err;
    const p = await stripe.products.create({
      id,
      name,
      description,
      metadata: { origen: 'ganera-web', iva: 'incluido' },
    });
    console.log(`  + producto ${id} — ${name}`);
    return p;
  }
}

async function precio(lookup_key, product, importe, interval) {
  const { data } = await stripe.prices.list({ lookup_keys: [lookup_key], limit: 1 });
  if (data.length) {
    const actual = data[0];
    const ok =
      actual.active &&
      actual.unit_amount === EUR(importe) &&
      actual.recurring &&
      actual.recurring.interval === interval &&
      actual.tax_behavior === 'inclusive';
    if (ok) {
      console.log(`  = precio ${lookup_key} → ${actual.id} (ya existía)`);
      return actual;
    }
    // Importe o comportamiento distinto: desactivar y transferir la lookup_key al nuevo.
    await stripe.prices.update(actual.id, { active: false });
    console.log(`  ~ precio ${lookup_key} desactualizado desactivado (${actual.id})`);
  }
  const createParams = {
    product,
    lookup_key,
    currency: 'eur',
    unit_amount: EUR(importe),
    tax_behavior: 'inclusive',
    recurring: { interval },
    metadata: { origen: 'ganera-web', iva: 'incluido' },
  };
  if (data.length) createParams.transfer_lookup_key = true;
  const p = await stripe.prices.create(createParams);
  console.log(`  + precio ${lookup_key} → ${p.id} (${importe} € IVA incl. / ${interval === 'month' ? 'mes' : 'año'})`);
  return p;
}

/** IVA 21 % incluido en el precio. Los tax rates no se pueden modificar. */
async function ivaIncluido() {
  const { data } = await stripe.taxRates.list({ limit: 100, active: true });
  const ya = data.find((t) => t.percentage === 21 && t.country === 'ES' && t.inclusive === true);
  if (ya) {
    console.log(`  = IVA 21 % incluido → ${ya.id} (ya existía)`);
    return ya;
  }
  const t = await stripe.taxRates.create({
    display_name: 'IVA',
    description: 'IVA 21 % incluido (España)',
    percentage: 21,
    inclusive: true,
    country: 'ES',
  });
  console.log(`  + IVA 21 % incluido → ${t.id}`);
  return t;
}

/** Desactiva precios viejos y archiva productos sin IVA incluido. */
async function retirarAntiguos() {
  console.log('  Retirada de catálogo antiguo (sin IVA incluido)');
  for (const key of LOOKUP_ANTIGUOS) {
    const { data } = await stripe.prices.list({ lookup_keys: [key], limit: 1 });
    for (const p of data) {
      if (!p.active) {
        console.log(`  = precio antiguo ${key} ya inactivo → ${p.id}`);
        continue;
      }
      await stripe.prices.update(p.id, { active: false });
      console.log(`  ~ precio antiguo ${key} desactivado → ${p.id}`);
    }
  }
  // Por si quedaron precios activos en los productos viejos sin lookup_key.
  for (const id of PRODUCTOS_ANTIGUOS) {
    try {
      const prod = await stripe.products.retrieve(id);
      const { data: precios } = await stripe.prices.list({ product: id, active: true, limit: 100 });
      for (const p of precios) {
        await stripe.prices.update(p.id, { active: false });
        console.log(`  ~ precio ${p.id} del producto ${id} desactivado`);
      }
      if (prod.active) {
        await stripe.products.update(id, { active: false });
        console.log(`  ~ producto ${id} archivado`);
      } else {
        console.log(`  = producto ${id} ya archivado`);
      }
    } catch (err) {
      if (err.code === 'resource_missing') {
        console.log(`  = producto ${id} no existe (nada que archivar)`);
      } else {
        throw err;
      }
    }
  }
}

(async () => {
  const cuenta = await stripe.accounts.retrieve();
  console.log(`\n  Cuenta: ${cuenta.id}${cuenta.settings && cuenta.settings.dashboard && cuenta.settings.dashboard.display_name ? ` (${cuenta.settings.dashboard.display_name})` : ''}`);
  console.log(`  Modo:   ${MODO}\n`);
  if (MODO.startsWith('ACTIVO')) {
    console.log('  ⚠️  Estás usando una clave de producción. Ctrl+C si no era la intención.\n');
  }

  await retirarAntiguos();

  const env = [];

  console.log('\n  Planes (IVA incluido)');
  for (const plan of cfg.planes) {
    const prod = await producto(
      `ganera_${plan.id}_inc`,
      `Ganera ${plan.nombre}`,
      `Plan ${plan.nombre} de Ganera: hasta ${plan.ganaderos} ganaderos gestionados. Precio con IVA incluido.`
    );
    const m = await precio(`ganera_${plan.id}_mensual_inc`, prod.id, plan.mensual, 'month');
    const a = await precio(`ganera_${plan.id}_anual_inc`, prod.id, plan.anual, 'year');
    const N = plan.id.toUpperCase().replace('-', '_');
    env.push([`STRIPE_PRICE_${N}_MENSUAL`, m.id], [`STRIPE_PRICE_${N}_ANUAL`, a.id]);
  }

  console.log('\n  Complemento (IVA incluido)');
  const ia = cfg.complementos && cfg.complementos.ganerai;
  if (ia) {
    const prod = await producto(
      'ganera_ganerai_inc',
      ia.nombre,
      `${ia.nombre}: complemento opcional. Precio con IVA incluido.`
    );
    const p = await precio('ganera_ganerai_mensual_inc', prod.id, ia.mensual, 'month');
    env.push(['STRIPE_PRICE_GANERAI', p.id]);
  }

  console.log('\n  Impuestos');
  const tax = await ivaIncluido();
  env.push(['STRIPE_TAX_RATE_ID', tax.id]);

  // Desactivar tax rates exclusivos antiguos para que no se reutilicen por error.
  const { data: taxes } = await stripe.taxRates.list({ limit: 100, active: true });
  for (const t of taxes) {
    if (t.id !== tax.id && t.percentage === 21 && t.country === 'ES' && t.inclusive === false) {
      await stripe.taxRates.update(t.id, { active: false });
      console.log(`  ~ Tax Rate exclusivo antiguo desactivado → ${t.id}`);
    }
  }

  console.log('\n──────────────────────────────────────────────────────────────');
  console.log('  Variables para Vercel:\n');
  for (const [k, v] of env) console.log(`${k}=${v}`);
  console.log('──────────────────────────────────────────────────────────────');

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
    console.log('\n  No hay .env.local: copia las variables de arriba a mano (o créalo con STRIPE_SECRET_KEY).');
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
