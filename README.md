# Ganera Web

Landing de Ganera (trámites ganaderos automáticos para gestorías), implementada a partir del diseño de Claude Design `Ganera Landing.dc.html`.

Es un sitio estático sin paso de build, más varias funciones serverless de Vercel. La única dependencia de npm es el SDK de `stripe`, que usan las funciones de pago.

## Estructura

```
index.html          Landing completa (hero, app, recorrido, trámites, comparativa, mapa, planes, servicios, FAQ, footer)
prueba-15-dias.html           Formulario "Prueba 15 días" (destino de todos los botones Probar)
contacto.html       Teléfonos, WhatsApp, email y formulario de contacto
nosotros/index.html /nosotros ("Misión" en el menú): historia, misión y visión, valores, equipo
blog/index.html     /blog — listado de artículos
blog/<slug>.html    Un artículo por fichero (la URL queda /blog/<slug>)
gracias.html        /gracias — vuelta de Stripe Checkout (noindex)
legal/aviso-legal.html         /legal/aviso-legal
legal/privacidad.html          /legal/privacidad
legal/cookies.html             /legal/cookies
legal/terminos.html            /legal/terminos — condiciones de contratación (B2B)
legal/encargo-tratamiento.html /legal/encargo-tratamiento — art. 28 RGPD
legal/subencargados.html       /legal/subencargados
legal/uso-ia.html              /legal/uso-ia — transparencia AI Act
robots.txt          Indexación + ruta del sitemap
sitemap.xml         Lista de URLs (actualizar al publicar un artículo)
_partials/          Cabecera, footer y navegación legal compartidos (fuente única)
_partials/precios.json    Planes y servicios adicionales (fuente única de precios)
_partials/legal.json      Datos societarios y subencargados (fuente única de la capa legal)
scripts/sync-partials.py  Copia _partials/ a todas las páginas y genera los bloques
scripts/precios.py        Plantillas HTML de planes y servicios
scripts/legal.py          Bloques legales + helper pendiente() de los [PENDIENTE: …]
css/tokens.css      Sistema de diseño: colores, tipografía Archivo, botones, tags, formularios
css/site.css        Maquetación de cada sección
js/main.js          Animaciones y scroll (reveals, escenas fijadas, marquee, mapa, precios, acordeones, newsletter)
assets/fonts/       Archivo (variable, woff2, servida en local)
assets/img/         Logos rojo/blanco y favicons
api/demo.js         POST /api/demo        → solicitud de prueba
api/newsletter.js   POST /api/newsletter  → suscripción del footer
api/contact.js      POST /api/contact     → formulario de contacto
api/checkout.js     POST /api/checkout    → crea la Checkout Session de Stripe
api/checkout-session.js  GET /api/checkout-session → datos mínimos para /gracias
api/config.js       GET  /api/config      → config pública (CHECKOUT_ENABLED, APP_LOGIN_URL)
api/_lib/stripe.js  Cliente de Stripe y lista blanca de planes → Price ID
api/_lib/config.js  Variables de entorno del servidor (URLs, interruptor, días de prueba)
docs/INTEGRACION-APP.md  Para el equipo de la app: eventos de Stripe y aviso de IA
docs/LEGAL-PENDIENTE.md  Todo lo que falta por rellenar antes de cobrar en real
docs/PRUEBAS-STRIPE.md   Cómo probar el cobro de punta a punta sin dinero real
docs/SEGURIDAD.md        Cabeceras, CSP, defensas de la API y lo pendiente a mano
api/_lib/guard.js        Escudo común de /api: origen, tamaño y límite de envíos
404.html                 Página de error propia (Vercel la sirve sola)
docs/CORREO-PRUEBA.md    El correo automático al pedir la prueba y cómo activarlo
api/_lib/emails.js       Plantilla de esa auto-respuesta (edita aquí el texto)
scripts/dev.js           Servidor local con las funciones de /api
scripts/stripe-setup.js  Crea productos y precios en Stripe desde precios.json
scripts/env.js           Carga .env.local sin dependencias
vercel.json         URLs limpias (/prueba-15-dias), redirecciones legales, caché de assets, cabeceras
```

El mapa de España se generó una vez a SVG estático con la misma proyección Mercator que usaba el diseño (d3 `fitExtent`), así la página no descarga el atlas mundial ni d3.

## Cabecera, footer y navegación legal

Se editan solo en `_partials/header.html` y `_partials/footer.html`. La navegación legal y el bloque
«Legal» del pie se generan desde `_partials/legal.json` (ver `scripts/legal.py`). Después:

