# Cami Assistant

Fase 1 del asistente privado para gestión administrativa de consultantes por WhatsApp.

## Arquitectura Fase 1

- `controllers/`: entrada HTTP mínima.
- `routes/`: rutas Express.
- `services/`: reglas de negocio, confirmaciones e interpretación local de mensajes.
- `repositories/`: acceso a datos desacoplado de Prisma.
- `providers/`: contratos y mocks para WhatsApp, Calendar e IA.
- `prisma/`: schema, migración inicial y seed.
- `simulate.ts`: simulador local de mensajes sin Meta/OpenAI/Google.

En esta fase no se conecta Meta, OpenAI ni Google. Los proveedores externos son interfaces con mocks para que las siguientes fases puedan integrarse sin reescribir el dominio.

## Decisiones técnicas

- Node.js + TypeScript + Express.
- Prisma + PostgreSQL.
- Estado persistente en PostgreSQL, no en memoria de ChatGPT.
- Confirmaciones obligatorias para crear, cancelar, reprogramar, confirmar pagos y guardar notas.
- Zona horaria por configuración: `America/Argentina/Buenos_Aires`.
- El parser local cubre comandos básicos para desarrollo; Fase 2 lo reemplaza por OpenAI Structured Outputs validado por schema.

## Riesgos identificados

- Datos sensibles: evitar logs de notas completas, comprobantes y prompts.
- Idempotencia: webhooks y jobs deben poder repetirse sin duplicar sesiones, mensajes ni eventos.
- Ambigüedad: no resolver nombres u horarios dudosos por adivinanza.
- Cumplimiento legal: antes de producción revisar requisitos aplicables en Argentina, consentimiento, retención, exportación y eliminación.
- Integraciones externas: Meta/Google agregan validación de firma, deduplicación, cuotas y manejo de errores.

## Instalación local

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

En Supabase, reemplazar `[YOUR-PASSWORD]` en `DATABASE_URL` y `DIRECT_URL` por la password de la base. `DATABASE_URL` usa el pooler transaccional para la app y `DIRECT_URL` usa el pooler de sesión para migraciones.

Para usar el simulador:

```bash
npm run simulate -- --from +5491100000000 --text "Agendá a Juan mañana a las 18"
npm run simulate -- --from +5491100000000 --text "Sí"
```

## Endpoints

### `GET /health`

Devuelve estado básico del servidor.

### `POST /dev/messages`

Simula un mensaje entrante sin WhatsApp real.

Body:

```json
{
  "from": "+5491100000000",
  "text": "Agendá a Juan mañana a las 18"
}
```

### `POST /webhooks/whatsapp`

Webhook real para Meta WhatsApp Cloud API.

Meta verifica el endpoint con:

```txt
GET /webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
```

Si `hub.verify_token` coincide con `META_VERIFY_TOKEN`, el backend responde el `hub.challenge`.

Los mensajes reales llegan por:

```txt
POST /webhooks/whatsapp
```

El backend extrae mensajes de texto, imágenes y documentos del payload de Meta, los enruta como mensajes de Cami o consultante, y si `META_ACCESS_TOKEN` + `META_PHONE_NUMBER_ID` están configurados responde por WhatsApp Cloud API.

### `POST /webhooks/whatsapp/dev`

Endpoint legacy de desarrollo con el formato simplificado de Fase 1.

## Configuración de WhatsApp real

En Meta Developers:

1. Crear una app de tipo Business.
2. Agregar el producto WhatsApp.
3. En WhatsApp > API Setup, copiar:
   - `Phone number ID` -> `META_PHONE_NUMBER_ID`
   - `Temporary access token` -> `META_ACCESS_TOKEN` para pruebas
4. Crear un token propio para verificar el webhook, por ejemplo `cami_webhook_2026`, y guardarlo como `META_VERIFY_TOKEN`.
5. Publicar este backend en una URL HTTPS pública.
6. En WhatsApp > Configuration > Webhook:
   - Callback URL: `https://TU-DOMINIO/webhooks/whatsapp`
   - Verify token: el mismo valor de `META_VERIFY_TOKEN`
7. Suscribirse al campo `messages`.

Para producción conviene reemplazar el token temporal por un token permanente de System User desde Meta Business, y revisar permisos de la app antes de pasar a modo Live.

### CRUD local

- `GET /api/clients`
- `GET /api/clients/:id`
- `POST /api/clients`
- `PATCH /api/clients/:id`
- `POST /api/clients/:id/deactivate`
- `GET /api/sessions`
- `GET /api/sessions/:id`
- `POST /api/sessions`
- `PATCH /api/sessions/:id`
- `POST /api/sessions/:id/status`
- `GET /api/session-notes`
- `GET /api/session-notes/:id`
- `POST /api/session-notes`
- `PATCH /api/session-notes/:id`
- `DELETE /api/session-notes/:id`

## Menú guiado para Cami

Cami puede escribir:

```txt
menu
```

Respuesta:

```txt
¿Qué querés hacer?

1. Agendar sesión
2. Confirmar pago
3. Ver próximas sesiones
4. Cancelar o reprogramar
```

