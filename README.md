# AltaEntrega

Plataforma de boutiques y delivery en Villa Altagracia. Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase.

## Setup

1. Instala dependencias:
   ```bash
   npm install
   ```
2. Crea un proyecto en [supabase.com](https://supabase.com) y copia `.env.local.example` a `.env.local` con tus credenciales:
   ```bash
   cp .env.local.example .env.local
   ```
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`: en Project Settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY`: solo si necesitas tareas administrativas server-side (no se usa en el código actual).
3. Aplica las migraciones (`supabase/migrations/`), con la [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started):
   ```bash
   supabase link --project-ref <tu-project-ref>
   supabase db push
   ```
   O pégalas en el SQL Editor del dashboard de Supabase, en orden:
   1. `20260916000000_init_schema.sql` — tablas, enums, triggers (auto-agotado de productos, historial de estados de pedido).
   2. `20260916000001_rls_policies.sql` — Row Level Security.
   3. `20260916000002_storage.sql` — buckets `product-photos` y `store-logos` con sus políticas.
4. Levanta el servidor:
   ```bash
   npm run dev
   ```

## Autenticación y roles

- Registro (`/register`): el usuario elige rol — **Cliente**, **Tienda** o **Delivery** (courier) — y se crea en Supabase Auth + tabla `public.users`.
- **Cliente**: pasa directo a `/dashboard/cliente`.
- **Tienda / Delivery**: tras registrarse completan un formulario de perfil (`/complete-profile/tienda` o `/complete-profile/delivery`) que crea su fila en `stores`/`couriers` con `estado = 'pendiente'`, y quedan en `/pending-approval` hasta que un admin cambie el estado a `aprobado` (la BD impide que se autoaprueben).
- `src/middleware.ts` protege todas las rutas por rol y estado de aprobación, redirigiendo automáticamente a donde corresponde.

## Panel de tienda (`/dashboard/tienda`)

- **Productos**: listar, crear, editar y eliminar productos (nombre, descripción, precio, talla, color, stock, foto). Las fotos se suben al bucket `product-photos` de Supabase Storage. Un trigger en la base de datos marca `agotado = true` automáticamente cuando `stock` llega a 0.
- **Perfil**: editar nombre, dirección, categoría y logo de la tienda (bucket `store-logos`).

## Estructura relevante

```
src/
  lib/supabase/       clientes de Supabase (browser, server, middleware), helpers de storage y perfil
  middleware.ts        protección de rutas por rol/estado
  app/(auth)/           login, registro
  app/complete-profile/ formularios de perfil para tienda/delivery
  app/pending-approval/ pantalla de espera de aprobación
  app/dashboard/tienda/ panel de tienda (productos + perfil)
  types/database.ts     tipos de la base de datos (ver nota sobre Row/Insert/Update inline)
supabase/migrations/    SQL versionado
```
