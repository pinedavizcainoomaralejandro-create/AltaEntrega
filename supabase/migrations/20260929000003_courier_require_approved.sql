-- Solo los repartidores APROBADOS pueden ver la bolsa de pedidos y avanzar
-- el estado de sus entregas. Antes bastaba con rol = 'courier': un repartidor
-- pendiente o rechazado podía leer por la API las direcciones de entrega de
-- todos los pedidos pendientes, y uno rechazado a mitad de una entrega podía
-- seguir cambiando el estado de sus pedidos.

drop policy "orders_select_pool_for_couriers" on public.orders;

create policy "orders_select_pool_for_couriers"
  on public.orders for select
  using (
    estado = 'pendiente'
    and courier_id is null
    and exists (
      select 1 from public.couriers c
      where c.user_id = auth.uid() and c.estado = 'aprobado'
    )
  );

-- Igual que 20260919000000_courier_delivery_panel.sql, pero exige courier aprobado.
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
