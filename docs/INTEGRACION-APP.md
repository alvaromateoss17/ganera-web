# Integración landing ↔ web app de Ganera

Documento para el equipo de la web app (la que tiene Supabase). Cubre dos cosas:

1. **Stripe**: qué crea la landing y qué eventos tiene que escuchar la app.
2. **Aviso de IA en WhatsApp**: el texto que la app debe enviar al primer contacto con cada ganadero.

> **Requisito previo:** la landing y la app deben usar **la MISMA cuenta de Stripe**
> (y el mismo modo: test con test, live con live). Si no, la app no encontrará las
> sesiones ni las suscripciones que crea la landing.

---

## 1. Stripe

### Qué hace la landing

`POST /api/checkout` crea una **Checkout Session** y devuelve `{ url }`. La landing
redirige el navegador a esa URL. **No toca la base de datos y no implementa webhook.**

Configuración de la sesión:

| Campo | Valor |
|---|---|
| `mode` | `subscription` |
| `line_items` | el Price del plan y periodo elegidos |
| `subscription_data.trial_period_days` | `STRIPE_TRIAL_DAYS` (15) |
| `subscription_data.trial_settings.end_behavior.missing_payment_method` | `cancel` |
| `payment_method_collection` | `always` → **la tarjeta se pide sí o sí al empezar la prueba** |
| `tax_id_collection` | activado → se recoge el NIF/CIF de la gestoría |
| `billing_address_collection` | `required` |
| `consent_collection.terms_of_service` | `required` |
| `locale` | `es` |
| `allow_promotion_codes` | `true` |
| `success_url` | `https://ganera.es/gracias?session_id={CHECKOUT_SESSION_ID}` |
| `cancel_url` | `https://ganera.es/#planes` |

### Metadata que llega

Va **tanto en la Checkout Session como en la Subscription**, así que está disponible
en todos los eventos posteriores:

```json
{
  "plan": "base" | "gestion" | "plus",
  "periodo": "mensual" | "anual",
  "prueba": "true" | "false",
  "source": "ganera-web"
}
```

`source: "ganera-web"` sirve para distinguir las altas que vienen de la landing de
las que se creen desde el panel de administración o a mano en Stripe.

> ⚠️ **`prueba` puede ser `"false"`.** Los planes tienen dos botones: «Probar»,
> que abre la suscripción con 15 días de prueba, y «Contratar ahora», para quien
> ya conoce Ganera y no quiere esperar. En ese segundo caso **no hay
> `trial_period_days`**: la suscripción nace en `active`, no en `trialing`, y se
> cobra el primer periodo al confirmar.
>
> La app no debe asumir que toda alta viene con prueba. En concreto:
> no esperes un `customer.subscription.trial_will_end` que nunca llegará, y
> si cuentas los días de prueba para la secuencia de seguimiento, mira
> `metadata.prueba` o `subscription.status` antes.
>
> Es un string, no un booleano: los metadata de Stripe solo admiten texto.

### Eventos que la app DEBE escuchar

| Evento | Qué tiene que hacer la app |
|---|---|
| `checkout.session.completed` | **Alta completa.** Crear la gestoría con los datos de `customer_details` (nombre, email, dirección de facturación, `tax_ids`) y el plan de `metadata.plan`. Crear el usuario e invitarlo por email con Supabase Auth `inviteUserByEmail`, con `redirectTo` apuntando a `APP_LOGIN_URL`. Guardar `customer`, `subscription` y `metadata`. Llega igual con prueba y sin ella. |
| `customer.subscription.updated` | Cambios de plan, de periodo o de estado (`trialing` → `active`, `past_due`, `paused`). Sincronizar el plan y los límites de la cuenta. |
| `customer.subscription.deleted` | Baja. Cerrar el acceso según las Condiciones: 30 días para exportar y después supresión. Ver `/legal/terminos`, apartado 7. |
| `customer.subscription.trial_will_end` | Llega **3 días antes** del fin de la prueba. Avisar a la gestoría por email con la fecha y el importe del primer cargo. **Las Condiciones publicadas prometen este aviso: es obligatorio.** No llega en las altas con `metadata.prueba = "false"`. |
| `invoice.payment_failed` | Impago. Avisar por email. Según `/legal/terminos` apartado 6: suspensión a los 15 días, resolución a los 60. |
| `invoice.paid` | Cobro correcto. Guardar la factura y, si estaba suspendida, reactivar la cuenta. |

