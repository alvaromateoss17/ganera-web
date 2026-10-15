# Seguridad de ganera.es

Qué protege la web, cómo, y qué queda por hacer a mano.

## Cabeceras del navegador (`vercel.json`)

Se aplican a todas las páginas. `npm run dev` aplica **las mismas** en local, así
que si algo choca con ellas falla antes de llegar a producción.

| Cabecera | Para qué |
|---|---|
| `Content-Security-Policy` | Sólo se ejecuta JavaScript servido desde ganera.es. Un script inyectado no corre. |
| `X-Frame-Options: DENY` + `frame-ancestors 'none'` | Nadie puede meter la web dentro de un iframe (clickjacking). |
| `X-Content-Type-Options: nosniff` | El navegador no adivina tipos de archivo. |
| `Referrer-Policy` | A otros dominios sólo les llega `ganera.es`, no la ruta completa. |
| `Permissions-Policy` | Cámara, micrófono, ubicación, pagos del navegador y similares, apagados. |
| `Cross-Origin-Opener-Policy` | Aísla la ventana de las que abre o la abren. |
| `Strict-Transport-Security` | La pone Vercel: siempre HTTPS. |

### La CSP

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self';
frame-ancestors 'none'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests
```

`script-src 'self'` es la parte que importa: la web no tiene ni un script en
línea ni de terceros, y `npm run check` falla si alguien añade uno.

`style-src` permite `'unsafe-inline'` porque el diseño usa unos 200 atributos
`style=""`. El riesgo de CSS inyectado es bajo comparado con el de JavaScript.

**Si añades analítica, un chat o cualquier script de terceros, hay que ampliar
la CSP** con su dominio. Si no, el navegador lo bloqueará en silencio. Y además
hará falta el banner de cookies: ver `legal/cookies.html`, apartado 7.

## Las funciones de `/api` (`api/_lib/guard.js`)

Todo `POST` pasa por `proteger()`:

1. **Mismo origen.** Sólo se aceptan peticiones hechas desde páginas de
   ganera.es (o su www, los previews de Vercel y localhost). Un formulario
   enviado desde otra web, o un bot que llama a la API directamente sin
   navegador, recibe `403`.
2. **Tamaño.** Más de 32 KB → `413`. Un formulario real ocupa menos de 5.
3. **Límite de envíos** por IP → `429` con `Retry-After`:

   | Endpoint | Límite |
   |---|---|
   | `/api/contact`, `/api/demo`, `/api/newsletter` | 5 cada 10 minutos |
   | `/api/checkout` | 20 cada 10 minutos |
   | `/api/checkout-session` (GET) | 30 cada 10 minutos |

4. **Campos de una línea limpios.** Nombre, empresa, email… se quedan sin saltos
   de línea ni caracteres de control, para que no puedan partir el asunto de un
   correo.

### La auto-respuesta de la prueba

Es el punto más delicado: sale un correo **hacia la dirección que alguien
escribe en un formulario**. Sin control, cualquiera podría usar tu dominio para
inundar el buzón de un tercero, y Resend te suspendería la cuenta.

Por eso, además del límite por IP, **se envía como mucho una auto-respuesta por
dirección y hora**, aunque las peticiones lleguen desde IPs distintas.

### El pago

- Con claves `sk_test_` en el dominio real, `/api/checkout` **se niega a cobrar**
  (ver `pagoInseguro()` en `api/_lib/config.js`).
- `/api/checkout-session` sólo devuelve estado, email, plan y fin de la prueba.
  Nada del medio de pago.
- Los datos de la tarjeta nunca pasan por ganera.es: se escriben en Stripe.

## Lo que el límite de envíos NO cubre

El contador vive en la memoria de cada instancia de la función. Vercel reparte
el tráfico entre varias, así que un atacante con muchas IPs y paciencia podría
repartir sus envíos. Detiene la ráfaga típica de un bot, que es el caso real,
pero no es un muro.

**Para un límite global** hay que conectar un almacén compartido:

1. Vercel → Storage → crea una base **Upstash Redis** (tiene plan gratuito).
2. Añade sus variables al proyecto.
3. Sustituye el `Map` de `limitar()` por llamadas a Redis.

No merece la pena hasta que veas abuso real en los logs: busca
`límite alcanzado` y `rechazado: origen ajeno` en Vercel → Logs.

## Secretos

- Ninguna clave en el código. `.env.local` está en `.gitignore`.
- `npm run check` busca claves de Stripe, Resend y webhooks en el código y falla
  si encuentra alguna.
- La clave de Resend es **de sólo envío**: si se filtrara, no daría acceso a tu
  cuenta ni a tus dominios.
- La clave secreta de Stripe es la más sensible. Si alguna vez sospechas que se
  ha filtrado: Stripe → Desarrolladores → Claves de API → **Revocar** y crea otra.

## Pendiente, a mano

- [ ] **Autenticación en dos pasos** en Vercel, GitHub, Stripe, Resend e IONOS.
      Quien entra en cualquiera de esas cuentas controla la web o el dinero.
      Es lo más importante de esta lista.
- [ ] **Alertas de Vercel** por errores en las funciones, para enterarte de un
      fallo antes que un cliente.
- [ ] **HSTS con `includeSubDomains; preload`** (opcional). Antes, asegúrate de
      que **todos** los subdominios de ganera.es funcionan con HTTPS: si alguno no,
      dejará de abrirse. Por eso no lo he activado.
- [ ] Revisar de vez en cuando `npm audit` (hoy: 0 vulnerabilidades).
