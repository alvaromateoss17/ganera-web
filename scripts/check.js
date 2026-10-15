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

console.log(fallos ? `\n${fallos} problema(s).\n` : '\nTodo correcto.\n');
process.exit(fallos ? 1 : 0);
