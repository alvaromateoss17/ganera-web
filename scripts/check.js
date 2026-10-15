#!/usr/bin/env node
// Comprobación del repo: no hay paso de compilación, así que esto es lo que
// hace de "build". Verifica que las funciones compilan, que los JSON son
// válidos, que no se cuela ningún secreto y que los enlaces internos existen.
//   npm run check
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let fallos = 0;

const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => { fallos++; console.log(`  ✗ ${msg}`); };

const walk = (dir, ext, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'reference', 'assets'].includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, ext, out);
    else if (full.endsWith(ext)) out.push(full);
  }
  return out;
};

console.log('\nSintaxis de las funciones y del JS del sitio');
for (const f of [...walk(path.join(ROOT, 'api'), '.js'), path.join(ROOT, 'js/main.js')]) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    ok(path.relative(ROOT, f));
  } catch (err) {
    fail(`${path.relative(ROOT, f)} — ${String(err.stderr || err).split('\n')[1] || err.message}`);
  }
}

console.log('\nJSON de configuración');
for (const f of ['vercel.json', '_partials/precios.json', '_partials/legal.json', 'package.json']) {
  try {
    JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    ok(f);
  } catch (err) {
    fail(`${f} — ${err.message}`);
  }
}

console.log('\nSecretos fuera de las variables de entorno');
// Una clave de verdad lleva material detrás del prefijo. Exigirlo evita saltar
// con los prefijos que aparecen en comentarios y en la salvaguarda de checkout.
const SECRETO = /\b(sk|rk)_(live|test)_[A-Za-z0-9]{16,}|\bwhsec_[A-Za-z0-9]{16,}|\bre_[A-Za-z0-9]{20,}/;
const fuentes = [...walk(path.join(ROOT, 'api'), '.js'), ...walk(path.join(ROOT, 'js'), '.js'), ...walk(ROOT, '.html')];
const sucios = fuentes.filter((f) => SECRETO.test(fs.readFileSync(f, 'utf8')));
sucios.length ? sucios.forEach((f) => fail(`clave en ${path.relative(ROOT, f)}`)) : ok('ninguna clave en el código');

console.log('\nEnlaces internos');
const redirects = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')).redirects
  .reduce((m, r) => ({ ...m, [r.source]: r.destination }), {});
const existe = (ruta) => {
  const r = redirects[ruta] || ruta;
  if (r === '/') return true;
  const rel = r.replace(/^\//, '');
  return fs.existsSync(path.join(ROOT, `${rel}.html`))
    || fs.existsSync(path.join(ROOT, rel, 'index.html'))
    || fs.existsSync(path.join(ROOT, rel));
};
let rotos = 0;
for (const f of walk(ROOT, '.html')) {
  if (f.includes('_partials')) continue;
  const html = fs.readFileSync(f, 'utf8');
  for (const m of new Set([...html.matchAll(/href="(\/[^"#?]*)/g)].map((x) => x[1]))) {
    if (/^\/(api|assets|css|js)\//.test(m)) continue;
    if (!existe(m)) { fail(`${path.relative(ROOT, f)} → ${m}`); rotos++; }
  }
}
if (!rotos) ok('todos los enlaces internos resuelven');

console.log('\nRecursos referenciados (imágenes, fuentes, CSS, JS)');
let faltan = 0;
const recursos = new Set();
for (const f of [...walk(ROOT, '.html'), ...walk(path.join(ROOT, 'css'), '.css')]) {
  if (f.includes('_partials')) continue;
  const txt = fs.readFileSync(f, 'utf8');
  for (const m of txt.matchAll(/(?:src|href)="(\/(?:assets|css|js)\/[^"#?]+)"/g)) recursos.add(m[1]);
  // url(...) en CSS es relativa al propio archivo CSS
  for (const m of txt.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) {
    if (/^(data:|https?:|#)/.test(m[1])) continue;
    recursos.add('/' + path.relative(ROOT, path.resolve(path.dirname(f), m[1])));
  }
}
for (const r of recursos) {
  if (!fs.existsSync(path.join(ROOT, r))) { fail(`falta ${r}`); faltan++; }
}
if (!faltan) ok(`${recursos.size} recursos, todos existen`);

console.log('\nEstructura de cada página');
let mal = 0;
for (const f of walk(ROOT, '.html')) {
  if (f.includes('_partials')) continue;
  const h = fs.readFileSync(f, 'utf8');
  const rel = path.relative(ROOT, f);
  const problemas = [];
  if (!/<html[^>]+lang="es"/.test(h)) problemas.push('sin lang="es"');
  if (!/<main id="contenido"/.test(h)) problemas.push('sin <main id="contenido">');
  if (!/class="skip-link"/.test(h)) problemas.push('sin enlace "saltar al contenido"');
  // Sólo el <title> del <head>: los <title> dentro de un SVG son el nombre accesible de cada figura.
  const head = (h.match(/<head>[\s\S]*?<\/head>/) || [''])[0];
  if ((head.match(/<title>/g) || []).length !== 1) problemas.push('título ausente o duplicado');
  if (/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>/.test(h)) problemas.push('script inline (lo bloquearía la CSP)');
  if (/\son[a-z]+="/.test(h)) problemas.push('manejador inline onX= (lo bloquearía la CSP)');
  const og = h.match(/property="og:image" content="([^"]+)"/);
  if (og && !og[1].startsWith('https://')) problemas.push('og:image relativa');
  if (problemas.length) { fail(`${rel}: ${problemas.join(', ')}`); mal++; }
}
if (!mal) ok('todas las páginas cumplen');

console.log(fallos ? `\n${fallos} problema(s).\n` : '\nTodo correcto.\n');
process.exit(fallos ? 1 : 0);