```bash
python3 scripts/sync-partials.py
```

Copia su contenido entre los marcadores `<!-- partial:header -->` / `<!-- partial:footer -->` de cada página. Una página nueva solo necesita esos marcadores vacíos. Los marcadores también se resuelven dentro de los
propios parciales, así que `footer.html` puede incluir `<!-- partial:foot-legal -->`.

## Comandos

```bash
npm run dev            # servidor local con las funciones de /api reales
npm run check          # hace de build: sintaxis, JSON, secretos, enlaces,
                       # recursos que faltan y estructura de cada página
npm run sync           # = python3 scripts/sync-partials.py
npm run stripe:setup   # crea productos y precios en Stripe desde precios.json
npm run vercel:env     # imprime las variables listas para pegar en Vercel
```

`check` **no** se llama `build` a propósito: Vercel ejecutaría ese script en cada
despliegue y este sitio no necesita compilarse.

## Probar en local

```bash
npm run dev     # http://localhost:3000
```

`scripts/dev.js` sirve el sitio y **ejecuta las funciones reales de `/api`**, con
las URLs limpias y las redirecciones de `vercel.json`, así que los formularios y
el cobro funcionan igual que en producción. Lee la configuración de `.env.local`
(que está en `.gitignore`).

Para servir solo los estáticos, sin funciones, vale `python3 -m http.server 8000`.

## Variables de entorno (Vercel → Settings → Environment Variables)

Sin ellas, los formularios responden OK y los datos se quedan en Vercel → Logs.