### Requisitos del webhook

- **Verificar la firma** con `STRIPE_WEBHOOK_SECRET` (`stripe.webhooks.constructEvent`)
  sobre el **cuerpo crudo** de la petición. Sin esto, cualquiera puede dar de alta cuentas.
- **Ser idempotente**: guardar cada `event.id` procesado en una tabla y descartar los
  repetidos. Stripe reintenta y reenvía.
- Responder `2xx` rápido y hacer el trabajo pesado en segundo plano; si falla, devolver
  `5xx` para que Stripe reintente.
- Los eventos pueden llegar **desordenados**: usar siempre el estado que trae el objeto
  del evento, no asumir una secuencia.

### Email de activación

El flujo que la página `/gracias` le promete al usuario es:

> «Te hemos enviado un email a **{email}** para activar tu cuenta y crear tu contraseña.»

Es decir, **la app debe enviar la invitación al recibir `checkout.session.completed`**.
La landing no envía nada. El botón «Entrar en Ganera» de `/gracias` apunta a
`APP_LOGIN_URL` con `?email=` precargado.

### Para comprobar desde /gracias

`GET /api/checkout-session?session_id=cs_...` devuelve solo `status`, `email`, `plan`,
`planNombre`, `periodo` y `trialEnd`. No expone identificadores internos completos ni
nada relativo al medio de pago. No lo necesita la app, es solo para la página de gracias.

---

## 2. Aviso de IA en el primer contacto por WhatsApp

Lo exige el artículo 50 del **Reglamento (UE) 2024/1689 (AI Act)**, aplicable desde el
**2 de agosto de 2026**: hay que informar a la persona de que interactúa con un sistema
de IA. **Lo implementa la app**, que es la que tiene el canal de WhatsApp. La landing
solo lo publica en `/legal/uso-ia` para que cualquier gestoría pueda comprobar qué se
dice a sus clientes.

Texto a enviar, tal cual:

```
Hola, soy el asistente automático de Ganera para tu gestoría. Soy un sistema de
inteligencia artificial: leo tus mensajes y documentos para preparar tus trámites,
y una persona de tu gestoría los revisa siempre antes de presentarlos.
Más información: ganera.es/uso-ia
```

Reglas de envío, tal como están publicadas en `/legal/uso-ia`:

- **Una vez por ganadero**, en el primer contacto, antes de procesar su primer mensaje.
- **Volver a enviarlo** si el texto cambia de forma relevante.
- Responder con el mismo aviso cuando el ganadero escriba **«información»** al número.
- Guardar en la base de datos la marca de que se ha enviado y cuándo: es la prueba del
  cumplimiento.

Si cambias el texto, cámbialo también en `/legal/uso-ia` (apartado 4) y en este
documento. Lo que se publica y lo que se envía tienen que coincidir.

---

## 3. El correo de la solicitud de prueba

Quien rellena el formulario de `/prueba-15-dias` **no entra por Stripe**: es un
lead, no un cliente. La landing le manda una auto-respuesta y el alta la hacéis
vosotros a mano, o entra él solo por el checkout.

Si la app acaba creando cuentas de prueba sin pasar por Stripe, el correo de
invitación de Supabase debe seguir saliendo igual. Ver `docs/CORREO-PRUEBA.md`.

## 4. Lo que NO hace la landing

Para que no se dupliquen responsabilidades:

- No implementa webhook de Stripe.
- No crea usuarios ni gestorías.
- No envía el email de activación.
- No gestiona cancelaciones ni cambios de plan.
- No tiene acceso a Supabase.

Todo eso vive en la app.
