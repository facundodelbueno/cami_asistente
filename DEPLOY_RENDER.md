# Deploy en Render

## 1. Subir a GitHub

Crear un repositorio privado y subir este proyecto. No subir `.env`.

## 2. Crear servicio en Render

En Render:

1. New > Web Service.
2. Conectar el repo de GitHub.
3. Elegir el servicio `cami-assistant`.
4. Build command:
   ```bash
   npm ci && npm run render-build
   ```
5. Start command:
   ```bash
   npm start
   ```

Si Render detecta `render.yaml`, puede completar esos campos automáticamente.

## 3. Variables de entorno

Cargar en Render las mismas variables sensibles de `.env`:

```env
DATABASE_URL="..."
DIRECT_URL="..."
META_ACCESS_TOKEN="..."
META_PHONE_NUMBER_ID="1362249673640975"
META_VERIFY_TOKEN="cami_webhook_2026"
ADMIN_PHONE="..."
BUSINESS_WHATSAPP="..."
APP_TIMEZONE="America/Argentina/Buenos_Aires"
PAYMENT_REMINDER_RUN_HOUR="9"
CANCELLATION_POLICY_HOURS="24"
```

No cargar comillas si el panel de Render no las necesita.

## 4. Configurar Meta

Cuando Render entregue una URL como:

```txt
https://cami-assistant.onrender.com
```

En Meta, usar:

```txt
https://cami-assistant.onrender.com/webhooks/whatsapp
```

Token de verificación:

```txt
cami_webhook_2026
```

## 5. Migraciones

La base de Supabase ya tiene las migraciones aplicadas hasta `ConversationState`.

Si se agrega una migración nueva, correr localmente:

```bash
npm run db:apply-migration -- NOMBRE_DE_LA_MIGRACION
```

## Nota sobre plan gratis

En Render free, el servicio puede dormirse si no recibe tráfico. Para recordatorios automáticos confiables conviene pasar a un plan siempre activo o separar los jobs en un cron externo.
