#!/usr/bin/env node
// Servidor local: sirve el sitio estático y ejecuta las funciones reales de /api.
//
//   npm run dev
//
// Reproduce lo que hace Vercel (URLs limpias, redirecciones de vercel.json) para
// poder probar el cobro de punta a punta contra el entorno de PRUEBA de Stripe.
// Lee la configuración de .env.local.
const fs = require('fs');
const http = require('http');
const path = require('path');
require('./env').cargar();

const ROOT = path.join(__dirname, '..');
const PUERTO = Number(process.env.PORT || 3000);
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const REDIRECTS = Object.fromEntries((vercel.redirects || []).map((r) => [r.source, r.destination]));

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};

/** Envuelve req/res para que se parezcan a lo que recibe una función de Vercel. */
function adaptar(req, res, url) {
  req.query = Object.fromEntries(url.searchParams);
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(b));
    return res;
  };
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PUERTO}`);
  let ruta = decodeURIComponent(url.pathname);

  // ── Funciones de /api ──
  if (ruta.startsWith('/api/')) {
    const archivo = path.join(ROOT, `${ruta.slice(1)}.js`);
    if (!fs.existsSync(archivo)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end('{"error":"No existe esa función"}');
    }
    let cuerpo = '';
    req.on('data', (c) => (cuerpo += c));
    await new Promise((r) => req.on('end', r));
    req.body = cuerpo;
    adaptar(req, res, url);
    try {
      delete require.cache[require.resolve(archivo)]; // recarga en caliente
      await require(archivo)(req, res);
    } catch (err) {
      console.error(`  ✗ ${ruta}`, err);
      if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end('{"error":"Error en la función"}'); }
    }
    console.log(`  ${req.method} ${ruta}${url.search} → ${res.statusCode}`);
    return;
  }

  // ── Redirecciones de vercel.json ──
  if (REDIRECTS[ruta]) {
    res.writeHead(308, { Location: REDIRECTS[ruta] });
    return res.end();
  }

  // ── Estáticos con URLs limpias ──
  if (ruta === '/') ruta = '/index.html';
  let archivo = path.join(ROOT, ruta);
  if (!fs.existsSync(archivo) && fs.existsSync(`${archivo}.html`)) archivo = `${archivo}.html`;
  else if (fs.existsSync(archivo) && fs.statSync(archivo).isDirectory()) archivo = path.join(archivo, 'index.html');

  if (!path.resolve(archivo).startsWith(ROOT) || !fs.existsSync(archivo)) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<!doctype html><meta charset="utf-8"><title>404</title><h1>404</h1><p>No existe esa página.</p>');
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' });
  fs.createReadStream(archivo).pipe(res);
});

servidor.listen(PUERTO, () => {
  const key = process.env.STRIPE_SECRET_KEY || '';
  const modo = !key ? 'sin clave de Stripe' : key.startsWith('sk_live_') ? '⚠️  CLAVE DE PRODUCCIÓN' : 'Stripe en modo prueba';
  console.log(`
  Ganera en http://localhost:${PUERTO}

  CHECKOUT_ENABLED : ${process.env.CHECKOUT_ENABLED || 'false (por defecto)'}
  Stripe           : ${modo}
  APP_LOGIN_URL    : ${process.env.APP_LOGIN_URL || 'https://app.ganera.es/login (por defecto)'}

  Ctrl+C para parar.
`);
});
