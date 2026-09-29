-- Correcciones de la tercera auditoría:
--
-- 1. Los pedidos sin pagar se expiran cada 5 minutos con pg_cron (antes solo
--    al hacer otro checkout, y el stock podía quedar reservado por horas).
-- 2. Máximo 2 pedidos esperando pago por cliente (evita acaparar stock).
-- 3. La tienda y el repartidor no ven teléfonos de pedidos sin pagar.
-- 4. Código de pedido aleatorio para mostrar a los usuarios; el número
--    correlativo queda solo para AZUL y el admin.
-- 5. Casts explícitos a order_status (avisos del linter de Supabase).

-- ─────────────────────────────────────────────────────────────
-- 1. Expiración automática
-- ─────────────────────────────────────────────────────────────

do $do$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;

    if exists (select 1 from cron.job where jobname = 'expire-unpaid-orders') then
      perform cron.unschedule('expire-unpaid-orders');
    end if;

    perform cron.schedule(
      'expire-unpaid-orders',
      '*/5 * * * *',
      'select public.expire_unpaid_orders()'
    );
  else
    raise notice 'pg_cron no está disponible: los pedidos sin pagar solo expiran al hacer checkout';
  end if;
end
$do$;

-- ─────────────────────────────────────────────────────────────
-- 2. Límite de pedidos sin pagar
-- ─────────────────────────────────────────────────────────────

create or replace function public.checkout(
  p_store_id uuid,
  p_direccion_entrega text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid := auth.uid();
  v_order_id uuid;
  v_rate numeric;
  v_fee numeric(10, 2);
  v_subtotal numeric(10, 2) := 0;
  v_monto_tienda numeric(10, 2) := 0;
  v_precio_cliente numeric(10, 2);
  v_item jsonb;
  v_product public.products%rowtype;
  v_cantidad integer;
begin
  if v_cliente_id is null or public.current_user_role() <> 'cliente' then
    raise exception 'Solo un cliente autenticado puede completar un pedido';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío';
  end if;

  if jsonb_array_length(p_items) > 50 then
    raise exception 'El carrito no puede tener más de 50 productos distintos';
  end if;

  if p_direccion_entrega is null or btrim(p_direccion_entrega) = '' then
    raise exception 'Ingresa la dirección de entrega';
  end if;

  if length(p_direccion_entrega) > 300 then
    raise exception 'La dirección de entrega es demasiado larga (máximo 300 caracteres)';
  end if;

  if not exists (select 1 from public.stores where id = p_store_id and estado = 'aprobado') then
    raise exception 'La tienda no está disponible';
  end if;

  perform public.expire_unpaid_orders();

  -- Sin límite, un cliente podría reservar todo el stock de una tienda con
  -- pedidos que nunca paga.
  if (
    select count(*) from public.orders
    where cliente_id = v_cliente_id and estado = 'esperando_pago'
  ) >= 2 then
    raise exception 'Tienes pedidos esperando pago. Complétalos o cancélalos en "Mis pedidos" antes de hacer otro.';
  end if;

  select commission_rate, delivery_fee into v_rate, v_fee from public.platform_settings;

  insert into public.orders (
    cliente_id, store_id, direccion_entrega, subtotal, delivery_fee, total, metodo_pago, estado
  )
  values (
    v_cliente_id, p_store_id, btrim(p_direccion_entrega), 0, v_fee, 0, 'tarjeta', 'esperando_pago'
  )
  returning id into v_order_id;

  for v_item in
    select value from jsonb_array_elements(p_items) order by value->>'product_id'
  loop
    v_cantidad := (v_item->>'cantidad')::integer;
    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Cantidad inválida en el carrito';
    end if;

    if v_cantidad > 99 then
      raise exception 'No puedes pedir más de 99 unidades de un mismo producto';
    end if;

    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
      and store_id = p_store_id
      and activo
    for update;

    if not found then
      raise exception 'Uno de los productos ya no está disponible en esta tienda';
    end if;

    if v_product.stock <= 0 then
      raise exception '"%" se agotó mientras hacías tu pedido. Quítalo del carrito para continuar.', v_product.nombre;
    end if;

    if v_product.stock < v_cantidad then
      raise exception 'Solo quedan % unidades de "%". Ajusta la cantidad en tu carrito.', v_product.stock, v_product.nombre;
    end if;

    update public.products
    set stock = stock - v_cantidad
    where id = v_product.id;

    v_precio_cliente := round(v_product.precio * (1 + v_rate), 2);

    insert into public.order_items (order_id, product_id, cantidad, precio_unitario)
    values (v_order_id, v_product.id, v_cantidad, v_precio_cliente);

    v_subtotal := v_subtotal + v_precio_cliente * v_cantidad;
    v_monto_tienda := v_monto_tienda + v_product.precio * v_cantidad;
  end loop;

  update public.orders
  set subtotal = v_subtotal, total = v_subtotal + v_fee
  where id = v_order_id;

  insert into public.order_settlements (order_id, store_id, monto_tienda, monto_delivery, comision)
  values (v_order_id, p_store_id, v_monto_tienda, v_fee, v_subtotal - v_monto_tienda);

  return v_order_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. Teléfonos solo en pedidos pagados en curso
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
  -- está en curso (pagado y sin terminar).
  v_ver_telefonos := v_es_cliente or v_es_admin
    or v_order.estado not in ('esperando_pago', 'entregado', 'cancelado');

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

-- ─────────────────────────────────────────────────────────────
-- 4. Código de pedido no correlativo
-- ─────────────────────────────────────────────────────────────

alter table public.orders
  add column codigo text not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

alter table public.orders
  add constraint orders_codigo_key unique (codigo);

-- ─────────────────────────────────────────────────────────────
-- 5. Casts explícitos
-- ─────────────────────────────────────────────────────────────

create or replace function public.advance_order_status(p_order_id uuid)
returns order_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_courier_id uuid;
  v_estado order_status;
  v_next order_status;
begin
  select c.id into v_courier_id from public.couriers c
  where c.user_id = auth.uid() and c.estado = 'aprobado';

  if v_courier_id is null then
    raise exception 'Solo un repartidor aprobado puede actualizar el estado del pedido';
  end if;

  select estado into v_estado
  from public.orders
  where id = p_order_id and courier_id = v_courier_id
  for update;

  if not found then
    raise exception 'Este pedido no está asignado a tu cuenta';
  end if;

  v_next := case v_estado
    when 'preparando' then 'en_camino'::order_status
    when 'en_camino' then 'entregado'::order_status
    else null
  end;

  if v_next is null then
    if v_estado in ('pendiente', 'confirmado') then
      raise exception 'La tienda todavía está preparando el pedido';
    end if;
    raise exception 'El pedido ya está en su estado final';
  end if;

  update public.orders set estado = v_next where id = p_order_id;

  return v_next;
end;
$$;

create or replace function public.store_advance_order(p_order_id uuid)
returns order_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado order_status;
  v_next order_status;
begin
  select o.estado into v_estado
  from public.orders o
  join public.stores s on s.id = o.store_id
  where o.id = p_order_id and s.user_id = auth.uid() and s.estado = 'aprobado'
  for update of o;

  if not found then
    raise exception 'Este pedido no pertenece a tu tienda';
  end if;

  v_next := case v_estado
    when 'pendiente' then 'confirmado'::order_status
    when 'confirmado' then 'preparando'::order_status
    else null
  end;

  if v_next is null then
    raise exception 'La tienda ya no puede cambiar el estado de este pedido';
  end if;

  update public.orders set estado = v_next where id = p_order_id;

  return v_next;
end;
$$;
