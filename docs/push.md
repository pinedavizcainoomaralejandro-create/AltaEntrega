# Notificaciones push

Las apps de Android e iOS reciben avisos cuando cambia algo que le importa a cada usuario.

| Quién | Cuándo |
|---|---|
| Cliente | Pedido confirmado, en preparación, en camino, entregado o cancelado; transferencia no confirmada |
| Negocio | Pedido nuevo (pagado), transferencia por confirmar, pedido cancelado |
| Repartidor | Pedido nuevo para entregar (si está disponible), pedido cancelado |
| Solicitante | Su solicitud de negocio o repartidor fue aprobada o rechazada |
| Admin | Solicitud nueva o corregida |

Quien hace el cambio no recibe aviso de su propia acción.

## Cómo funciona

1. La app, con la sesión iniciada, pide permiso y guarda el token del teléfono con `register_push_token()` (`src/components/native/PushRegistration.tsx`).
2. Triggers en `orders`, `stores` y `couriers` deciden a quién avisar y llaman a `private.send_push()` (migración `20261005000000_push_notifications.sql`).
3. `send_push()` llama con pg_net a `/api/push/send`, con el secreto de `private.push_config`.
4. La ruta entrega el aviso por Firebase (Android) o APNs (iOS) (`src/lib/push/send.ts`) y borra los tokens de apps desinstaladas.
5. Al tocar el aviso, la app abre la pantalla del pedido o del panel.

## Configuración

### 1. Firebase (Android)

1. En [Firebase](https://console.firebase.google.com) crea un proyecto y agrega una app Android con el paquete `com.altaentrega.app`.
2. Descarga `google-services.json` y ponlo en `android/app/`. No se sube a git (el repositorio es público).
3. En *Configuración del proyecto → Cuentas de servicio*, genera una clave privada. Del JSON copia `project_id`, `client_email` y `private_key` a `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY`.

> Sin `google-services.json`, la app de Android se cierra al registrarse. Por eso el registro solo corre con `NEXT_PUBLIC_PUSH_ENABLED=true` (paso 5).

### 2. APNs (iOS)

Requiere la cuenta de Apple Developer.

1. En *Certificates, Identifiers & Profiles → Keys*, crea una clave con *Apple Push Notifications service (APNs)* y descarga el `.p8`.
2. `APNS_KEY_ID` es el ID de la clave, `APNS_TEAM_ID` el de tu equipo y `APNS_PRIVATE_KEY` el contenido del `.p8`.
3. En Xcode, en *Signing & Capabilities*, elige tu equipo. El proyecto ya trae la capacidad *Push Notifications* (`App/App.entitlements`).
4. `APNS_ENV=sandbox` para builds instalados desde Xcode; `production` para TestFlight y App Store.

### 3. Secreto compartido

Genera uno (`openssl rand -hex 32`) y ponlo en Netlify como `PUSH_WEBHOOK_SECRET`. En el SQL Editor de Supabase:

```sql
insert into private.push_config (dispatch_url, secret)
values ('https://altaentrega.netlify.app/api/push/send', '<el mismo secreto>')
on conflict (id) do update set dispatch_url = excluded.dispatch_url, secret = excluded.secret;
```

Sin esa fila la base de datos no envía nada.

### 4. Variables en Netlify

`PUSH_WEBHOOK_SECRET`, las tres de Firebase y, cuando haya cuenta de Apple, las de APNs. Las funciones de Netlify admiten 4 KB de variables en total: por eso de Firebase se usan solo tres campos y no el JSON entero.

### 5. Activar

Cuando las apps publicadas ya incluyan `google-services.json`, pon `NEXT_PUBLIC_PUSH_ENABLED=true` en Netlify y vuelve a publicar la web. Las apps cargan la web de producción, así que no hace falta publicar una versión nueva de las apps para activarlo.
