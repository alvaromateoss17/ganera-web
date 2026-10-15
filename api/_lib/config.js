// Configuración del servidor, leída solo de variables de entorno.
// Los datos societarios NO viven aquí: su fuente única es _partials/legal.json,
// que consume scripts/legal.py para generar las páginas de /legal.
//
// AVISO: los textos de /legal son un borrador específico de Ganera que debe
// revisar un abogado antes de cobrar en real. Ver docs/LEGAL-PENDIENTE.md.

const siteUrl = () => (process.env.PUBLIC_SITE_URL || 'https://ganera.es').replace(/\/+$/, '');

/** Base para los enlaces a los documentos legales que Stripe muestra en el
 *  Checkout. Siempre pública: en local PUBLIC_SITE_URL es http://localhost y
 *  Stripe no acepta enlaces que no sean https, además de que las condiciones
 *  que acepta el cliente deben ser las publicadas, no las de tu portátil. */
const legalUrl = () => {
  const s = siteUrl();
  return s.startsWith('https://') ? s : 'https://ganera.es';
};
const appLoginUrl = () => process.env.APP_LOGIN_URL || 'https://app.ganera.es/login';
const checkoutEnabled = () => process.env.CHECKOUT_ENABLED === 'true';

/** ¿Estamos sirviendo el dominio público y no un entorno local o de preview? */
const esProduccion = () => /^https:\/\/(www\.)?ganera\.es/.test(siteUrl());

/** Clave de Stripe del entorno de prueba (sk_test_ / rk_test_). */
const claveDePrueba = () => /^(sk|rk)_test_/.test((process.env.STRIPE_SECRET_KEY || '').trim());

/**
 * Salvaguarda: con claves de PRUEBA en el dominio real, un cliente acabaría en
 * una pasarela marcada «Entorno de prueba» que rechaza su tarjeta de verdad.
 * Preferimos no cobrar a cobrar mal, así que en ese caso el pago se bloquea.
 * STRIPE_ALLOW_TEST_IN_PROD=true lo desactiva si alguna vez hace falta.
 */
const pagoInseguro = () =>
  esProduccion() && claveDePrueba() && process.env.STRIPE_ALLOW_TEST_IN_PROD !== 'true';

/** Días de prueba, acotados para que una variable mal puesta no abra una prueba eterna. */
const trialDays = () => {
  const n = parseInt(process.env.STRIPE_TRIAL_DAYS || '', 10);
  return Number.isFinite(n) && n > 0 && n <= 90 ? n : 15;
};

module.exports = { siteUrl, legalUrl, appLoginUrl, checkoutEnabled, trialDays, esProduccion, claveDePrueba, pagoInseguro };