Flujo para agendar:

```txt
Cami: 1
Bot: ¿A quién querés agendar?
Cami: Juan
Bot: ¿Para qué día y horario querés agendar a Juan?
Cami: jueves a las 18
Bot: ¿Confirmo la sesión?
```

Flujo para confirmar pago:

```txt
Cami: 2
Bot: ¿De quién querés confirmar el pago?
Cami: Juan
Bot: ¿Confirmás que el pago llegó?
```

Los atajos existentes siguen funcionando, por ejemplo `Agenda a Juan manana a las 18` o `Juan pago`.

El estado del menú y las confirmaciones pendientes se guarda en PostgreSQL (`ConversationState`), así no se pierde si se reinicia el servidor.

## Fase 2 pendiente

- Agregar OpenAI.
- Implementar `parseAdminMessage(text)` con Structured Outputs.
- Validar JSON con schema.
- Mantener resolución de entidades en backend.
- No permitir que el modelo invente IDs.

## Flujo de cancelación/reprogramación simulado

Si un consultante escribe algo como:

```json
{
  "from": "+5491111111111",
  "text": "No puedo ir manana"
}
```

El sistema responde hacia el consultante como si fuera Cami:

```txt
Dale, dejame que lo revise y te confirmo.
```

Y devuelve además una notificación interna para Cami con opciones:

```txt
1. Responder que corresponde abonarla igual
2. Reprogramar como excepción
3. Responder manualmente
```

Cami puede responder desde `ADMIN_PHONE`:

```json
{
  "from": "+5491100000000",
  "text": "1"
}
```

La opción `1` prepara la respuesta automática sobre la política de cancelación de 24 horas. La opción `2` marca la solicitud como excepción para reprogramar. La opción `3` la marca para respuesta manual.

La respuesta automática para cancelaciones dentro de las 24 hs diferencia el estado de pago:

- si todavía no pagó, aclara que corresponde abonar la sesión igualmente porque Cami había separado ese tiempo para esa persona;
- si ya pagó, aclara que no queda saldo a favor por el mismo motivo.

## Flujo de pago confirmado

Cami puede confirmar que el pago llegó con un mensaje como:

```json
{
  "from": "+5491100000000",
  "text": "Juan pago"
}
```

El sistema busca la próxima sesión pendiente de pago y pide confirmación:

```txt
Voy a confirmar el pago de Juan Perez.

¿Confirmás que el pago llegó?
```

Cuando Cami responde `Si`, el sistema:

- cambia la sesión a `PAID`;
- guarda `paymentConfirmedAt`;
- genera un Google Meet mock;
- guarda `googleEventId` y `meetUrl`;
- prepara el mensaje para el consultante con el link.

Mensaje preparado:

```txt
Gracias Juan 😊
Ya quedó confirmado el pago de la sesión.

Te dejo el link para el encuentro:
{meet_url}

Nos vemos el 19/10 a las 18:00.
```

## Flujo de comprobante recibido

Un consultante puede enviar un comprobante en modo simulado usando `media`:

```json
{
  "from": "+5491111111111",
  "media": {
    "providerMediaId": "media-1",
    "mimeType": "image/jpeg"
  }
}
```

El sistema:

- identifica al consultante por teléfono;
- busca su próxima sesión `PAYMENT_PENDING`;
- crea un `PaymentProof` con estado `PENDING`;
- cambia la sesión a `PAYMENT_PROOF_RECEIVED`;
- responde al consultante como Cami:

```txt
Gracias Juan 😊
Recibí el comprobante. Lo reviso y te confirmo.
```

Y genera una notificación interna para Cami:

```txt
Juan Perez envió un comprobante para la sesión 19/10 a las 18:00.

Cuando confirmes que el pago llegó, escribí:
Juan pago
```

## Recordatorios de pago

La regla del scheduler local es:

- enviar el primer recordatorio 48 hs antes de la sesión, a las 10:00 de Argentina;
- si ese recordatorio cae sábado o domingo, adelantarlo al viernes;
- por ejemplo, una sesión de lunes se recuerda el viernes anterior.
- cuando el backend está corriendo, el job se ejecuta en días hábiles a las 9:00 de Argentina; no corre sábados ni domingos.

Para probar el job localmente:

```bash
npm run job:payment-reminders
```

Por ahora usa un proveedor mock de WhatsApp: calcula qué mensajes tocaría enviar, los devuelve por consola y marca `paymentReminderSentAt` para no duplicar recordatorios. El envío automático real empieza cuando conectemos WhatsApp Cloud API.

## Recordatorios de sesión pagada

Cuando una sesión está `PAID` o `CONFIRMED` y tiene `meetUrl`, el sistema puede reenviar el link el día anterior:

```txt
Hola Juan 😊
Te recuerdo que mañana tenemos sesión 19/10 a las 18:00.

Te dejo nuevamente el link:
{meet_url}

Nos vemos mañana.
```

Este recordatorio sí puede salir un domingo si la sesión es lunes. Para probarlo manualmente:

```bash
npm run job:session-reminders
```

El job marca `sessionReminderSentAt` para no duplicar envíos.
