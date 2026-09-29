-- Correcciones de la segunda auditoría:
--
-- 1. Una tienda aprobada ya no puede cambiar su nombre ni su dirección (datos
--    que revisó el admin); sí la categoría y el logo.
-- 2. public.users.email siempre es el correo real de Supabase Auth: el usuario
--    no puede poner otro por la API.
-- 3. "agotado" se recalcula en cualquier update de products, no solo cuando
--    cambia el stock.
-- 4. Límites de precio, stock y largo de textos en products.
-- 5. get_order_contacts: la tienda y el repartidor dejan de ver los teléfonos
--    cuando el pedido ya fue entregado o cancelado.

-- ─────────────────────────────────────────────────────────────
-- 1. Identidad de la tienda aprobada
-- ─────────────────────────────────────────────────────────────

create or replace function public.lock_approved_store_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.current_user_role() = 'admin' then
    return new;
  end if;

  if old.estado = 'aprobado' and (
    new.nombre is distinct from old.nombre
    or new.direccion is distinct from old.direccion
  ) then
    raise exception 'El nombre y la dirección de tu tienda ya fueron verificados. Para cambiarlos, contacta a soporte.';
  end if;

  return new;
end;
$$;

create trigger trg_stores_lock_approved_identity
before update on public.stores
for each row execute function public.lock_approved_store_identity();

-- ─────────────────────────────────────────────────────────────
-- 2. Email sincronizado con Supabase Auth
-- ─────────────────────────────────────────────────────────────

create or replace function public.sync_user_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_email text;
begin
  if auth.uid() is null or public.current_user_role() = 'admin' then
    return new;
  end if;

  select email into v_auth_email from auth.users where id = new.id;
  if v_auth_email is not null then
    new.email := v_auth_email;
  end if;

  return new;
end;
$$;

create trigger trg_users_sync_email
before insert or update on public.users
for each row execute function public.sync_user_email();

-- ─────────────────────────────────────────────────────────────
-- 3. "agotado" en cualquier update
-- ─────────────────────────────────────────────────────────────

drop trigger trg_products_set_agotado on public.products;

create trigger trg_products_set_agotado
before insert or update on public.products
for each row
execute function public.set_product_agotado();

-- ─────────────────────────────────────────────────────────────
-- 4. Límites en products (NOT VALID: no revisa filas existentes, sí las
--    nuevas y las que se editen)
-- ─────────────────────────────────────────────────────────────

alter table public.products
  add constraint products_precio_max check (precio <= 1000000) not valid,
  add constraint products_stock_max check (stock <= 100000) not valid,
  add constraint products_nombre_len check (char_length(nombre) between 1 and 120) not valid,
  add constraint products_descripcion_len check (descripcion is null or char_length(descripcion) <= 1000) not valid,
  add constraint products_talla_len check (talla is null or char_length(talla) <= 40) not valid,
  add constraint products_color_len check (color is null or char_length(color) <= 40) not valid;

-- ─────────────────────────────────────────────────────────────
-- 5. Contactos solo mientras el pedido está activo
-- ─────────────────────────────────────────────────────────────

create or replace function public.get_order_contacts(p_order_id uuid)
returns table (
  cliente_nombre text,
  cliente_telefono text,
  tienda_nombre text,
  tienda_direccion text,
  tienda_telefono text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_es_cliente boolean;
  v_es_admin boolean := public.current_user_role() = 'admin';
  v_ver_telefonos boolean;
begin
  select * into v_order from public.orders where id = p_order_id;

  v_es_cliente := found and v_order.cliente_id = auth.uid();

  if not found or not (
    v_es_cliente
    or v_es_admin
    or exists (select 1 from public.stores s where s.id = v_order.store_id and s.user_id = auth.uid())
    or exists (select 1 from public.couriers c where c.id = v_order.courier_id and c.user_id = auth.uid())
  ) then
    raise exception 'No tienes acceso a este pedido';
  end if;

  -- La tienda y el repartidor solo necesitan los teléfonos mientras el pedido
  -- está en curso.
  v_ver_telefonos := v_es_cliente or v_es_admin or v_order.estado not in ('entregado', 'cancelado');

  return query
  select
    cu.nombre,
    case when v_ver_telefonos then cu.telefono end,
    s.nombre,
    s.direccion,
    case when v_ver_telefonos then su.telefono end
  from public.users cu
  join public.stores s on s.id = v_order.store_id
  join public.users su on su.id = s.user_id
  where cu.id = v_order.cliente_id;
end;
$$;
