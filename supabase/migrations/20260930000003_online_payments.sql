-- Cobro en línea con tarjeta (AZUL), comisión de la plataforma y liquidación
-- manual a tiendas y repartidores.
--
-- Precios:
--   - products.precio es el precio de la TIENDA (lo que recibe).
--   - El cliente ve precio_tienda * (1 + comisión), redondeado a centavos, a
--     través de la vista catalog_products. La comisión vive solo en
--     platform_settings (solo admin) y nunca se expone al cliente: products
--     deja de ser legible públicamente.
--   - El total del cliente = productos (con comisión) + tarifa de delivery.
--
-- Pedido:
--   esperando_pago -> (pago aprobado) pendiente -> ... flujo de siempre.
--   Si el pago se rechaza, se cancela o pasan 30 minutos, el pedido se cancela
--   y el stock vuelve.
--
-- Liquidación: order_settlements guarda cuánto se le debe a la tienda
-- (sus precios), al repartidor (el delivery) y la comisión; el admin marca
-- cuándo pagó a cada uno.

-- ─────────────────────────────────────────────────────────────
-- Configuración de la plataforma (solo admin)
-- ─────────────────────────────────────────────────────────────

create table public.platform_settings (
  id boolean primary key default true check (id),
  commission_rate numeric(5, 4) not null default 0.05
    check (commission_rate >= 0 and commission_rate < 1),
  delivery_fee numeric(10, 2) not null default 150 check (delivery_fee >= 0),
  updated_at timestamptz not null default now()
);

insert into public.platform_settings default values;

alter table public.platform_settings enable row level security;

create policy "platform_settings_admin_select"
  on public.platform_settings for select
  using (public.current_user_role() = 'admin');

create policy "platform_settings_admin_update"
  on public.platform_settings for update
  using (public.current_user_role() = 'admin');

create trigger trg_platform_settings_updated_at
before update on public.platform_settings
for each row execute function public.set_updated_at();

-- Tarifa de delivery: pública (el cliente la ve como línea aparte).
create or replace function public.get_delivery_fee()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select delivery_fee from public.platform_settings;
$$;

grant execute on function public.get_delivery_fee() to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Catálogo con precio al cliente
-- ─────────────────────────────────────────────────────────────

-- La vista corre con los permisos de su dueño (security_invoker = false) para
-- leer products y platform_settings, que el cliente ya no puede leer. Solo
-- expone productos de tiendas aprobadas y el precio final.
create view public.catalog_products
with (security_invoker = false)
as
select
  p.id,
  p.store_id,
  p.nombre,
  p.descripcion,
  p.talla,
  p.color,
  p.stock,
  p.foto,
  p.agotado,
  p.activo,
  round(p.precio * (1 + ps.commission_rate), 2) as precio
from public.products p
join public.stores s on s.id = p.store_id and s.estado = 'aprobado'
cross join public.platform_settings ps;

grant select on public.catalog_products to anon, authenticated;

-- products: solo la tienda dueña y el admin (el precio base es privado).
drop policy "products_select_owner_admin_or_store_approved" on public.products;

