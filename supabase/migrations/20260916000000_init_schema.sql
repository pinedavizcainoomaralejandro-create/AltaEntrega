-- AltaEntrega: esquema inicial
-- Tablas: users, stores, products, couriers, orders, order_items, order_status_history

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────

create type user_role as enum ('cliente', 'tienda', 'courier', 'admin');
create type approval_status as enum ('pendiente', 'aprobado', 'rechazado');
create type order_status as enum (
  'pendiente',
  'confirmado',
  'preparando',
  'en_camino',
  'entregado',
  'cancelado'
);
create type payment_method as enum ('efectivo', 'tarjeta', 'transferencia');

-- ─────────────────────────────────────────────────────────────
-- USERS  (perfil aplicación, 1:1 con auth.users)
-- ─────────────────────────────────────────────────────────────

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  rol user_role not null,
  nombre text not null,
  telefono text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- STORES  (boutiques)
-- ─────────────────────────────────────────────────────────────

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  nombre text not null,
  direccion text not null,
  categoria text not null,
  logo text,
  estado approval_status not null default 'pendiente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- ─────────────────────────────────────────────────────────────
-- PRODUCTS
-- ─────────────────────────────────────────────────────────────

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  nombre text not null,
  descripcion text,
  precio numeric(10, 2) not null check (precio >= 0),
  talla text,
  color text,
  stock integer not null default 0 check (stock >= 0),
  foto text,
  agotado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_store_id_idx on public.products (store_id);

-- Marca el producto como agotado automáticamente cuando stock llega a 0
create or replace function public.set_product_agotado()
returns trigger
language plpgsql
as $$
begin
  new.agotado := (new.stock <= 0);
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_products_set_agotado
before insert or update of stock on public.products
for each row
execute function public.set_product_agotado();

-- ─────────────────────────────────────────────────────────────
-- COURIERS  (repartidores)
-- ─────────────────────────────────────────────────────────────

create table public.couriers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  vehiculo text not null,
  documento_identidad text not null,
  estado approval_status not null default 'pendiente',
  disponible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- ─────────────────────────────────────────────────────────────
-- ORDERS
-- ─────────────────────────────────────────────────────────────

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.users (id) on delete restrict,
  store_id uuid not null references public.stores (id) on delete restrict,
  courier_id uuid references public.couriers (id) on delete set null,
  estado order_status not null default 'pendiente',
  direccion_entrega text not null,
  total numeric(10, 2) not null check (total >= 0),
  metodo_pago payment_method not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_cliente_id_idx on public.orders (cliente_id);
create index orders_store_id_idx on public.orders (store_id);
create index orders_courier_id_idx on public.orders (courier_id);

-- ─────────────────────────────────────────────────────────────
-- ORDER ITEMS
-- ─────────────────────────────────────────────────────────────

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  cantidad integer not null check (cantidad > 0),
  precio_unitario numeric(10, 2) not null check (precio_unitario >= 0)
);

create index order_items_order_id_idx on public.order_items (order_id);

-- ─────────────────────────────────────────────────────────────
-- ORDER STATUS HISTORY
-- ─────────────────────────────────────────────────────────────

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  estado order_status not null,
  fecha timestamptz not null default now()
);

create index order_status_history_order_id_idx on public.order_status_history (order_id);

-- Registra automáticamente cada cambio de estado del pedido
create or replace function public.log_order_status_change()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') or (new.estado is distinct from old.estado) then
    insert into public.order_status_history (order_id, estado)
    values (new.id, new.estado);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_orders_log_status_insert
after insert on public.orders
for each row
execute function public.log_order_status_change();

create trigger trg_orders_log_status_update
before update of estado on public.orders
for each row
execute function public.log_order_status_change();

-- ─────────────────────────────────────────────────────────────
-- updated_at genérico para users/stores/couriers
-- ─────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger trg_stores_updated_at
before update on public.stores
for each row execute function public.set_updated_at();

create trigger trg_couriers_updated_at
before update on public.couriers
for each row execute function public.set_updated_at();
