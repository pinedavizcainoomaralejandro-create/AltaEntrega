-- Los pedidos solo se escriben a través de las funciones SECURITY DEFINER
-- (checkout, claim_order, advance_order_status), que validan rol, precios,
-- stock y la secuencia de estados. Las políticas de escritura directa
-- permitían saltarse esas validaciones desde la API:
--
-- - orders_insert_cliente / order_items_insert_cliente: un cliente podía crear
--   pedidos con cualquier total, precio 0, estado 'entregado' o un repartidor
--   elegido, sin descontar stock.
-- - orders_update_involved_or_admin: la tienda y el repartidor asignado podían
--   cambiar cualquier columna (total, cliente_id, courier_id, estado), incluso
--   un repartidor ya rechazado.
--
-- La app no hace inserts ni updates directos sobre estas tablas. El admin
-- conserva el update directo.

drop policy "orders_insert_cliente" on public.orders;
drop policy "order_items_insert_cliente" on public.order_items;
drop policy "orders_update_involved_or_admin" on public.orders;

create policy "orders_update_admin"
  on public.orders for update
  using (public.current_user_role() = 'admin');
