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
const API_DIR = path.join(ROOT, 'api');
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const REDIRECTS = Object.fromEntries((vercel.redirects || []).map((r) => [r.source, r.destination]));

// Las mismas cabeceras que pone Vercel (CSP incluida), para que lo que falle por
// seguridad falle también aquí y no se descubra en producción.
const REGLAS = (vercel.headers || []).map((h) => ({ re: patron(h.source), headers: h.headers }));

/** '/api/(.*)' → /^\/api\/.*$/ : se escapa lo literal y cada (.*) pasa a ser comodín. */
function patron(source) {
  const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  return new RegExp('^' + source.split('(.*)').map(escapar).join('.*') + '$');
}
function aplicarCabeceras(res, ruta) {
  for (const r of REGLAS) if (r.re.test(ruta)) for (const { key, value } of r.headers) res.setHeader(key, value);
  // En local no hay HTTPS: upgrade-insecure-requests rompería las peticiones.
  const csp = res.getHeader('Content-Security-Policy');
  if (csp) res.setHeader('Content-Security-Policy', String(csp).replace(/;\s*upgrade-insecure-requests/, ''));
}

/** ¿Está la ruta dentro de la carpeta indicada? (sin trampas con ../ ni prefijos) */
const dentroDe = (dir, archivo) => {
  const rel = path.relative(dir, path.resolve(archivo));
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
};

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

  aplicarCabeceras(res, ruta);

  // ── Funciones de /api ──
  if (ruta.startsWith('/api/')) {
    const archivo = path.join(ROOT, `${ruta.slice(1)}.js`);
    // Sólo funciones de primer nivel de api/: ni ../ para salir de la carpeta
    // ni api/_lib/, que Vercel tampoco expone.
    const valida = dentroDe(API_DIR, archivo) && path.dirname(path.resolve(archivo)) === API_DIR;
    if (!valida || !fs.existsSync(archivo)) {
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

  const privado = /(^|\/)(\.|_partials|scripts|docs|node_modules|reference)/.test(path.relative(ROOT, archivo));
  if (!dentroDe(ROOT, archivo) || privado || !fs.existsSync(archivo)) {
    // Igual que Vercel: la página 404 propia, con su código 404.
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    return fs.createReadStream(path.join(ROOT, '404.html')).pipe(res);
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
