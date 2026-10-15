# El correo automático al pedir la prueba

Cuando alguien rellena el formulario de `/prueba-15-dias` salen **dos correos**:

1. **El aviso para vosotros**, a `LEADS_TO_EMAIL`, con los datos del lead. Ya existía.
2. **La respuesta automática al interesado**, nueva. Confirma la solicitud, dice
   qué pasa ahora y le da atajos.

Si el segundo falla, el primero ya se ha enviado y el formulario responde `ok`:
una solicitud **nunca se pierde** porque el correo de cortesía no salga.

---

## El problema de fondo, dicho claro

**La landing no puede crear cuentas de la app.** No tiene base de datos ni acceso
a Supabase: es HTML estático con cuatro funciones. Quien crea usuarios es la web
app. Así que un correo automático **no puede mandar «las claves de la prueba»**,
porque esas claves no existen todavía cuando el formulario se envía.

Hay tres formas de resolverlo. Puedes combinarlas.

### Opción A — Aviso + llamada (lo que está implementado)

El correo confirma la solicitud y dice que llamáis en 24 h laborables. Vosotros
creáis la cuenta a mano y la app envía la invitación.

- ✅ Funciona hoy, sin depender de la app.
- ✅ Cualifica al cliente: hablas con él antes de darle acceso.
- ✅ Es lo normal en SaaS B2B con onboarding, que es vuestro caso.
- ❌ No es instantáneo.

### Opción B — Autoservicio con tarjeta (ya construido)

El correo incluye un botón **«Empezar la prueba ahora»** que lleva a los planes.
El cliente paga con tarjeta, no se le cobra nada, y **el webhook de la app le
manda la invitación de Supabase automáticamente**.

- ✅ **Es el único camino 100 % automático que da credenciales reales.**
- ✅ Ya está hecho: sólo falta activar `CHECKOUT_ENABLED` y el webhook en la app.
- ❌ Pedir tarjeta filtra: entran menos, pero los que entran valen más.

### Opción C — Cuenta de demostración compartida

Una cuenta fija con datos ficticios cuyas credenciales van en el correo.

- ✅ Satisfacción inmediata, sin tarjeta y sin esperar.
- ❌ **Es una cuenta compartida**: todos ven y tocan lo mismo.
- ❌ Si alguien mete datos reales de un ganadero, tienes un problema de RGPD.
- ❌ Hay que resetearla cada noche o acaba hecha un desastre.

Si la montas: **solo datos inventados**, rol de solo lectura si la app lo permite,
y reseteo automático cada noche. El correo ya avisa de que no metan datos reales.

### Lo que yo haría

**A + B.** El correo dice que llamáis, y debajo ofrece el botón de empezar ya
para quien no quiera esperar. Es exactamente lo que está implementado. La C solo
si veis que mucha gente pide la prueba y se enfría esperando la llamada.

---

## Poner en marcha el envío (Resend, 20 minutos)

Hoy no se envía nada: sin `RESEND_API_KEY`, los correos solo se escriben en
Vercel → Logs. Para activarlo:

### 1. Crea la cuenta

[resend.com](https://resend.com) → plan gratuito: 3.000 correos al mes y 100 al
día. De sobra para empezar.

### 2. Verifica el dominio

Resend → **Domains** → *Add Domain* → `ganera.es`. Te da unos registros DNS que
hay que añadir donde tengas el dominio:

| Tipo | Para qué |
|---|---|
| `MX` + `TXT` (SPF) | Autoriza a Resend a enviar en tu nombre |
| `TXT` (DKIM) | Firma los correos para que no caigan en spam |
| `TXT` (DMARC) | Recomendado: política de qué hacer con los que no pasen |

Tarda entre minutos y unas horas en propagar.

> **No te saltes este paso.** Sin dominio verificado solo puedes enviar desde
> `onboarding@resend.dev`, y un correo de ventas desde esa dirección va derecho a
> spam. Un cliente que no recibe la respuesta es un cliente perdido.

### 3. Crea la clave de API

Resend → **API Keys** → *Create*. Permiso de solo envío (*Sending access*).

### 4. Configura las variables en Vercel

Settings → Environment Variables → Production:

```
RESEND_API_KEY=re_…
LEADS_TO_EMAIL=agroganera@gmail.com
LEADS_FROM_EMAIL=Ganera <hola@ganera.es>
```

`LEADS_FROM_EMAIL` tiene que usar el dominio que has verificado en el paso 2.

### 5. Opcionales, según lo que tengas

```
DEMO_URL=https://…              # vídeo de 2-3 minutos enseñando el producto
MEETING_URL=https://cal.com/…   # enlace de reserva de cita
DEMO_LOGIN_URL=https://app.ganera.es/login   # cuenta de demostración (opción C)
DEMO_USER=demo@ganera.es
DEMO_PASS=…
```

**Cada bloque aparece en el correo solo si su variable está puesta.** Sin
ninguna, el correo sigue teniendo sentido: confirma la solicitud y ofrece
empezar la prueba.

### 6. Pruébalo

```bash
# en .env.local
RESEND_API_KEY=re_…
LEADS_TO_EMAIL=tu@correo.es
LEADS_FROM_EMAIL=Ganera <hola@ganera.es>

npm run dev
```

Rellena el formulario en `http://localhost:3000/prueba-15-dias` con **tu propio
correo** y mira que llegan los dos. Revisa también la carpeta de spam: si cae
ahí, falta DNS del paso 2.

---

## Editar el texto del correo

Está en **`api/_lib/emails.js`**, en la función `bloques()`. Cada bloque tiene
título, texto y botón opcional. Si cambias el HTML, cambia también `texto()`:
algunos clientes de correo leen la versión en texto plano.

El pie ya incluye la información de protección de datos que exige el RGPD y el
enlace a la política de privacidad. **No lo quites.**

## Lo que viene después (los 15 días)

Este correo es solo el primero. Para la secuencia de seguimiento —día 3, día 7,
aviso de que la prueba acaba— lo razonable no es programarlo en la landing, sino:

- **Si el cliente entró por Stripe**: los eventos `customer.subscription.trial_will_end`
  y `invoice.paid` ya los recibe la app. Ver [`INTEGRACION-APP.md`](INTEGRACION-APP.md).
- **Si entró por el formulario**: llevadlo vosotros en un CRM sencillo, aunque sea
  una hoja de cálculo con la fecha de inicio y la de fin. Las llamadas las vais a
  hacer a mano igualmente, que es donde se cierra el cliente.
