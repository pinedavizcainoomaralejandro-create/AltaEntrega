# AltaEntrega

Plataforma de boutiques y delivery en Villa Altagracia. Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS + Supabase (Auth, Postgres con RLS, Storage y Realtime).

## Setup

Requiere Node.js 20.9 o superior.

1. Instala dependencias:
   ```bash
   npm install
   ```
2. Crea un proyecto en [supabase.com](https://supabase.com) y copia `.env.local.example` a `.env.local` con tus credenciales (Project Settings → API):
   ```bash
   cp .env.local.example .env.local
   ```
   La app solo usa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No guardes la `service_role` key en `.env.local`: el código no la necesita y da acceso total a la base.
3. Aplica las migraciones de `supabase/migrations/` con la [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), desde la carpeta del proyecto:
   ```bash
   supabase login
   supabase link --project-ref <tu-project-ref>
   supabase db push
   ```
   Si prefieres el SQL Editor del dashboard, pega todos los archivos en orden de nombre (el prefijo es la fecha).
4. Levanta el servidor:
   ```bash
   npm run dev
   ```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en http://localhost:3000 |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sin emitir archivos |
| `npm test` | Pruebas unitarias (Vitest): validaciones, carrito, mensajes de error |
| `npm run test:db` | Aplica todas las migraciones en un Postgres local temporal y prueba las reglas de negocio y seguridad (`tests/db/checks.sql`). Requiere `psql`/`createdb`. |
| `npm run gen:types` | Genera `src/types/supabase.ts` desde el proyecto enlazado |

El workflow `.github/workflows/ci.yml` corre lint, typecheck, pruebas, build y las pruebas de base de datos en cada push y pull request.

## Roles y flujo

- **Registro** (`/register`): el usuario elige **Cliente**, **Tienda** o **Delivery**. La base impide registrarse como admin o cambiarse el rol.
- **Tienda / Delivery**: completan su perfil (`/complete-profile/...`) y quedan en `/pending-approval` hasta que un admin los apruebe. Si los rechaza, pueden corregir sus datos y reenviar la solicitud. Un repartidor aprobado ya no puede cambiar su cédula, matrícula ni vehículo.
- **Cliente**: navega el catálogo, arma un carrito de una sola tienda y hace el checkout. El carrito compara precio y stock con la base al abrirlo.
- `src/proxy.ts` (antes `middleware.ts`) protege las rutas por rol y estado de aprobación. Todas las pantallas tienen un enlace **Inicio**.

### Estados de un pedido

| Estado | Quién lo avanza |
|---|---|
| `pendiente` → `confirmado` → `preparando` | La tienda (`store_advance_order`) |
| `preparando` → `en_camino` → `entregado` | El repartidor asignado (`advance_order_status`) |

- Los repartidores ven en la bolsa los pedidos ya **confirmados** sin repartidor y los aceptan con `claim_order` (atómico: si dos aceptan a la vez, solo uno lo obtiene).
- **Cancelación** (`cancel_order`, devuelve el stock): el cliente mientras está `pendiente`; la tienda antes de `en_camino`; el admin mientras no esté `entregado`.
- Cada cambio queda en `order_status_history` y se ve en vivo con Supabase Realtime.
- Los pedidos solo se escriben a través de esas funciones SQL (`SECURITY DEFINER`); no hay inserts ni updates directos desde la API.

## Paneles

- **Tienda** (`/dashboard/tienda`): pedidos en vivo (confirmar, preparar, cancelar, ver productos y contacto del cliente), productos (fotos en Storage; los que ya tienen ventas se ocultan en vez de borrarse) y perfil de la tienda.
- **Delivery** (`/dashboard/delivery`): disponibilidad, bolsa de pedidos con dirección de recogida y de entrega, y mis entregas con productos y contactos.
- **Admin** (`/admin`): métricas (en hora de República Dominicana), aprobación de tiendas y repartidores, y tabla paginada de pedidos con cancelación.

## Estructura

```
src/
  proxy.ts              protección de rutas por rol/estado
  lib/supabase/         clientes de Supabase (browser, server, proxy), storage, perfil
  lib/validation.ts     validaciones compartidas (teléfono, contraseña, cédula, búsqueda...)
  lib/errors.ts         mensajes de error en español para el usuario
  lib/cart/             carrito (contexto + reconciliación con la base)
  app/(auth)/           login, registro, recuperar contraseña
  app/(catalog)/        catálogo, tienda, carrito, mis pedidos
  app/complete-profile/ solicitudes de tienda y repartidor
  app/dashboard/        paneles de tienda y delivery
  app/admin/            panel de administrador
  types/database.ts     tipos de la base de datos
supabase/migrations/    SQL versionado (esquema, RLS, funciones)
tests/                  pruebas unitarias y de base de datos
```
