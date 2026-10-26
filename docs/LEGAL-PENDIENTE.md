# Pendiente antes de cobrar en real

> ⚠️ **Los textos de `/legal` son un BORRADOR.** Están redactados a medida de Ganera,
> no son una plantilla de relleno, pero **deben ser revisados por un abogado antes de
> empezar a cobrar en real**. Hasta entonces, `CHECKOUT_ENABLED` debe seguir en `false`.
>
> Fuente única de los datos societarios: **`_partials/legal.json`**.
> Tras editarlo, ejecuta `python3 scripts/sync-partials.py` y haz commit.
> Mientras un dato esté vacío, se publica como `[PENDIENTE: …]` en amarillo.

---

## 1. Datos societarios (bloquean la publicación en real)

Todos en `_partials/legal.json`. Aparecen resaltados en `/legal/aviso-legal` y
`/legal/privacidad` hasta que se rellenen.

- [ ] **`razonSocial`** — p. ej. «Ganera Soluciones Ganaderas, S.L.»
- [ ] **`nif`** — NIF/CIF de la sociedad.
- [ ] **`datosRegistrales`** — Registro Mercantil de Cáceres, tomo, folio y hoja.
- [ ] **`domicilio`** — confirmar que el domicilio social coincide con el publicado
      (Polígono Ganadero, Calle A · 10004 Cáceres).
- [ ] **`emailPrivacidad`** — recomendable uno propio (`privacidad@ganera.es`) en lugar
      de reutilizar `agroganera@gmail.com`. Mientras esté vacío se usa el de contacto.
- [ ] **DNI de Antonio Menor** en `titularidadActual`, o eliminar la mención completa
      cuando la sociedad esté inscrita y sea ella la titular.
- [ ] Revisar si, con la sociedad constituida, procede sustituir el buzón de Gmail por
      un correo del dominio: una gestoría lee `@gmail.com` como señal de provisionalidad.

## 2. Verificaciones con proveedores

Reflejar el resultado en `_partials/legal.json` → `subencargados` y volver a sincronizar.

- [ ] **Región de alojamiento de Supabase.** Confirmar que el proyecto está en región
      de la UE (p. ej. `eu-central-1` / `eu-west-1`) y anotarlo. Aparece como
      `[PENDIENTE: confirmar región UE de Supabase]` en `/legal/privacidad` (apartado 6)
      y en `/legal/subencargados`. **Si el proyecto está en EE. UU., hay que migrarlo
      o documentar la transferencia.**
- [ ] **Condiciones comerciales de la API de Anthropic sobre uso de datos.** Verificar
      por escrito que los datos enviados a la API **no se usan para entrenar modelos**
      y cuál es el plazo de retención (retención cero o la que corresponda al plan).
      El compromiso ya está publicado en `/legal/privacidad`, `/legal/subencargados` y
      `/legal/uso-ia`: **si el contrato no lo respalda, hay que corregir los textos.**
- [ ] **Ubicación de los datos de Anthropic** (región de proceso de la API).
- [ ] Confirmar con el abogado el proveedor de IA (hoy Anthropic, en evaluación Mistral) y
      actualizar la tabla de subencargados y uso-ia antes de publicar y de firmar los contratos de
      encargo.
- [ ] **Ubicación de los datos de Twilio** y su configuración de región.
- [ ] **Ubicación de los datos de Resend.**
- [ ] **Adhesión al Marco de Privacidad de Datos UE-EE. UU.** de cada proveedor
      estadounidense. Comprobarlo uno por uno en la lista oficial del Departamento de
      Comercio (dataprivacyframework.gov). **No afirmar la adhesión de nadie sin
      haberla verificado**: los textos están redactados como «cuando el proveedor esté
      adherido» precisamente por esto.
- [ ] **Cláusulas Contractuales Tipo firmadas** con cada proveedor. Guardar copia:
      las páginas legales prometen facilitarlas a quien las pida.
- [ ] **Contrato de encargado del tratamiento (DPA) firmado** con Supabase, Vercel,
      Anthropic, Twilio, Meta, Stripe y Resend.
- [ ] Confirmar la región de despliegue de las funciones de Vercel (el texto publicado
      dice «región de la UE para ganera.es»).

## 3. Revisión jurídica

- [ ] **Revisión por abogado de las siete páginas de `/legal`**, en especial:
      - `/legal/terminos` — límite de responsabilidad, Ley 7/1998, plazos de impago.
      - `/legal/encargo-tratamiento` — art. 28 RGPD, plazo de 48 h para brechas,
        condiciones de auditoría, autorización general de subencargados.
      - `/legal/uso-ia` — calificación del sistema conforme al Reglamento (UE) 2024/1689.
- [ ] **Calificación del sistema de IA bajo el AI Act** antes del **2 de agosto de 2026**.
      El texto sostiene que es un sistema de asistencia con supervisión humana que no
      produce efectos jurídicos automáticos, y que por eso no hay decisión del art. 22
      RGPD. Confirmar esa calificación y si procede algún deber adicional.
- [ ] El abogado debe revisar las frases corregidas del aviso legal (líneas 125, 163, 165), que son
      descripción de producto redactada por nosotros.
- [ ] Confirmar que **no hay derecho de desistimiento** por ser contratación entre
      profesionales, y que el proceso de alta deja constancia de que el cliente actúa
      como profesional.
