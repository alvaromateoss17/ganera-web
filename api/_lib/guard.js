// Defensas comunes de las funciones de /api.
//
//  · mismoOrigen   rechaza peticiones que no vienen de nuestra propia web
//                  (formularios enviados desde otro sitio, bots sin navegador).
//  · limitar       frena ráfagas: N peticiones por ventana y por clave.
//  · tamañoValido  corta cuerpos desproporcionados antes de procesarlos.
//  · linea         limpia campos de una sola línea (asuntos de correo, nombres).
//
// El límite de peticiones vive en la memoria de cada instancia de la función.
// Vercel reparte el tráfico entre varias, así que no es un muro infranqueable,
// pero sí detiene la ráfaga típica de un bot, que cae casi siempre en la misma
// instancia caliente. Para un límite global hace falta un almacén compartido
// (Upstash o Vercel KV): ver docs/SEGURIDAD.md.
const { siteUrl } = require('./config');

const MAX_BODY = 32 * 1024; // 32 KB: un formulario real ocupa menos de 5

/** Hosts desde los que aceptamos peticiones: el dominio, su www, el despliegue
 *  actual de Vercel (previews incluidos) y la máquina local. */
function hostsPermitidos() {
  const h = new Set(['localhost', '127.0.0.1']);
  try {
    const host = new URL(siteUrl()).hostname;
    h.add(host);
    h.add(host.startsWith('www.') ? host.slice(4) : `www.${host}`);
  } catch { /* PUBLIC_SITE_URL mal formada: nos quedamos con el resto */ }
  for (const k of ['VERCEL_URL', 'VERCEL_BRANCH_URL', 'VERCEL_PROJECT_PRODUCTION_URL']) {
    if (process.env[k]) h.add(process.env[k].replace(/^https?:\/\//, '').split('/')[0]);
  }
  return h;
}

function hostDe(valor) {
  try { return new URL(valor).hostname; } catch { return null; }
}

/** true si la petición viene de una página nuestra. Los navegadores mandan
 *  Origin en todo POST hecho con fetch; si falta, miramos Referer. Sin ninguno
 *  de los dos no es un navegador visitando la web, y se rechaza. */
function mismoOrigen(req) {
  const h = req.headers || {};
  const host = hostDe(h.origin) || hostDe(h.referer);
  return Boolean(host) && hostsPermitidos().has(host);
}

/** IP del visitante tal como la entrega Vercel. */
function ipDe(req) {
  const h = req.headers || {};
  return String(h['x-real-ip'] || h['x-forwarded-for'] || '').split(',')[0].trim() || 'desconocida';
}

const cubos = new Map();
let ultimaLimpieza = Date.now();

/** Ventana deslizante. Devuelve 0 si se permite, o los segundos de espera. */
function limitar(clave, max, ventanaMs) {
  const ahora = Date.now();
  // Barrido ocasional para que el mapa no crezca sin fin en instancias longevas.
  if (ahora - ultimaLimpieza > 60_000) {
    for (const [k, marcas] of cubos) {
      if (!marcas.length || ahora - marcas[marcas.length - 1] > 3_600_000) cubos.delete(k);
    }
    ultimaLimpieza = ahora;
  }
  const marcas = (cubos.get(clave) || []).filter((t) => ahora - t < ventanaMs);
  if (marcas.length >= max) {
    cubos.set(clave, marcas);
    return Math.ceil((ventanaMs - (ahora - marcas[0])) / 1000);
  }
  marcas.push(ahora);
  cubos.set(clave, marcas);
  return 0;
}

/** Tamaño del cuerpo, venga ya parseado por Vercel o como texto. */
function tamañoValido(req) {
  const declarado = Number((req.headers || {})['content-length'] || 0);
  if (declarado > MAX_BODY) return false;
  const b = req.body;
  if (typeof b === 'string') return Buffer.byteLength(b) <= MAX_BODY;
  if (b && typeof b === 'object') return Buffer.byteLength(JSON.stringify(b)) <= MAX_BODY;
  return true;
}

/** Campo de una sola línea: fuera saltos y caracteres de control. Evita, por
 *  ejemplo, que un nombre con \r\n acabe partiendo el asunto de un correo. */
const linea = (v, max = 500) =>
  String(v ?? '').replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);

/**
 * Aplica las defensas de un endpoint POST y responde él mismo si hay que
 * cortar. Devuelve true si la petición puede seguir.
 *   limite: { max, ventanaMs, nombre }
 */
function proteger(req, res, limite) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return false;
  }
  if (!mismoOrigen(req)) {
    console.warn(`[${limite.nombre}] rechazado: origen ajeno`, { origin: req.headers.origin, referer: req.headers.referer });
    res.status(403).json({ error: 'Petición no permitida.' });
    return false;
  }
  if (!tamañoValido(req)) {
    res.status(413).json({ error: 'El envío es demasiado grande.' });
    return false;
  }
  const espera = limitar(`${limite.nombre}:${ipDe(req)}`, limite.max, limite.ventanaMs);
  if (espera) {
    console.warn(`[${limite.nombre}] límite alcanzado`, { ip: ipDe(req) });
    res.setHeader('Retry-After', String(espera));
    res.status(429).json({ error: 'Has hecho demasiados envíos seguidos. Espera unos minutos y vuelve a probar.' });
    return false;
  }
  return true;
}

module.exports = { proteger, mismoOrigen, limitar, ipDe, linea, tamañoValido, hostsPermitidos };
