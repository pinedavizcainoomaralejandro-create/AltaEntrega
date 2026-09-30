-- Correcciones de la revisión de la base de datos (2026-09-30):
--
-- 1. Reembolsos en fase 1: el dinero de un pedido por transferencia lo tiene
--    el negocio, así que es el negocio quien devuelve y lo marca, con la
--    referencia de la devolución. Mientras el reembolso está pendiente, el
--    negocio ve el teléfono del cliente para coordinarlo.
-- 2. Los pedidos guardan el nombre y la dirección del negocio, y cada línea
--    el nombre del producto, en el momento de la compra. Antes se leían de
--    stores y catalog_products, que ocultan los negocios pausados o
--    rechazados: el cliente veía "Tienda" y "Producto" en su historial y el
--    repartidor perdía la dirección de recogida.
-- 3. Índices para las consultas por estado (expiración de pagos, bolsa de
--    repartidores) y para las llaves foráneas que no tenían.

-- ─────────────────────────────────────────────────────────────
-- 1. Reembolsos que hace el negocio
-- ─────────────────────────────────────────────────────────────

alter table public.orders
  add column reembolso_referencia text,
  add column reembolsado_at timestamptz;

-- Pedido pagado por transferencia al negocio y luego cancelado: el negocio
-- devuelve el dinero al cliente y registra la referencia.
create or replace function public.store_mark_refunded(p_order_id uuid, p_referencia text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select o.* into v_order
  from public.orders o
  join public.stores s on s.id = o.store_id
  where o.id = p_order_id and s.user_id = auth.uid()
  for update of o;

  if not found then
    raise exception 'Este pedido no pertenece a tu negocio';
  end if;
  if v_order.metodo_pago <> 'transferencia' then
    raise exception 'Este reembolso lo gestiona AltaEntrega';
  end if;
  if v_order.estado_pago <> 'reembolso_pendiente' then
    raise exception 'Este pedido no tiene un reembolso pendiente';
  end if;
  if p_referencia is null or btrim(p_referencia) = '' or length(p_referencia) > 100 then
    raise exception 'Escribe la referencia de la devolución';
  end if;

  update public.orders
  set estado_pago = 'reembolsado', reembolso_referencia = btrim(p_referencia), reembolsado_at = now()
  where id = p_order_id;
end;
$$;

revoke all on function public.store_mark_refunded(uuid, text) from public, anon;
grant execute on function public.store_mark_refunded(uuid, text) to authenticated;

-- El admin sigue pudiendo marcarlo (tarjeta, o si el negocio no lo registra).
create or replace function public.mark_refunded(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() is distinct from 'admin' then
    raise exception 'Solo un administrador puede marcar reembolsos';
  end if;

  update public.orders
  set estado_pago = 'reembolsado', reembolsado_at = now()
  where id = p_order_id and estado_pago = 'reembolso_pendiente';

  if not found then
    raise exception 'Este pedido no tiene un reembolso pendiente';
  end if;
end;
$$;

-- El negocio ve el teléfono del cliente mientras le debe un reembolso.
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
  v_es_tienda boolean;
  v_es_admin boolean := public.current_user_role() = 'admin';
  v_ver_telefonos boolean;
begin
  select * into v_order from public.orders where id = p_order_id;

  v_es_cliente := found and v_order.cliente_id = auth.uid();
  v_es_tienda := found and exists (select 1 from public.stores s where s.id = v_order.store_id and s.user_id = auth.uid());

  if not found or not (
    v_es_cliente
    or v_es_admin
    or v_es_tienda
    or exists (select 1 from public.couriers c where c.id = v_order.courier_id and c.user_id = auth.uid())
  ) then
    raise exception 'No tienes acceso a este pedido';
  end if;

  -- La tienda y el repartidor solo necesitan los teléfonos mientras el pedido
  -- está en curso (pagado y sin terminar). La tienda también mientras le debe
  -- un reembolso por transferencia al cliente.
  v_ver_telefonos := v_es_cliente or v_es_admin
    or v_order.estado not in ('esperando_pago', 'entregado', 'cancelado')
    or (v_es_tienda and v_order.metodo_pago = 'transferencia' and v_order.estado_pago = 'reembolso_pendiente');

  return query
  select
    cu.nombre,
    case when v_ver_telefonos then cu.telefono end,
    v_order.tienda_nombre,
    v_order.tienda_direccion,
    case when v_ver_telefonos then su.telefono end
  from public.users cu
  join public.stores s on s.id = v_order.store_id
  join public.users su on su.id = s.user_id
  where cu.id = v_order.cliente_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. Nombres guardados en el pedido
-- ─────────────────────────────────────────────────────────────

alter table public.orders
  add column tienda_nombre text,
  add column tienda_direccion text;

update public.orders o
set tienda_nombre = s.nombre, tienda_direccion = s.direccion
from public.stores s
where s.id = o.store_id;

alter table public.orders
  alter column tienda_nombre set not null,
  alter column tienda_direccion set not null;

alter table public.order_items
  add column nombre text;

update public.order_items i
set nombre = p.nombre
from public.products p
where p.id = i.product_id;

alter table public.order_items
  alter column nombre set not null;

-- Checkout: igual que 20261001000000, pero guarda los nombres.
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
  v_fase text;
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

  if not exists (select 1 from public.stores where id = p_store_id and estado = 'aprobado')
     or not public.subscription_ok(p_store_id, null) then
    raise exception 'Este negocio no está disponible en este momento';
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

  select fase, commission_rate, delivery_fee into v_fase, v_rate, v_fee from public.platform_settings;

  -- Fase 1 (suscripciones): el cliente paga el precio del negocio, sin
  -- comisión, por transferencia directa al negocio.
  if v_fase = 'suscripciones' then
    v_rate := 0;
    if not exists (select 1 from public.store_payout_accounts where store_id = p_store_id) then
      raise exception 'Este negocio todavía no configuró su cuenta para recibir transferencias';
    end if;
  end if;

  insert into public.orders (
    cliente_id, store_id, direccion_entrega, subtotal, delivery_fee, total, metodo_pago, estado,
    tienda_nombre, tienda_direccion
  )
  select
    v_cliente_id, p_store_id, btrim(p_direccion_entrega), 0, v_fee, 0,
    case when v_fase = 'azul' then 'tarjeta' else 'transferencia' end::payment_method, 'esperando_pago',
    s.nombre, s.direccion
  from public.stores s
  where s.id = p_store_id
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

    insert into public.order_items (order_id, product_id, nombre, cantidad, precio_unitario)
    values (v_order_id, v_product.id, v_product.nombre, v_cantidad, v_precio_cliente);

    v_subtotal := v_subtotal + v_precio_cliente * v_cantidad;
    v_monto_tienda := v_monto_tienda + v_product.precio * v_cantidad;
  end loop;

  update public.orders
  set subtotal = v_subtotal, total = v_subtotal + v_fee
  where id = v_order_id;

  -- Solo en fase 2 la plataforma cobra y reparte. El delivery lo cobra el
  -- repartidor en efectivo: la plataforma no le debe nada.
  if v_fase = 'azul' then
    insert into public.order_settlements (order_id, store_id, monto_tienda, monto_delivery, comision)
    values (v_order_id, p_store_id, v_monto_tienda, 0, v_subtotal - v_monto_tienda);
  end if;

  return v_order_id;
end;
$$;


-- ─────────────────────────────────────────────────────────────
-- 3. Índices
-- ─────────────────────────────────────────────────────────────

create index orders_estado_created_at_idx on public.orders (estado, created_at);
create index order_items_product_id_idx on public.order_items (product_id);
create index payouts_order_id_idx on public.payouts (order_id);
create index ledger_entries_order_id_idx on public.ledger_entries (order_id);
create index subscription_payments_subscription_id_idx on public.subscription_payments (subscription_id);
