# Ganera Web

Landing de Ganera (trámites ganaderos automáticos para gestorías), implementada a partir del diseño de Claude Design `Ganera Landing.dc.html`.

Es un sitio estático sin dependencias ni paso de build, más dos funciones serverless de Vercel.

## Estructura

```
index.html          Landing completa (hero, app, recorrido, trámites, comparativa, mapa, planes, servicios, FAQ, footer)
prueba-15-dias.html           Formulario "Prueba 15 días" (destino de todos los botones Probar)
contacto.html       Teléfonos, WhatsApp, email y formulario de contacto
nosotros/index.html /nosotros ("Misión" en el menú): historia, misión y visión, valores, equipo
blog/index.html     /blog — listado de artículos
blog/<slug>.html    Un artículo por fichero (la URL queda /blog/<slug>)
legal/aviso-legal.html  /legal/aviso-legal
legal/privacidad.html   /legal/privacidad
legal/cookies.html      /legal/cookies
robots.txt          Indexación + ruta del sitemap
sitemap.xml         Lista de URLs (actualizar al publicar un artículo)
_partials/          Cabecera, footer y navegación legal compartidos (fuente única)
_partials/precios.json    Planes y servicios adicionales (fuente única de precios)
scripts/sync-partials.py  Copia _partials/ a todas las páginas y genera planes/servicios
scripts/precios.py        Plantillas HTML de planes y servicios
css/tokens.css      Sistema de diseño: colores, tipografía Archivo, botones, tags, formularios
css/site.css        Maquetación de cada sección
js/main.js          Animaciones y scroll (reveals, escenas fijadas, marquee, mapa, precios, acordeones, newsletter)
assets/fonts/       Archivo (variable, woff2, servida en local)
assets/img/         Logos rojo/blanco y favicons
api/demo.js         POST /api/demo        → solicitud de prueba
api/newsletter.js   POST /api/newsletter  → suscripción del footer
api/contact.js      POST /api/contact     → formulario de contacto
vercel.json         URLs limpias (/prueba-15-dias), redirecciones legales, caché de assets, cabeceras
```

El mapa de España se generó una vez a SVG estático con la misma proyección Mercator que usaba el diseño (d3 `fitExtent`), así la página no descarga el atlas mundial ni d3.

## Cabecera, footer y navegación legal

Se editan solo en `_partials/header.html`, `_partials/footer.html` y `_partials/legalnav.html`. Después:

```bash
python3 scripts/sync-partials.py
```

Copia su contenido entre los marcadores `<!-- partial:header -->` / `<!-- partial:footer -->` de cada página. Una página nueva solo necesita esos marcadores vacíos.

## Probar en local

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

Los formularios necesitan las funciones de Vercel; en local con `python` mostrarán el mensaje de error. Para probarlos en local: `npx vercel dev`.

## Variables de entorno (Vercel → Settings → Environment Variables)

Sin ellas, los formularios responden OK y los datos se quedan en Vercel → Logs.

| Variable | Uso |
|---|---|
| `RESEND_API_KEY` | Clave de [Resend](https://resend.com) para enviar los avisos por email |
| `LEADS_TO_EMAIL` | Dónde llegan los avisos (varios separados por coma) |
| `LEADS_FROM_EMAIL` | Remitente verificado en Resend, p. ej. `Ganera <web@ganera.es>` |

## Ajustes rápidos

- Intensidad de animación: añade `data-motion="Sutil"` o `data-motion="Sin animación"` a `<html>`.
- Planes y servicios (nombres, ganaderos, precios mensual/anual, servicios adicionales): solo en `_partials/precios.json`. Después ejecuta `python3 scripts/sync-partials.py`, que regenera la sección Planes y Servicios de `index.html` y el selector de plan de `prueba-15-dias.html`.
- Aviso de cookies: lo inyecta `js/main.js` (`initCookieNotice`) y se estiliza en `css/site.css` (`.cookie-notice`). La web no instala cookies; el aviso solo guarda en `localStorage` que lo has cerrado. Si algún día se añade analítica, hay que convertirlo en un banner de consentimiento real y actualizar `legal/cookies.html`.
- Facturación anual marcada por defecto: atributo `checked` del radio `annual` en `index.html`.

## Publicar un artículo en el blog

1. Copia `blog/no-perder-tramites-ganaderos-whatsapp.html` a `blog/<nuevo-slug>.html` y reescribe el contenido.
2. Ajusta `<title>`, `<meta name="description">`, `<link rel="canonical">` y los bloques `application/ld+json`
   (`BlogPosting` y, si el artículo tiene preguntas, `FAQPage`).
3. Añade la tarjeta del artículo en `blog/index.html` dentro de `.post-list`.
4. Añade la URL a `sitemap.xml`.
5. Ejecuta `python3 scripts/sync-partials.py` para que la página nueva reciba cabecera y footer.

La página nueva solo necesita los marcadores `<!-- partial:header -->` / `<!-- partial:footer -->` vacíos.

## Datos legales

Los tres documentos de `legal/` llevan la identificación de los titulares (nombre, DNI, domicilio,
correo y teléfonos). Lo que queda pendiente está marcado en la propia página con la clase `.pending`:

- El DNI de Antonio Menor, en `legal/aviso-legal.html` y `legal/privacidad.html`.
- El nombre de la pasarela de pago, en el apartado 8 de `legal/privacidad.html`.

Si se añade analítica o cualquier script de terceros, hay que actualizar `legal/cookies.html`
y poner un banner de consentimiento: hoy el sitio no instala ninguna cookie.