create policy "products_select_owner_or_admin"
  on public.products for select
  using (
    public.current_user_role() = 'admin'
    or exists (select 1 from public.stores s where s.id = products.store_id and s.user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- Pedidos: montos y estado del pago
-- ─────────────────────────────────────────────────────────────

alter table public.orders
  add column numero bigint generated always as identity,
  add column subtotal numeric(10, 2),
  add column delivery_fee numeric(10, 2) not null default 0,
  add column estado_pago text not null default 'pendiente'
    check (estado_pago in ('pendiente', 'pagado', 'rechazado', 'expirado', 'reembolso_pendiente', 'reembolsado')),
  add column pago_autorizacion text,
  add column pago_referencia text,
  add column pagado_at timestamptz;

-- Los pedidos anteriores se pagaban contra entrega.
update public.orders set subtotal = total, estado_pago = 'pagado' where subtotal is null;

alter table public.orders
  alter column subtotal set not null,
  add constraint orders_numero_key unique (numero);

-- ─────────────────────────────────────────────────────────────
-- Liquidación a tienda y repartidor
-- ─────────────────────────────────────────────────────────────

create table public.order_settlements (
  order_id uuid primary key references public.orders (id) on delete cascade,
  store_id uuid not null references public.stores (id),
  monto_tienda numeric(10, 2) not null check (monto_tienda >= 0),
  monto_delivery numeric(10, 2) not null check (monto_delivery >= 0),
  comision numeric(10, 2) not null,
  tienda_pagado_at timestamptz,
  courier_pagado_at timestamptz,
  created_at timestamptz not null default now()
);

create index order_settlements_store_id_idx on public.order_settlements (store_id);

alter table public.order_settlements enable row level security;

create policy "order_settlements_select_store_courier_admin"
  on public.order_settlements for select
  using (
    public.current_user_role() = 'admin'
    or exists (select 1 from public.stores s where s.id = order_settlements.store_id and s.user_id = auth.uid())
    or exists (
      select 1 from public.orders o
      join public.couriers c on c.id = o.courier_id
      where o.id = order_settlements.order_id and c.user_id = auth.uid()
    )
  );

create policy "order_settlements_admin_update"
  on public.order_settlements for update
  using (public.current_user_role() = 'admin');

-- ─────────────────────────────────────────────────────────────
-- Stock y expiración de pagos abandonados
-- ─────────────────────────────────────────────────────────────

create or replace function public.restore_order_stock(p_order_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.products p
  set stock = p.stock + i.cantidad
  from (
    select product_id, sum(cantidad) as cantidad
    from public.order_items
    where order_id = p_order_id
    group by product_id
    order by product_id
  ) i
  where p.id = i.product_id;
$$;

revoke all on function public.restore_order_stock(uuid) from public, anon, authenticated;

-- Cancela los pedidos que llevan más de 30 minutos esperando pago y devuelve
-- su stock. Se llama al iniciar cada checkout.
create or replace function public.expire_unpaid_orders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  for v_id in
    select id from public.orders
    where estado = 'esperando_pago' and created_at < now() - interval '30 minutes'
    order by id
    for update skip locked
  loop
    perform public.restore_order_stock(v_id);
    update public.orders set estado = 'cancelado', estado_pago = 'expirado' where id = v_id;
  end loop;
end;
$$;

revoke all on function public.expire_unpaid_orders() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Checkout: crea el pedido esperando pago
-- ─────────────────────────────────────────────────────────────

drop function public.checkout(uuid, text, payment_method, jsonb);

create function public.checkout(
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

revoke all on function public.checkout(uuid, text, jsonb) from public;
grant execute on function public.checkout(uuid, text, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Resultado del pago (solo el servidor, con la service role)
-- ─────────────────────────────────────────────────────────────

-- Pago aprobado por la pasarela. Idempotente. Si el pedido ya había expirado,
-- el cobro queda marcado para reembolso.
create or replace function public.confirm_payment(
  p_order_id uuid,
  p_monto_centavos bigint,
  p_autorizacion text,
  p_referencia text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;

  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  if round(v_order.total * 100)::bigint <> p_monto_centavos then
    raise exception 'El monto cobrado (% centavos) no coincide con el pedido', p_monto_centavos;
  end if;

  if v_order.estado_pago = 'pagado' then
    return 'pagado';
  end if;

  if v_order.estado <> 'esperando_pago' then
    update public.orders
    set estado_pago = 'reembolso_pendiente', pago_autorizacion = p_autorizacion,
        pago_referencia = p_referencia, pagado_at = now()
    where id = p_order_id;
    return 'reembolso_pendiente';
  end if;

  update public.orders
  set estado = 'pendiente', estado_pago = 'pagado', pago_autorizacion = p_autorizacion,
      pago_referencia = p_referencia, pagado_at = now()
  where id = p_order_id;

  return 'pagado';
end;
$$;

-- Pago rechazado o cancelado en la pasarela: cancela y devuelve el stock.
create or replace function public.fail_payment(p_order_id uuid, p_estado_pago text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if p_estado_pago not in ('rechazado', 'expirado') then
    raise exception 'Estado de pago inválido';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;

  if not found or v_order.estado <> 'esperando_pago' then
    return;
  end if;

  perform public.restore_order_stock(p_order_id);
  update public.orders set estado = 'cancelado', estado_pago = p_estado_pago where id = p_order_id;
end;
$$;

revoke all on function public.confirm_payment(uuid, bigint, text, text) from public, anon, authenticated;
revoke all on function public.fail_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_payment(uuid, bigint, text, text) to service_role;
grant execute on function public.fail_payment(uuid, text) to service_role;

-- ─────────────────────────────────────────────────────────────
-- Cancelación: con pedidos pagados queda pendiente el reembolso
-- ─────────────────────────────────────────────────────────────

create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_rol user_role := public.current_user_role();
  v_es_tienda boolean;
begin
  select * into v_order from public.orders where id = p_order_id for update;

  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  v_es_tienda := exists (
    select 1 from public.stores s where s.id = v_order.store_id and s.user_id = auth.uid()
  );

  if v_rol = 'admin' then
    if v_order.estado in ('entregado', 'cancelado') then
      raise exception 'Este pedido ya está % y no se puede cancelar', v_order.estado;
    end if;
  elsif v_es_tienda then
    if v_order.estado not in ('pendiente', 'confirmado', 'preparando') then
      raise exception 'El pedido ya salió en camino y no se puede cancelar';
    end if;
  elsif v_order.cliente_id = auth.uid() then
    if v_order.estado not in ('esperando_pago', 'pendiente') then
      raise exception 'La tienda ya confirmó tu pedido. Para cancelarlo, contacta a la tienda.';
    end if;
  else
    raise exception 'No puedes cancelar este pedido';
  end if;

  perform public.restore_order_stock(p_order_id);

  update public.orders
  set estado = 'cancelado',
      estado_pago = case when v_order.estado_pago = 'pagado' then 'reembolso_pendiente' else v_order.estado_pago end
  where id = p_order_id;
end;
$$;

-- El admin marca un reembolso como hecho (lo hace en el portal de AZUL).
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
  set estado_pago = 'reembolsado'
  where id = p_order_id and estado_pago = 'reembolso_pendiente';

  if not found then
    raise exception 'Este pedido no tiene un reembolso pendiente';
  end if;
end;
$$;

revoke all on function public.mark_refunded(uuid) from public;
grant execute on function public.mark_refunded(uuid) to authenticated;
