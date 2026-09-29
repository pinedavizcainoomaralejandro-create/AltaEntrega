-- Pruebas de reglas de negocio y seguridad sobre las migraciones.
-- Cada bloque falla con RAISE si el comportamiento no es el esperado.
\set ON_ERROR_STOP 1

grant usage on schema public, auth to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema auth to authenticated;

-- Espera que la sentencia falle con un mensaje que contenga "expected".
create function pg_temp.expect_error(stmt text, expected text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'Se esperaba el error "%" pero la sentencia funcionó: %', expected, stmt;
exception when others then
  if position(expected in sqlerrm) = 0 then
    raise exception 'Se esperaba "%" pero falló con "%": %', expected, sqlerrm, stmt;
  end if;
end;
$$;

create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('test.uid', uid, false);
$$;

-- Datos: admin, tienda aprobada, dos clientes, repartidor aprobado y uno rechazado.
insert into auth.users
select ('00000000-0000-0000-0000-0000000000' || x)::uuid from unnest(array['0a', '0b', '0c', '0d', 'd1', 'd2']) x;
insert into public.users (id, email, rol, nombre, telefono) values
  ('00000000-0000-0000-0000-00000000000a', 'a@x.com', 'admin', 'Admin', null),
  ('00000000-0000-0000-0000-00000000000b', 't@x.com', 'tienda', 'Tienda', '8095550001'),
  ('00000000-0000-0000-0000-00000000000c', 'c@x.com', 'cliente', 'Cliente', '8295550002'),
  ('00000000-0000-0000-0000-00000000000d', 'c2@x.com', 'cliente', 'Cliente2', null),
  ('00000000-0000-0000-0000-0000000000d1', 'd1@x.com', 'courier', 'Rep1', null),
  ('00000000-0000-0000-0000-0000000000d2', 'd2@x.com', 'courier', 'Rep2', null);
insert into public.stores (id, user_id, nombre, direccion, categoria, estado) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000b', 'Boutique', 'Calle Duarte 1', 'Ropa', 'aprobado');
insert into public.couriers (id, user_id, vehiculo, documento_identidad, matricula, estado, disponible) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', 'moto', '11111111111', 'K111111', 'aprobado', true),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d2', 'moto', '22222222222', 'K222222', 'rechazado', false);
insert into public.products (id, store_id, nombre, precio, stock) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Blusa', 10, 5);

set role authenticated;

-- Escalada de privilegios
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error($$update public.users set rol = 'admin' where id = auth.uid()$$, 'Solo un administrador');
select pg_temp.expect_error(
  $$insert into public.orders (cliente_id, store_id, direccion_entrega, total, metodo_pago)
    values (auth.uid(), '00000000-0000-0000-0000-0000000000a1', 'X', 0, 'efectivo')$$,
  'row-level security');

-- Checkout
select pg_temp.expect_error(
  $$select public.checkout('00000000-0000-0000-0000-0000000000a1', '  ', 'efectivo',
    '[{"product_id":"00000000-0000-0000-0000-0000000000f1","cantidad":1}]')$$,
  'dirección de entrega');
select pg_temp.expect_error(
  $$select public.checkout('00000000-0000-0000-0000-0000000000a1', 'Casa', 'efectivo',
    '[{"product_id":"00000000-0000-0000-0000-0000000000f1","cantidad":6}]')$$,
  'Solo quedan 5');
select set_config('test.order1', public.checkout('00000000-0000-0000-0000-0000000000a1', 'Casa 5', 'efectivo',
  '[{"product_id":"00000000-0000-0000-0000-0000000000f1","cantidad":2}]')::text, false);
select set_config('test.order2', public.checkout('00000000-0000-0000-0000-0000000000a1', 'Casa 5', 'efectivo',
  '[{"product_id":"00000000-0000-0000-0000-0000000000f1","cantidad":1}]')::text, false);
do $$ begin
  if (select stock from public.products) <> 2 then raise exception 'El checkout no descontó el stock'; end if;
end $$;

-- Flujo: el repartidor no ve ni toma pedidos sin confirmar
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
do $$ begin
  if (select count(*) from public.orders) <> 0 then raise exception 'La bolsa muestra pedidos sin confirmar'; end if;
end $$;
select pg_temp.expect_error(format('select public.claim_order(%L)', current_setting('test.order1')), 'ya no está disponible');

-- La tienda confirma; el repartidor lo toma pero espera la preparación
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.store_advance_order(current_setting('test.order1')::uuid);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select public.claim_order(current_setting('test.order1')::uuid);
select pg_temp.expect_error(format('select public.advance_order_status(%L)', current_setting('test.order1')), 'preparando el pedido');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.store_advance_order(current_setting('test.order1')::uuid);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select public.advance_order_status(current_setting('test.order1')::uuid);

-- Contactos: solo quien participa en el pedido
do $$ begin
  if (select tienda_direccion from public.get_order_contacts(current_setting('test.order1')::uuid)) <> 'Calle Duarte 1' then
    raise exception 'El repartidor asignado no ve la dirección de la tienda';
  end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
select pg_temp.expect_error(format('select * from public.get_order_contacts(%L)', current_setting('test.order1')), 'No tienes acceso');

-- Identidad del repartidor aprobado bloqueada; el rechazado corrige y reenvía
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_error($$update public.couriers set matricula = 'X999999' where user_id = auth.uid()$$, 'ya fueron verificados');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
update public.couriers set matricula = 'K333333', estado = 'pendiente' where user_id = auth.uid();
update public.couriers set estado = 'aprobado' where user_id = auth.uid();
do $$ begin
  if (select estado from public.couriers where user_id = auth.uid()) <> 'pendiente' then
    raise exception 'Un repartidor pudo autoaprobarse';
  end if;
end $$;

-- Cancelación: el cliente solo mientras está pendiente; devuelve stock
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error(format('select public.cancel_order(%L)', current_setting('test.order1')), 'contacta a la tienda');
select public.cancel_order(current_setting('test.order2')::uuid);
do $$ begin
  if (select stock from public.products) <> 3 then raise exception 'La cancelación no devolvió el stock'; end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.expect_error(format('select public.cancel_order(%L)', current_setting('test.order1')), 'No puedes cancelar');

-- El admin puede cambiar el estado directamente (el historial se registra)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.cancel_order(current_setting('test.order1')::uuid);
do $$ begin
  if (select stock from public.products) <> 5 then raise exception 'La cancelación del admin no devolvió el stock'; end if;
  if (select count(*) from public.order_status_history where estado = 'cancelado') <> 2 then
    raise exception 'El historial no registró las cancelaciones';
  end if;
end $$;

reset role;
\echo 'OK: todas las pruebas de base de datos pasaron'