- [ ] Decidir si se formaliza un **registro de actividades de tratamiento** propio
      (art. 30 RGPD) y si procede una **evaluación de impacto (EIPD)**: se tratan
      documentos de terceros a escala y con IA.
- [ ] Revisar si se necesita **delegado de protección de datos**. Los textos afirman
      que no es obligatorio por el tamaño del proyecto; confirmarlo.
- [ ] Revisar la mención a **corresponsabilidad** entre los dos cofundadores en
      `/legal/privacidad` una vez constituida la sociedad: dejará de aplicar.

## 4. Configuración en el panel de Stripe

- [ ] **Crear los productos y precios** de Base, Gestión y Plus, en mensual y anual,
      con los importes de `_partials/precios.json` (69/690, 169/1690, 329/3290 €),
      **sin IVA incluido**.
- [ ] **Crear el Tax Rate del IVA 21 %** y poner su ID en `STRIPE_TAX_RATE_ID`.
      Alternativa: activar Stripe Tax y quitar esa variable.
- [ ] **Configurar la URL de las condiciones del servicio** en
      Stripe → Configuración → Público → *Terms of service URL* →
      `https://ganera.es/terminos`. **Sin esto, `consent_collection` no funciona** y
      la casilla de aceptación no aparece en el Checkout.
- [ ] Añadir también la URL de la política de privacidad: `https://ganera.es/legal/privacidad`.
- [ ] **Activar los emails automáticos de aviso de fin de prueba**
      (Stripe → Configuración → Facturación → *Subscriptions and emails* →
      «Send trial ending notifications», 3 días antes). Las Condiciones publicadas
      prometen ese aviso, así que es obligatorio activarlo **o** implementarlo en la app
      con el evento `customer.subscription.trial_will_end`.
- [ ] Activar los emails de factura y de pago fallido.
- [ ] Configurar el **Customer Portal** para que el cliente pueda cancelar por sí mismo:
      las Condiciones dicen que se cancela «desde su cuenta».
- [ ] Rellenar los datos fiscales del negocio y el nombre que aparece en el extracto.
- [ ] Verificar que el **webhook de la app** está configurado en la misma cuenta y modo,
      con los eventos de `docs/INTEGRACION-APP.md`.
- [ ] Probar el flujo completo **en modo test** antes de poner `CHECKOUT_ENABLED=true`
      en producción.

## 5. Cookies y analítica

Auditoría realizada el 15 de octubre de 2026: **ganera.es no instala cookies**, no carga
ningún script ni tipografía de terceros, y el único dato en almacenamiento local es la
clave `ganera-cookie-notice` (que has cerrado el aviso). Por eso **no hay banner de
consentimiento**, solo el aviso informativo y la página `/legal/cookies`, conforme al
art. 22.2 de la LSSI y a la Guía de cookies de la AEPD.

- [ ] **Si en el futuro se añade analítica, un chat de soporte, Meta Pixel o cualquier
      script de terceros**: hay que implementar banner con «Aceptar» y «Rechazar» al
      mismo nivel y con la misma visibilidad, más «Configurar»; sin casillas premarcadas;
      sin cargar nada antes del consentimiento; con la elección guardada y un enlace
      permanente en el pie para cambiarla. El apartado 7 de `/legal/cookies` ya anuncia
      ese compromiso.
- [ ] Al activar el checkout, comprobar que la mención a las cookies de
      `checkout.stripe.com` (apartado 5 de `/legal/cookies`) sigue siendo exacta.

## 6. Textos que prometen cosas (hay que cumplirlas)

Estas promesas están publicadas. Si no se van a cumplir, hay que cambiar el texto:

- [ ] **Aviso por email antes de que termine la prueba** (`/legal/terminos`, apartado 4).
- [ ] **Cancelación desde la propia cuenta** (`/legal/terminos`, apartados 4 y 5).
- [ ] **Exportación de datos en 30 días y supresión en 30+90** (`/legal/terminos` 7 y
      `/legal/encargo-tratamiento` 10).
- [ ] **Notificación de brechas en 48 horas** (`/legal/encargo-tratamiento`, apartado 6.6).
- [ ] **Aviso de alta o sustitución de subencargado con 30 días de antelación**
      (`/legal/encargo-tratamiento`, apartado 8).
- [ ] **Cifrado en reposo, registro de accesos y separación lógica por gestoría**
      (`/legal/privacidad`, apartado 10, y `/legal/encargo-tratamiento`, apartado 6.4).
      Verificar que la app lo cumple de verdad.
- [ ] **Aviso de IA en el primer contacto por WhatsApp** (`/legal/uso-ia`, apartado 4).
      Lo implementa la app: ver `docs/INTEGRACION-APP.md`.
- [ ] **Preaviso de 30 días** para cambios de precio y de condiciones
      (`/legal/terminos`, apartados 3 y 12).

## 7. Antes de activar el cobro: lista corta

1. Datos societarios rellenos en `_partials/legal.json` y `sync-partials.py` ejecutado.
2. Ningún `[PENDIENTE: …]` visible en `/legal/aviso-legal` ni `/legal/privacidad`.
3. Textos revisados por un abogado.
4. Productos, precios, Tax Rate, URL de condiciones y emails configurados en Stripe.
5. Webhook de la app funcionando e idempotente, en la misma cuenta de Stripe.
6. Flujo completo probado en modo test, de extremo a extremo.
7. Y entonces, `CHECKOUT_ENABLED=true` en Production.
