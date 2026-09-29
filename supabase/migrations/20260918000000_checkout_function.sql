-- AltaEntrega: checkout atómico
-- Crea el pedido + sus items y descuenta el stock de cada producto en una sola
-- transacción, con bloqueo de fila (FOR UPDATE) para evitar sobreventa por
-- pedidos concurrentes. SECURITY DEFINER porque el cliente no tiene permiso de
-- UPDATE sobre products vía RLS; la función valida el rol manualmente.

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

  if not exists (select 1 from public.stores where id = p_store_id and estado = 'aprobado') then
    raise exception 'La tienda no está disponible';
  end if;

  insert into public.orders (cliente_id, store_id, direccion_entrega, total, metodo_pago, estado)
  values (v_cliente_id, p_store_id, p_direccion_entrega, 0, p_metodo_pago, 'pendiente')
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_cantidad := (v_item->>'cantidad')::integer;
    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Cantidad inválida en el carrito';
    end if;

    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
      and store_id = p_store_id
    for update;

    if not found then
      raise exception 'Uno de los productos ya no está disponible en esta tienda';
    end if;

    if v_product.stock < v_cantidad then
      raise exception 'Stock insuficiente para "%" (disponible: %)', v_product.nombre, v_product.stock;
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
