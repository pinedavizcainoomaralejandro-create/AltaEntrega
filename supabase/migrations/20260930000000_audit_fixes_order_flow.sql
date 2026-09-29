-- Correcciones de la auditoría del 2026-09-29:
--
-- 1. El historial de estados se registraba con los permisos de quien cambiaba
--    el pedido; como order_status_history no tiene política de INSERT, un
--    admin no podía cambiar el estado directamente. Ahora el trigger es
--    SECURITY DEFINER.
-- 2. Un repartidor aprobado ya no puede cambiar su cédula, matrícula o
--    vehículo (datos que verificó el admin). Mientras está pendiente o
--    rechazado sí puede corregirlos.
-- 3. Una tienda o repartidor rechazado puede corregir sus datos y volver a
--    pedir revisión (rechazado -> pendiente). Nadie más que el admin aprueba.
-- 4. Flujo de estados por rol:
--      tienda:      pendiente -> confirmado -> preparando
--      repartidor:  preparando -> en_camino -> entregado
--    La bolsa de pedidos muestra solo pedidos confirmados por la tienda.
-- 5. Cancelación con devolución de stock: el cliente mientras está pendiente,
--    la tienda antes de que salga en camino, el admin mientras no esté
--    entregado.
-- 6. get_order_contacts(): datos de contacto del pedido (cliente y tienda)
--    solo para quienes participan en él.
-- 7. checkout() valida la dirección y limita cantidades también en la base.

-- ─────────────────────────────────────────────────────────────
-- 1. Historial de estados con permisos del sistema
-- ─────────────────────────────────────────────────────────────

create or replace function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
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

-- ─────────────────────────────────────────────────────────────
-- 2. Identidad del repartidor bloqueada tras la aprobación
-- ─────────────────────────────────────────────────────────────

create or replace function public.lock_approved_courier_identity()
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
    new.documento_identidad is distinct from old.documento_identidad
    or new.matricula is distinct from old.matricula
    or new.vehiculo is distinct from old.vehiculo
  ) then
    raise exception 'Tu cédula, matrícula y vehículo ya fueron verificados. Para cambiarlos, contacta a soporte.';
  end if;

  return new;
end;
$$;

create trigger trg_couriers_lock_approved_identity
before update on public.couriers
for each row execute function public.lock_approved_courier_identity();

-- ─────────────────────────────────────────────────────────────
-- 3. Reenvío tras rechazo
-- ─────────────────────────────────────────────────────────────

create or replace function public.prevent_self_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado is distinct from old.estado
     and public.current_user_role() <> 'admin'
     and not (old.estado = 'rechazado' and new.estado = 'pendiente')
  then
    new.estado := old.estado;
  end if;
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. Flujo de estados por rol
-- ─────────────────────────────────────────────────────────────

drop policy "orders_select_pool_for_couriers" on public.orders;

create policy "orders_select_pool_for_couriers"
  on public.orders for select
  using (
    estado in ('confirmado', 'preparando')
    and courier_id is null
    and exists (
      select 1 from public.couriers c
      where c.user_id = auth.uid() and c.estado = 'aprobado'
    )
  );

create or replace function public.claim_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_courier public.couriers%rowtype;
  v_updated_id uuid;
begin
  select * into v_courier from public.couriers where user_id = auth.uid();

  if not found or v_courier.estado <> 'aprobado' then
    raise exception 'Solo un repartidor aprobado puede aceptar entregas';
  end if;

  if not v_courier.disponible then
    raise exception 'Activa tu disponibilidad para poder aceptar entregas';
  end if;

  -- El WHERE con "courier_id is null" es atómico: si dos repartidores aceptan
  -- a la vez, solo el primero actualiza la fila.
  update public.orders
  set courier_id = v_courier.id
  where id = p_order_id
    and estado in ('confirmado', 'preparando')
    and courier_id is null
  returning id into v_updated_id;

  if v_updated_id is null then
    raise exception 'Este pedido ya fue tomado por otro repartidor o ya no está disponible';
  end if;
end;
$$;

-- Repartidor: preparando -> en_camino -> entregado.
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
    when 'preparando' then 'en_camino'
    when 'en_camino' then 'entregado'
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

-- Tienda: pendiente -> confirmado -> preparando.
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
    when 'pendiente' then 'confirmado'
    when 'confirmado' then 'preparando'
    else null
  end;

  if v_next is null then
    raise exception 'La tienda ya no puede cambiar el estado de este pedido';
  end if;

  update public.orders set estado = v_next where id = p_order_id;

  return v_next;
end;
$$;

revoke all on function public.store_advance_order(uuid) from public;
grant execute on function public.store_advance_order(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. Cancelación con devolución de stock
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
    if v_order.estado <> 'pendiente' then
      raise exception 'La tienda ya confirmó tu pedido. Para cancelarlo, contacta a la tienda.';
    end if;
  else
    raise exception 'No puedes cancelar este pedido';
  end if;

  -- Devuelve el stock, en orden de product_id para no bloquearse con un
  -- checkout simultáneo.
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

  update public.orders set estado = 'cancelado' where id = p_order_id;
end;
$$;

revoke all on function public.cancel_order(uuid) from public;
grant execute on function public.cancel_order(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 6. Contactos del pedido
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
begin
  if not exists (
    select 1 from public.orders o
    where o.id = p_order_id
      and (
        o.cliente_id = auth.uid()
        or public.current_user_role() = 'admin'
        or exists (select 1 from public.stores s where s.id = o.store_id and s.user_id = auth.uid())
        or exists (select 1 from public.couriers c where c.id = o.courier_id and c.user_id = auth.uid())
      )
  ) then
    raise exception 'No tienes acceso a este pedido';
  end if;

  return query
  select cu.nombre, cu.telefono, s.nombre, s.direccion, su.telefono
  from public.orders o
  join public.users cu on cu.id = o.cliente_id
  join public.stores s on s.id = o.store_id
  join public.users su on su.id = s.user_id
  where o.id = p_order_id;
end;
$$;

revoke all on function public.get_order_contacts(uuid) from public;
grant execute on function public.get_order_contacts(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 7. Checkout: validaciones también en la base
-- ─────────────────────────────────────────────────────────────

create or replace function public.checkout(
  p_store_id uuid,
  p_direccion_entrega text,
  p_metodo_pago payment_method,
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
  v_total numeric(10, 2) := 0;
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

  insert into public.orders (cliente_id, store_id, direccion_entrega, total, metodo_pago, estado)
  values (v_cliente_id, p_store_id, btrim(p_direccion_entrega), 0, p_metodo_pago, 'pendiente')
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

    insert into public.order_items (order_id, product_id, cantidad, precio_unitario)
    values (v_order_id, v_product.id, v_cantidad, v_product.precio);

    v_total := v_total + (v_product.precio * v_cantidad);
  end loop;

  update public.orders set total = v_total where id = v_order_id;

  return v_order_id;
end;
$$;

revoke all on function public.checkout(uuid, text, payment_method, jsonb) from public;
grant execute on function public.checkout(uuid, text, payment_method, jsonb) to authenticated;
