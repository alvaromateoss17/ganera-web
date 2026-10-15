// Carga .env.local (o el archivo que se indique) en process.env sin dependencias.
// Nunca sobrescribe una variable que ya venga del entorno.
const fs = require('fs');
const path = require('path');

function cargar(archivo = '.env.local') {
  const ruta = path.join(__dirname, '..', archivo);
  if (!fs.existsSync(ruta)) return false;
  for (const linea of fs.readFileSync(ruta, 'utf8').split('\n')) {
    const t = linea.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const clave = t.slice(0, i).trim();
    let valor = t.slice(i + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    if (!(clave in process.env)) process.env[clave] = valor;
  }
  return true;
}

module.exports = { cargar };
