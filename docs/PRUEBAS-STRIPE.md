# Probar el cobro de punta a punta, sin dinero real

Todo esto ocurre en el **entorno de prueba** de Stripe. No se cobra nada, no
hay tarjetas reales y puedes repetirlo las veces que quieras.

> **Antes de empezar:** comprueba arriba a la izquierda del panel de Stripe que
> pone «Entorno de prueba». Las claves `sk_test_…` solo funcionan ahí y las
> `sk_live_…` solo en producción. No se mezclan.

---

## 1. Pon la clave en local (no en el chat, no en GitHub)

Crea un archivo `.env.local` en la raíz del proyecto:

```bash
STRIPE_SECRET_KEY=sk_test_…        # Stripe → Claves de API → Clave secreta
CHECKOUT_ENABLED=true
PUBLIC_SITE_URL=http://localhost:3000
APP_LOGIN_URL=https://app.ganera.es/login
```

`.env.local` está en `.gitignore`, así que la clave no se sube. **No la pegues
nunca en un commit ni en una conversación.**

## 2. Crea los productos y los precios

```bash
npm run stripe:setup
```

Lee `_partials/precios.json` y crea en tu cuenta de prueba:

| Producto | Precios |
|---|---|
| Ganera Base | 69 €/mes · 690 €/año |
| Ganera Gestión | 169 €/mes · 1.690 €/año |
| Ganera Plus | 329 €/mes · 3.290 €/año |
| GaneraAI | 49 €/mes |

Más el tipo de IVA del 21 %. **Es idempotente**: los productos llevan id fijo y
los precios una `lookup_key`, así que puedes ejecutarlo mil veces sin duplicar.

**Al terminar escribe los valores en `.env.local` por ti**, así que no tienes
que copiar nada: sólo toca las claves que genera y no pisa tu
`STRIPE_SECRET_KEY` ni el resto del archivo. También las imprime, para que
puedas pegarlas en Vercel cuando toque:

```bash
STRIPE_PRICE_BASE_MENSUAL=price_…
STRIPE_PRICE_BASE_ANUAL=price_…
STRIPE_PRICE_GESTION_MENSUAL=price_…
STRIPE_PRICE_GESTION_ANUAL=price_…
STRIPE_PRICE_PLUS_MENSUAL=price_…
STRIPE_PRICE_PLUS_ANUAL=price_…
STRIPE_PRICE_GANERAI=price_…
STRIPE_TAX_RATE_ID=txr_…
```

Después **reinicia el servidor** para que cargue las variables nuevas:
`Ctrl+C` y `npm run dev`.

## 3. Configura la URL de las condiciones (esto va a mano)

Stripe → **Configuración → Público** → `Terms of service URL`:

```
https://ganera.es/terminos
```

**Hazlo también en el entorno de prueba, no solo en producción.** Sin esto,
`consent_collection` falla, el Checkout no abre y en los logs verás la pista
«PISTA: consent_collection exige la URL de las condiciones…».

Aprovecha y pon la de privacidad: `https://ganera.es/legal/privacidad`.

## 4. Arranca y prueba

```bash
npm run dev          # http://localhost:3000
```

Ejecuta las funciones reales de `/api`, no simulaciones. Verás en consola el
modo de Stripe con el que ha arrancado.

Abre `http://localhost:3000/#planes` y comprueba, por este orden:

1. **Encima de las tarjetas aparece la nota** «15 días de prueba. Se solicita
   tarjeta, pero no se cobra nada hasta el día 16…». Si no sale, es que
   `CHECKOUT_ENABLED` no es `true`.
2. **Cambia a Mensual** y pulsa un plan: el periodo viaja en la petición.
3. El botón pasa a «Abriendo el pago…» y te lleva a `checkout.stripe.com`.

En el Checkout verifica que se ve:

- El precio correcto y el IVA del 21 % aparte.
- **«15 días de prueba»** y que hoy se cobran **0,00 €**.
- La casilla de aceptación de las Condiciones y el Encargo del tratamiento.
- Los campos de NIF/CIF y dirección de facturación.
- El texto «Hoy no se te cobra nada. Al terminar los 15 días…».