| Variable | Uso |
|---|---|
| `RESEND_API_KEY` | Clave de [Resend](https://resend.com) para enviar los avisos por email |
| `LEADS_TO_EMAIL` | Dónde llegan los avisos (varios separados por coma) |
| `LEADS_FROM_EMAIL` | Remitente verificado en Resend, p. ej. `Ganera <hola@ganera.es>` |
| `DEMO_URL`, `MEETING_URL`, `DEMO_LOGIN_URL`… | Bloques opcionales de la auto-respuesta |

Al rellenar el formulario de la prueba salen dos correos: el aviso para vosotros y
una **auto-respuesta al interesado**. Si la segunda falla, la solicitud ya está
registrada y el formulario responde `ok`. Cómo activarla y qué puede (y qué no
puede) incluir, en **`docs/CORREO-PRUEBA.md`**.

Para el cobro con Stripe (ver `.env.example`, que es la referencia completa):

| Variable | Uso |
|---|---|
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe. **Solo servidor**, nunca llega al navegador |
| `STRIPE_PRICE_BASE_MENSUAL` · `_ANUAL` | Price ID del plan Base en cada periodo |
| `STRIPE_PRICE_GESTION_MENSUAL` · `_ANUAL` | Price ID del plan Gestión |
| `STRIPE_PRICE_PLUS_MENSUAL` · `_ANUAL` | Price ID del plan Plus |
| `STRIPE_PRICE_GANERAI` | Price ID del complemento GaneraAI (opcional) |
| `STRIPE_TAX_RATE_ID` | Tax Rate del IVA 21 % creado en Stripe (opcional) |
| `STRIPE_TRIAL_DAYS` | Días de prueba. Por defecto `15` |
| `CHECKOUT_ENABLED` | `true`/`false`. Por defecto `false` |
| `PUBLIC_SITE_URL` | Por defecto `https://ganera.es` |
| `APP_LOGIN_URL` | Login de la web app. Por defecto `https://app.ganera.es/login` |

Los planes de la web son **Base, Gestión y Plus** (`_partials/precios.json`), cada uno con
precio mensual y anual, de ahí que haya un Price ID por plan y periodo.

La web es HTML estático sin paso de compilación, así que **no existe prefijo público**
tipo `NEXT_PUBLIC_`/`VITE_`. `CHECKOUT_ENABLED` y `APP_LOGIN_URL` llegan al navegador a
través de `GET /api/config`, que es el único canal público y no expone ningún secreto.
`STRIPE_SECRET_KEY` jamás sale del servidor.

## Seguridad

La web sale con una **Content Security Policy estricta** (sólo se ejecuta
JavaScript propio), protección contra iframes, y todas las funciones de `/api`
comprueban el origen, el tamaño y el ritmo de las peticiones. El detalle, y lo
que queda por hacer a mano, en **`docs/SEGURIDAD.md`**.

Dos reglas para no romper nada:

- **Nada de `<script>` en línea ni `onclick=""`**: la CSP los bloquea. Todo el
  JavaScript va en `js/main.js`. `npm run check` lo vigila.
- **Si añades un servicio de terceros** (analítica, chat, vídeo), amplía la CSP
  en `vercel.json` con su dominio.

## Cobro con Stripe

El flujo es: CTA de un plan → `POST /api/checkout` → Stripe Checkout → `/gracias`.

**El interruptor es `CHECKOUT_ENABLED`:**

- **`false` (por defecto):** los CTA de los planes se quedan exactamente como están hoy,
  enlaces a `/prueba-15-dias`. `POST /api/checkout` responde `503`. El embudo actual no
  se toca.
- **`true`:** `js/main.js` (`initCheckout`) consulta `/api/config`, convierte los CTA en
  botones que abren Stripe Checkout con el plan y el periodo seleccionados en el selector
  Mensual/Anual, y añade la nota de que la prueba sí pide tarjeta. Es mejora progresiva:
  si `/api/config` falla, los enlaces siguen funcionando como antes.

La prueba es de 15 días **con tarjeta**: `payment_method_collection: "always"` y
`trial_settings.end_behavior.missing_payment_method: "cancel"`. No se cobra nada hasta el
día 16. La landing recoge también el NIF/CIF (`tax_id_collection`) y la dirección de
facturación, porque los clientes son gestorías.

**El webhook de Stripe NO está aquí.** Vive en la web app, que es la que tiene Supabase:
crea la cuenta, invita al usuario por email y gestiona cancelaciones. Lo que la app tiene
que escuchar está en **`docs/INTEGRACION-APP.md`**. Landing y app deben usar la **misma
cuenta de Stripe**.

### Probarlo sin dinero real

**`docs/PRUEBAS-STRIPE.md`** tiene el recorrido completo en el entorno de prueba:
clave en `.env.local`, `npm run stripe:setup` para crear productos y precios,
tarjetas de prueba, cómo adelantar los 15 días con los relojes de prueba y cómo
disparar los eventos del webhook con el Stripe CLI.

Lo que falta por configurar en el panel de Stripe (productos, Tax Rate, URL de
condiciones para que funcione la casilla de aceptación, emails de fin de prueba)
está en **`docs/LEGAL-PENDIENTE.md`**, apartado 4.

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

> ⚠️ Los siete documentos de `legal/` son un **borrador** redactado a medida de Ganera.
> **Deben ser revisados por un abogado antes de cobrar en real.**

**Los datos societarios salen de un único sitio: `_partials/legal.json`.** No los escribas
en el HTML. La sociedad aún no está constituida, así que `razonSocial`, `nif` y
`datosRegistrales` están vacíos y se publican como `[PENDIENTE: …]` resaltado en amarillo
(helper `pendiente()` de `scripts/legal.py`, clase `.pending` en `css/site.css`). Es
deliberado: así es imposible publicar en real sin rellenarlos.

Después de editar el JSON:

```bash
python3 scripts/sync-partials.py
```

Las páginas y qué cubre cada una:

| Página | Norma |
|---|---|
| `/legal/aviso-legal` | LSSI-CE (Ley 34/2002, art. 10) |
| `/legal/privacidad` | RGPD + LOPDGDD. Distingue a Ganera **responsable** de Ganera **encargado** |
| `/legal/cookies` | LSSI art. 22.2 + Guía de cookies de la AEPD |
| `/legal/terminos` | Condiciones de contratación B2B + Ley 7/1998 |
| `/legal/encargo-tratamiento` | Contrato de encargo, art. 28 RGPD |
| `/legal/subencargados` | Proveedores, ubicación de los datos y garantías de transferencia |
| `/legal/uso-ia` | Transparencia del Reglamento (UE) 2024/1689 (AI Act), art. 50 |

**Todo lo que falta por rellenar o verificar está en `docs/LEGAL-PENDIENTE.md`**: datos
societarios, región de Supabase, garantías de cada proveedor, condiciones de la API de
Anthropic sobre uso de datos, revisión por abogado y configuración de Stripe.

### Cookies

Auditoría de octubre de 2026: el sitio **no instala ninguna cookie**, no carga scripts ni
tipografías de terceros, y el único dato en almacenamiento local es la clave
`ganera-cookie-notice`. Por eso hay aviso informativo y no banner de consentimiento.

Si se añade analítica o cualquier script de terceros, hay que actualizar `legal/cookies.html`
y poner un banner de consentimiento real: «Aceptar» y «Rechazar» al mismo nivel y con la
misma visibilidad, más «Configurar», sin casillas premarcadas y sin cargar nada antes del
consentimiento.
