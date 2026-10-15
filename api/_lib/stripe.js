// Cliente de Stripe y mapa de planes → Price ID.
// La clave secreta sólo vive en process.env y jamás llega al navegador.
const Stripe = require('stripe');

/** Planes reales de la web (_partials/precios.json). Lista blanca: nada fuera de aquí se cobra. */
const PLANES = {
  base: { nombre: 'Base', env: 'STRIPE_PRICE_BASE' },
  gestion: { nombre: 'Gestión', env: 'STRIPE_PRICE_GESTION' },
  plus: { nombre: 'Plus', env: 'STRIPE_PRICE_PLUS' },
};

/** Periodos de facturación del selector Mensual/Anual. */
const PERIODOS = { mensual: 'MENSUAL', anual: 'ANUAL' };

/** Servicio GaneraAI: complemento mensual opcional que se suma a cualquier plan. */
const COMPLEMENTOS = { ganerai: { nombre: 'GaneraAI', env: 'STRIPE_PRICE_GANERAI' } };

let client = null;
function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY no configurada');
  if (!client) client = new Stripe(key);
  return client;
}

/** Price ID del plan en el periodo pedido, o null si no está configurado. */
function priceId(plan, periodo) {
  const p = PLANES[plan];
  if (!p || !PERIODOS[periodo]) return null;
  return (process.env[`${p.env}_${PERIODOS[periodo]}`] || '').trim() || null;
}

function complementoPriceId(id) {
  const c = COMPLEMENTOS[id];
  if (!c) return null;
  return (process.env[c.env] || '').trim() || null;
}

const nombrePlan = (plan) => (PLANES[plan] ? PLANES[plan].nombre : plan);

module.exports = { stripe, priceId, complementoPriceId, nombrePlan, PLANES, PERIODOS, COMPLEMENTOS };
