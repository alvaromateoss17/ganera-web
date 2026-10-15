// GET /api/config — configuración PÚBLICA para las páginas estáticas.
// La web no tiene paso de compilación, así que no existe prefijo tipo
// NEXT_PUBLIC_/VITE_: este endpoint es el único canal por el que el navegador
// conoce CHECKOUT_ENABLED y APP_LOGIN_URL. Aquí nunca se expone ningún secreto.
const { checkoutEnabled, appLoginUrl, siteUrl, trialDays } = require('./_lib/config');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
  return res.status(200).json({
    checkoutEnabled: checkoutEnabled(),
    appLoginUrl: appLoginUrl(),
    siteUrl: siteUrl(),
    trialDays: trialDays(),
  });
};
