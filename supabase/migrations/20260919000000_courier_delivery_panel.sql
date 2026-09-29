-- AltaEntrega: panel de repartidor
-- Bolsa de pedidos pendientes sin asignar, aceptar entrega (sin condición de
-- carrera) y avanzar el estado del pedido paso a paso.

-- Los couriers ven los pedidos "pendiente" sin repartidor asignado (bolsa de pedidos).
-- Sus propios pedidos asignados ya son visibles vía orders_select_involved_or_admin.
create policy "orders_select_pool_for_couriers"
  on public.orders for select
  using (
    estado = 'pendiente'
    and courier_id is null
    and public.current_user_role() = 'courier'
  );

-- Un repartidor aprobado y disponible toma un pedido de la bolsa. El UPDATE con
-- "courier_id is null" en el WHERE es atómico: si dos repartidores intentan
-- tomar el mismo pedido a la vez, solo el primero tiene éxito.
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

  update public.orders
  set courier_id = v_courier.id
  where id = p_order_id
    and estado = 'pendiente'
    and courier_id is null
  returning id into v_updated_id;

  if v_updated_id is null then
    raise exception 'Este pedido ya fue tomado por otro repartidor';
  end if;
end;
$$;

revoke all on function public.claim_order(uuid) from public;
grant execute on function public.claim_order(uuid) to authenticated;

-- Avanza el pedido un paso en su ciclo de vida: pendiente -> confirmado ->
-- preparando -> en_camino -> entregado. Solo el repartidor asignado puede
-- avanzarlo. Cada cambio queda registrado en order_status_history a través
-- del trigger que ya existe sobre orders.estado.
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
  select c.id into v_courier_id from public.couriers c where c.user_id = auth.uid();

  if v_courier_id is null then
    raise exception 'Solo un repartidor puede actualizar el estado del pedido';
  end if;

  select estado into v_estado
  from public.orders
  where id = p_order_id and courier_id = v_courier_id
  for update;

  if not found then
    raise exception 'Este pedido no está asignado a tu cuenta';
  end if;

  v_next := case v_estado
    when 'pendiente' then 'confirmado'
    when 'confirmado' then 'preparando'
    when 'preparando' then 'en_camino'
    when 'en_camino' then 'entregado'
    else null
  end;

  if v_next is null then
    raise exception 'El pedido ya está en su estado final';
  end if;

  update public.orders set estado = v_next where id = p_order_id;

  return v_next;
end;
$$;

revoke all on function public.advance_order_status(uuid) from public;
grant execute on function public.advance_order_status(uuid) to authenticated;

-- Habilita Realtime (postgres_changes) sobre orders para la bolsa de pedidos
-- y el seguimiento en vivo de "mis entregas".
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
     )
  then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
