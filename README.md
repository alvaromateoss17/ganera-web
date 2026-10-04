# Ganera Web

Landing de Ganera (trámites ganaderos automáticos para gestorías), implementada a partir del diseño de Claude Design `Ganera Landing.dc.html`.

Es un sitio estático sin dependencias ni paso de build, más dos funciones serverless de Vercel.

## Estructura

```
index.html          Landing completa (hero, app, recorrido, trámites, comparativa, mapa, planes, servicios, FAQ, footer)
demo.html           Formulario "Prueba 15 días" (destino de todos los botones Probar)
contacto.html       Teléfonos, WhatsApp, email y formulario de contacto
nosotros/index.html /nosotros: historia, misión y visión, valores, equipo
nosotros/equipo.html   /nosotros/equipo: fichas de los cofundadores
nosotros/valores.html  /nosotros/valores: misión, visión y valores
_partials/          Cabecera y footer compartidos (fuente única)
scripts/sync-partials.py  Copia _partials/ a todas las páginas
css/tokens.css      Sistema de diseño: colores, tipografía Archivo, botones, tags, formularios
css/site.css        Maquetación de cada sección
js/main.js          Animaciones y scroll (reveals, escenas fijadas, marquee, mapa, precios, acordeones, newsletter)
assets/fonts/       Archivo (variable, woff2, servida en local)
assets/img/         Logos rojo/blanco y favicons
api/demo.js         POST /api/demo        → solicitud de prueba
api/newsletter.js   POST /api/newsletter  → suscripción del footer
api/contact.js      POST /api/contact     → formulario de contacto
vercel.json         URLs limpias (/demo), caché de assets, cabeceras
```

El mapa de España se generó una vez a SVG estático con la misma proyección Mercator que usaba el diseño (d3 `fitExtent`), así la página no descarga el atlas mundial ni d3.

## Cabecera y footer

Se editan solo en `_partials/header.html` y `_partials/footer.html`. Después:

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
- Precios: atributo `data-plan` (precio mensual) de cada plan en `index.html`; el anual se calcula como 10 meses.
- Facturación anual marcada por defecto: atributo `checked` del radio `annual`.