## 5. Tarjetas de prueba

| Tarjeta | Qué simula |
|---|---|
| `4242 4242 4242 4242` | Pago correcto |
| `4000 0025 0000 3155` | Pide autenticación 3D Secure |
| `4000 0000 0000 9995` | Fondos insuficientes (rechazo) |
| `4000 0000 0000 0341` | Se acepta pero falla al cobrar después |

Caducidad: cualquier fecha futura (`12/34`). CVC: cualquiera (`123`).
NIF para el campo fiscal: cualquiera con formato válido, p. ej. `B12345678`.

> La tarjeta `4000 0000 0000 0341` es la interesante: deja empezar la prueba y
> **falla el día 16**. Sirve para ver qué pasa con un impago real.

## 6. Qué tiene que ocurrir después

Tras pagar vuelves a `http://localhost:3000/gracias?session_id=cs_test_…`, que
debe mostrar el plan, el email y **la fecha exacta en que termina la prueba**,
en español largo.

Y en el panel de Stripe → **Suscripciones**:

- Estado **`trialing`** (en prueba), no `active`.
- **Importe cobrado: 0,00 €.**
- Fecha de fin de prueba a 15 días.
- En la suscripción, la metadata `plan`, `periodo` y `source: ganera-web`.

Si eso cuadra, el flujo funciona.

## 7. Adelantar el tiempo sin esperar 15 días

Lo más útil de todo. En el entorno de prueba, Stripe permite viajar al futuro:

**Opción A — desde el panel.** En la suscripción, «Acciones» → *Finalizar
periodo de prueba ahora*. Cobra inmediatamente y la pasa a `active`.

**Opción B — con relojes de prueba (*test clocks*).** Crea la suscripción
asociada a un reloj y avanza 14 días para ver el aviso de fin de prueba, y
16 para ver el primer cobro. Es la forma de comprobar que el email de
«tu prueba termina» se envía cuando toca.

## 8. Probar los eventos que consume la app

El webhook **no está en esta web**, está en la app (la que tiene Supabase). Para
probarlo, con el [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
stripe login
stripe listen --forward-to localhost:PUERTO_DE_LA_APP/api/stripe/webhook
stripe trigger checkout.session.completed
stripe trigger customer.subscription.trial_will_end
stripe trigger invoice.payment_failed
```

`stripe listen` imprime un `whsec_…`: es el `STRIPE_WEBHOOK_SECRET` que necesita
la app para verificar la firma. **Es distinto del de producción.**

La lista completa de eventos y lo que debe hacer la app con cada uno está en
[`INTEGRACION-APP.md`](INTEGRACION-APP.md).

## 9. Cuando todo cuadre, pasar a producción

1. Repite los pasos 2 y 3 **con la clave de producción** (`sk_live_…`). Los
   Price ID de producción son **distintos** de los de prueba.
2. Mete las variables en Vercel → Settings → Environment Variables → Production.
3. Déjalo probado con `CHECKOUT_ENABLED=false` y repasa que los CTA siguen
   llevando a `/prueba-15-dias`.
4. Antes de poner `true`, pasa por [`LEGAL-PENDIENTE.md`](LEGAL-PENDIENTE.md):
   datos societarios rellenos, revisión del abogado y emails de fin de prueba
   activados en Stripe.

---

## Si algo falla

| Síntoma | Causa casi segura |
|---|---|
| Los CTA siguen siendo enlaces | `CHECKOUT_ENABLED` no es exactamente `true` |
| 503 «Este plan todavía no se puede contratar» | Falta el Price ID de ese plan y periodo |
| 502 y en el log «terms of service» | Falta la URL de condiciones del paso 3 |
| Vuelve a ganera.es en vez de a localhost | `PUBLIC_SITE_URL` no apunta a localhost |
| `/gracias` muestra el error | El `session_id` no existe o la sesión no se completó |
| «No such price» | Estás mezclando claves de prueba con Price ID de producción |
