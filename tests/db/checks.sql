-- Pruebas de reglas de negocio y seguridad sobre las migraciones.
-- Cada bloque falla con RAISE si el comportamiento no es el esperado.
\set ON_ERROR_STOP 1

grant usage on schema public, auth to authenticated, service_role;
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

-- Las pruebas del cobro con tarjeta y comisión corren en fase 2 (AZUL); las de
-- transferencias y suscripciones (fase 1) están al final.
update public.platform_settings set fase = 'azul';

-- Datos: admin, tienda aprobada, dos clientes, repartidor aprobado y uno rechazado.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@x.com'),
  ('00000000-0000-0000-0000-00000000000b', 't@x.com'),
  ('00000000-0000-0000-0000-00000000000c', 'c@x.com'),
  ('00000000-0000-0000-0000-00000000000d', 'c2@x.com'),
  ('00000000-0000-0000-0000-0000000000d1', 'd1@x.com'),
  ('00000000-0000-0000-0000-0000000000d2', 'd2@x.com');
insert into public.users (id, email, rol, nombre, telefono) values
  ('00000000-0000-0000-0000-00000000000a', 'a@x.com', 'admin', 'Admin', null),
  ('00000000-0000-0000-0000-00000000000b', 't@x.com', 'tienda', 'Tienda', '8095550001'),
  ('00000000-0000-0000-0000-00000000000c', 'c@x.com', 'cliente', 'Cliente', '8295550002'),
  ('00000000-0000-0000-0000-00000000000d', 'c2@x.com', 'cliente', 'Cliente2', null),
  ('00000000-0000-0000-0000-0000000000d1', 'd1@x.com', 'courier', 'Rep1', null),
  ('00000000-0000-0000-0000-0000000000d2', 'd2@x.com', 'courier', 'Rep2', null);
insert into public.stores (id, user_id, nombre, direccion, categoria, estado) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000b', 'Boutique', 'Calle Duarte 1', 'boutique', 'aprobado');
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
  $$select public.checkout('00000000-0000-0000-0000-0000000000a1', '  ',
    '[{"product_id":"00000000-0000-0000-0000-0000000000f1","cantidad":1}]')$$,
  'dirección de entrega');
select pg_temp.expect_error(
  $$select public.checkout('00000000-0000-0000-0000-0000000000a1', 'Casa',
    '[{"product_id":"00000000-0000-0000-0000-0000000000f1","cantidad":6}]')$$,
  'Solo quedan 5');
select set_config('test.order1', public.checkout('00000000-0000-0000-0000-0000000000a1', 'Casa 5',
  '[{"product_id":"00000000-0000-0000-0000-0000000000f1","cantidad":2}]')::text, false);
select set_config('test.order2', public.checkout('00000000-0000-0000-0000-0000000000a1', 'Casa 5',
  '[{"product_id":"00000000-0000-0000-0000-0000000000f1","cantidad":1}]')::text, false);
do $$ begin
  if (select stock from public.catalog_products) <> 2 then raise exception 'El checkout no descontó el stock'; end if;
end $$;

-- Precios: el cliente ve el precio con comisión y no puede leer el precio
-- base, la comisión ni la liquidación.
do $$ begin
  if (select precio from public.catalog_products) <> 10.50 then raise exception 'El catálogo no aplica la comisión'; end if;
  if (select count(*) from public.products) <> 0 then raise exception 'El cliente puede leer el precio base'; end if;
  if (select count(*) from public.platform_settings) <> 0 then raise exception 'El cliente puede leer la comisión'; end if;
  if (select count(*) from public.order_settlements) <> 0 then raise exception 'El cliente puede leer la liquidación'; end if;
  if public.get_delivery_fee() <> 150 then raise exception 'La tarifa de delivery no es la esperada'; end if;
end $$;
do $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id = current_setting('test.order1')::uuid;
  if o.estado <> 'esperando_pago' or o.subtotal <> 21.00 or o.delivery_fee <> 150 or o.total <> 171.00 then
    raise exception 'Montos o estado inicial incorrectos: % % % %', o.estado, o.subtotal, o.delivery_fee, o.total;
  end if;
end $$;
select pg_temp.expect_error(
  format('select public.confirm_payment(%L, 2100, %L, %L)', current_setting('test.order1'), 'X', 'Y'),
  'permission denied');

-- Mientras espera el pago, la tienda no puede confirmarlo
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error(format('select public.store_advance_order(%L)', current_setting('test.order1')), 'ya no puede cambiar');
do $$ begin
  if (select monto_tienda from public.order_settlements where order_id = current_setting('test.order1')::uuid) <> 20.00
     or (select comision from public.order_settlements where order_id = current_setting('test.order1')::uuid) <> 1.00 then
    raise exception 'La liquidación de la tienda es incorrecta';
  end if;
end $$;

-- La pasarela confirma el pago (servidor con service_role)
set role service_role;
select pg_temp.expect_error(
  format('select public.confirm_payment(%L, 999, %L, %L)', current_setting('test.order1'), 'X', 'Y'),
  'no coincide');
-- En línea solo se cobran los productos (21.00); el delivery es en efectivo.
select public.confirm_payment(current_setting('test.order1')::uuid, 2100, 'AUT1', 'RRN1');
select public.confirm_payment(current_setting('test.order1')::uuid, 2100, 'AUT1', 'RRN1');
set role authenticated;

-- Al instante: la tienda tiene 20.00 de saldo y la plataforma 1.00 de comisión
-- (una sola vez aunque el pago se confirme dos veces).
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  if (select sum(monto) from public.ledger_entries) <> 20.00 then
    raise exception 'El saldo de la tienda no es 20.00: %', (select sum(monto) from public.ledger_entries);
  end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if (select sum(monto) from public.ledger_entries where cuenta = 'plataforma') <> 1.00 then
    raise exception 'La comisión de la plataforma no es 1.00';
  end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  if (select count(*) from public.ledger_entries) <> 0 then raise exception 'El cliente ve el libro de movimientos'; end if;
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
  if (select stock from public.catalog_products) <> 3 then raise exception 'La cancelación no devolvió el stock'; end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.expect_error(format('select public.cancel_order(%L)', current_setting('test.order1')), 'No puedes cancelar');

-- El admin puede cambiar el estado directamente (el historial se registra)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.cancel_order(current_setting('test.order1')::uuid);
do $$ begin
  if (select stock from public.catalog_products) <> 5 then raise exception 'La cancelación del admin no devolvió el stock'; end if;
  if (select count(*) from public.order_status_history where estado = 'cancelado') <> 2 then
    raise exception 'El historial no registró las cancelaciones';
  end if;
end $$;

-- Tras la entrega/cancelación, el repartidor ya no ve los teléfonos
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
do $$ begin
  if (select cliente_telefono from public.get_order_contacts(current_setting('test.order1')::uuid)) is not null then
    raise exception 'El repartidor sigue viendo el teléfono de un pedido cerrado';
  end if;
end $$;

-- El email de public.users no se puede cambiar por la API
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
update public.users set email = 'otro@x.com' where id = auth.uid();
do $$ begin
  if (select email from public.users where id = auth.uid()) <> 'c@x.com' then
    raise exception 'Un usuario pudo cambiar su email en public.users';
  end if;
end $$;

-- La tienda aprobada no cambia nombre ni dirección, sí la categoría
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error($$update public.stores set nombre = 'Otra marca' where user_id = auth.uid()$$, 'ya fueron verificados');
update public.stores set categoria = 'reposteria' where user_id = auth.uid();
select pg_temp.expect_error($$update public.stores set categoria = 'ferreteria' where user_id = auth.uid()$$, 'stores_categoria_check');

-- Límites de products y "agotado" en cualquier update
select pg_temp.expect_error(
  $$update public.products set precio = 5000000 where id = '00000000-0000-0000-0000-0000000000f1'$$,
  'products_precio_max');
update public.products set agotado = true where id = '00000000-0000-0000-0000-0000000000f1';
do $$ begin
  if (select agotado from public.products where id = '00000000-0000-0000-0000-0000000000f1') then
    raise exception 'agotado quedó en true con stock disponible';
  end if;
end $$;

-- El pedido 1 estaba pagado: al cancelarlo queda el reembolso pendiente
do $$ begin
  if (select estado_pago from public.orders where id = current_setting('test.order1')::uuid) <> 'reembolso_pendiente' then
    raise exception 'Cancelar un pedido pagado no dejó el reembolso pendiente';
  end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.mark_refunded(current_setting('test.order1')::uuid);

-- Pago rechazado: cancela y devuelve el stock
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select set_config('test.order3', public.checkout('00000000-0000-0000-0000-0000000000a1', 'Casa 5',
  '[{"product_id":"00000000-0000-0000-0000-0000000000f1","cantidad":1}]')::text, false);
set role service_role;
select public.fail_payment(current_setting('test.order3')::uuid, 'rechazado');
set role authenticated;
do $$ begin
  if (select estado from public.orders where id = current_setting('test.order3')::uuid) <> 'cancelado'
     or (select stock from public.catalog_products) <> 5 then
    raise exception 'El pago rechazado no canceló el pedido o no devolvió el stock';
  end if;
end $$;

-- Pago abandonado: a los 30 minutos el siguiente checkout lo expira
select set_config('test.order4', public.checkout('00000000-0000-0000-0000-0000000000a1', 'Casa 5',
  '[{"product_id":"00000000-0000-0000-0000-0000000000f1","cantidad":2}]')::text, false);
reset role;
update public.orders set created_at = now() - interval '31 minutes' where id = current_setting('test.order4')::uuid;
set role authenticated;
select public.checkout('00000000-0000-0000-0000-0000000000a1', 'Casa 5',
  '[{"product_id":"00000000-0000-0000-0000-0000000000f1","cantidad":1}]');
do $$ begin
  if (select estado_pago from public.orders where id = current_setting('test.order4')::uuid) <> 'expirado'
     or (select stock from public.catalog_products) <> 4 then
    raise exception 'El pago abandonado no expiró o no devolvió el stock';
  end if;
end $$;

-- Si el pago llega después de expirar, queda para reembolso
set role service_role;
do $$ begin
  if public.confirm_payment(current_setting('test.order4')::uuid, 2100, 'AUT4', 'RRN4') <> 'reembolso_pendiente' then
    raise exception 'Un pago tardío no quedó para reembolso';
  end if;
end $$;
set role authenticated;

-- La tienda no ve el teléfono del cliente en un pedido sin pagar
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select set_config('test.order5', public.checkout('00000000-0000-0000-0000-0000000000a1', 'Casa 5',
  '[{"product_id":"00000000-0000-0000-0000-0000000000f1","cantidad":1}]')::text, false);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  if (select cliente_telefono from public.get_order_contacts(current_setting('test.order5')::uuid)) is not null then
    raise exception 'La tienda ve el teléfono de un pedido sin pagar';
  end if;
end $$;

-- Máximo 2 pedidos esperando pago por cliente
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error(
  $$select public.checkout('00000000-0000-0000-0000-0000000000a1', 'Casa 5',
    '[{"product_id":"00000000-0000-0000-0000-0000000000f1","cantidad":1}]')$$,
  'Tienes pedidos esperando pago');

-- Código de pedido aleatorio
do $$ begin
  if (select codigo from public.orders where id = current_setting('test.order5')::uuid) !~ '^[0-9A-F]{8}$' then
    raise exception 'El pedido no tiene un código aleatorio';
  end if;
end $$;

-- El admin canceló el pedido 1 (pagado): lo acreditado se revirtió
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if (select sum(monto) from public.ledger_entries) <> 0 then
    raise exception 'La cancelación de un pedido pagado no revirtió los saldos';
  end if;
end $$;

-- Reparto al cobrar: otro cliente compra y paga
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select set_config('test.order6', public.checkout('00000000-0000-0000-0000-0000000000a1', 'Casa 9',
  '[{"product_id":"00000000-0000-0000-0000-0000000000f1","cantidad":1}]')::text, false);
set role service_role;
select public.confirm_payment(current_setting('test.order6')::uuid, 1050, 'AUT6', 'RRN6');
set role authenticated;

-- En ese instante se crean las dos transferencias: 10.00 a la tienda y 0.50 a ganancias
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if (select monto from public.payouts where order_id = current_setting('test.order6')::uuid and destino = 'tienda') <> 10.00
     or (select monto from public.payouts where order_id = current_setting('test.order6')::uuid and destino = 'plataforma') <> 0.50 then
    raise exception 'Las transferencias del cobro no tienen los montos esperados';
  end if;
end $$;

-- Sin cuenta registrada no se puede completar
select pg_temp.expect_error(
  format('select public.update_payout(%L, %L, %L)',
    (select id from public.payouts where order_id = current_setting('test.order6')::uuid and destino = 'tienda'), 'completado', 'TRX1'),
  'no está registrada');

-- Un visitante sin sesión (rol anon) no puede completar transferencias
reset role;
grant usage on schema public, auth to anon;
select set_config('test.payout_tienda',
  (select id::text from public.payouts where order_id = current_setting('test.order6')::uuid and destino = 'tienda'), false);
set role anon;
select pg_temp.as_user('');
select pg_temp.expect_error(
  format('select public.update_payout(%L, %L)', current_setting('test.payout_tienda'), 'completado'),
  'permission denied');
reset role;
-- Aunque tuviera permiso de ejecución, la función lo rechaza por el rol del JWT.
set role authenticated;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select pg_temp.expect_error(
  format('select public.update_payout(%L, %L)', current_setting('test.payout_tienda'), 'completado'),
  'Solo un administrador');
select set_config('request.jwt.claims', '', false);

-- El negocio registra su cuenta; el cliente no ve transferencias; la tienda no puede completarlas
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.store_payout_accounts (store_id, banco, tipo_cuenta, numero_cuenta, titular, documento)
values ('00000000-0000-0000-0000-0000000000a1', 'Banco Popular', 'ahorros', '123456789', 'Tienda SRL', '00112345678');
select pg_temp.expect_error(
  format('select public.update_payout(%L, %L)',
    (select id from public.payouts where order_id = current_setting('test.order6')::uuid and destino = 'tienda'), 'completado'),
  'Solo un administrador');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  if (select count(*) from public.payouts) <> 0 then raise exception 'El cliente ve transferencias'; end if;
end $$;

-- El admin (o el conector) completa ambas; los saldos quedan en cero
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.platform_settings set ganancias_banco = 'Banreservas', ganancias_tipo_cuenta = 'corriente',
  ganancias_numero_cuenta = '987654321', ganancias_titular = 'Fundador', ganancias_documento = '00198765432';
select public.update_payout(id, 'completado', 'TRX-' || destino)
from public.payouts where order_id = current_setting('test.order6')::uuid;
do $$ begin
  if (select sum(monto) from public.ledger_entries where order_id = current_setting('test.order6')::uuid) <> 0 then
    raise exception 'Las transferencias completadas no descontaron los saldos';
  end if;
  if (select cuenta->>'numero_cuenta' from public.payouts
      where order_id = current_setting('test.order6')::uuid and destino = 'plataforma') <> '987654321' then
    raise exception 'La transferencia de ganancias no fue a la cuenta del fundador';
  end if;
end $$;

-- ═════════════════════════════════════════════════════════════
-- FASE 1: transferencias al negocio y suscripciones
-- ═════════════════════════════════════════════════════════════
reset role;
update public.platform_settings set fase = 'suscripciones';
update public.products set stock = 10;
set role authenticated;

-- El catálogo muestra el precio del negocio, sin comisión
select pg_temp.as_user('');
do $$ begin
  if (select precio from public.catalog_products) <> 10.00 then
    raise exception 'En fase 1 el catálogo no debe sumar comisión';
  end if;
  if (public.get_public_config() ->> 'fase') <> 'suscripciones' then raise exception 'La fase pública no es suscripciones'; end if;
end $$;

-- Pedido por transferencia: el cliente ve la cuenta del negocio y envía el comprobante
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select set_config('test.order7', public.checkout('00000000-0000-0000-0000-0000000000a1', 'Casa 9',
  '[{"product_id":"00000000-0000-0000-0000-0000000000f1","cantidad":2}]')::text, false);
do $$ declare o public.orders%rowtype; begin
  select * into o from public.orders where id = current_setting('test.order7')::uuid;
  if o.metodo_pago <> 'transferencia' or o.subtotal <> 20.00 then
    raise exception 'El pedido de fase 1 debe ser por transferencia y sin comisión: % %', o.metodo_pago, o.subtotal;
  end if;
  if (public.get_order_payment_account(o.id) ->> 'numero_cuenta') <> '123456789' then
    raise exception 'El cliente no ve la cuenta del negocio';
  end if;
  if exists (select 1 from public.order_settlements where order_id = o.id) then
    raise exception 'En fase 1 la plataforma no reparte';
  end if;
end $$;
select pg_temp.expect_error(
  format('select public.submit_order_transfer(%L, %L, %L)', current_setting('test.order7'), 'REF1', 'pedidos/otro/archivo.jpg'),
  'Comprobante inválido');
select public.submit_order_transfer(current_setting('test.order7')::uuid, 'REF-777',
  'pedidos/' || current_setting('test.order7') || '/comprobante.jpg');
select pg_temp.expect_error(
  format('select public.cancel_order(%L)', current_setting('test.order7')),
  'revisando tu transferencia');

-- El negocio lo rechaza, el cliente reenvía y el negocio confirma: entra el pedido
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.store_review_transfer(current_setting('test.order7')::uuid, false, 'No llegó');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.submit_order_transfer(current_setting('test.order7')::uuid, 'REF-778',
  'pedidos/' || current_setting('test.order7') || '/comprobante2.jpg');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.store_review_transfer(current_setting('test.order7')::uuid, true);
do $$ begin
  if (select estado::text || '/' || estado_pago from public.orders where id = current_setting('test.order7')::uuid)
     <> 'pendiente/pagado' then
    raise exception 'Confirmar la transferencia no hizo entrar el pedido';
  end if;
end $$;

-- Suscripción: la aprobación dio 30 días de prueba
do $$ begin
  if (select plan from public.subscriptions where store_id = '00000000-0000-0000-0000-0000000000a1') <> 'prueba' then
    raise exception 'El negocio aprobado no tiene su prueba';
  end if;
  if (public.get_subscription_offer() ->> 'anual')::numeric <> 10200 then
    raise exception 'El plan anual del negocio debe ser 10,200 (15%% de descuento)';
  end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
do $$ begin
  if (public.get_subscription_offer() ->> 'anual')::numeric <> 5100 then
    raise exception 'El plan anual del repartidor debe ser 5,100';
  end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error('select public.get_subscription_offer()', 'Solo negocios y repartidores');

-- Vencida más allá de la gracia: el negocio sale del catálogo y no recibe pedidos
reset role;
update public.subscriptions set vigente_hasta = now() - interval '6 days'
where store_id = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
select pg_temp.as_user('');
do $$ begin
  if (select count(*) from public.catalog_products) <> 0 or (select count(*) from public.stores) <> 0 then
    raise exception 'Un negocio con la suscripción vencida sigue en el catálogo';
  end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.expect_error(
  $$select public.checkout('00000000-0000-0000-0000-0000000000a1', 'Casa', '[{"product_id":"00000000-0000-0000-0000-0000000000f1","cantidad":1}]')$$,
  'no está disponible');
-- Dentro de la gracia sigue operando
reset role;
update public.subscriptions set vigente_hasta = now() - interval '3 days'
where store_id = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
select pg_temp.as_user('');
do $$ begin
  if (select count(*) from public.catalog_products) = 0 then raise exception 'La gracia de 5 días no se respeta'; end if;
end $$;

-- El negocio paga el año: el admin aprueba y la vigencia se extiende un año
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error(
  $$select public.submit_subscription_payment('anual', 'TRX-9', 'suscripciones/otro-usuario/x.jpg')$$,
  'Comprobante inválido');
select set_config('test.subpay', public.submit_subscription_payment('anual', 'TRX-9',
  'suscripciones/00000000-0000-0000-0000-00000000000b/pago.jpg')::text, false);
select pg_temp.expect_error(
  $$select public.submit_subscription_payment('mensual', 'TRX-10', 'suscripciones/00000000-0000-0000-0000-00000000000b/p2.jpg')$$,
  'pago en revisión');
select pg_temp.expect_error(format('select public.review_subscription_payment(%L, true)', current_setting('test.subpay')),
  'Solo un administrador');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if (select monto from public.subscription_payments where id = current_setting('test.subpay')::uuid) <> 10200 then
    raise exception 'El pago anual no tomó el precio con descuento';
  end if;
end $$;
select public.review_subscription_payment(current_setting('test.subpay')::uuid, true);
do $$ begin
  if (select vigente_hasta from public.subscriptions where store_id = '00000000-0000-0000-0000-0000000000a1')
     < now() + interval '360 days' then
    raise exception 'Aprobar el pago anual no extendió la vigencia un año';
  end if;
end $$;

-- Repartidor con la suscripción vencida no puede aceptar entregas
reset role;
update public.subscriptions set vigente_hasta = now() - interval '10 days'
where courier_id = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.store_advance_order(current_setting('test.order7')::uuid);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
reset role;
update public.couriers set disponible = true where id = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
select pg_temp.expect_error(format('select public.claim_order(%L)', current_setting('test.order7')), 'suscripción está vencida');

-- El pedido guarda el nombre y la dirección del negocio y el nombre de cada producto
do $$ declare o public.orders%rowtype; begin
  select * into o from public.orders where id = current_setting('test.order7')::uuid;
  if o.tienda_nombre <> 'Boutique' or o.tienda_direccion <> 'Calle Duarte 1' then
    raise exception 'El pedido no guardó el nombre y la dirección del negocio';
  end if;
  if (select nombre from public.order_items where order_id = o.id) <> 'Blusa' then
    raise exception 'La línea del pedido no guardó el nombre del producto';
  end if;
end $$;

-- Con el negocio pausado, el cliente sigue viendo los nombres en su pedido
reset role;
update public.subscriptions set vigente_hasta = now() - interval '10 days'
where store_id = '00000000-0000-0000-0000-0000000000a1';
update public.users set telefono = '8095550009' where id = '00000000-0000-0000-0000-00000000000d';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  if exists (select 1 from public.stores) then raise exception 'El negocio pausado debería estar oculto'; end if;
  if (select tienda_nombre from public.orders where id = current_setting('test.order7')::uuid) <> 'Boutique'
     or (select nombre from public.order_items where order_id = current_setting('test.order7')::uuid) <> 'Blusa' then
    raise exception 'El cliente perdió los nombres de su pedido con el negocio pausado';
  end if;
end $$;

-- El negocio cancela un pedido pagado por transferencia: devuelve el dinero y lo marca
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.cancel_order(current_setting('test.order7')::uuid);
do $$ begin
  if (select estado_pago from public.orders where id = current_setting('test.order7')::uuid) <> 'reembolso_pendiente' then
    raise exception 'Cancelar un pedido pagado por transferencia debe dejar el reembolso pendiente';
  end if;
  if (select cliente_telefono from public.get_order_contacts(current_setting('test.order7')::uuid)) is null then
    raise exception 'El negocio necesita el teléfono del cliente para devolverle el dinero';
  end if;
end $$;
select pg_temp.expect_error(format('select public.store_mark_refunded(%L, %L)', current_setting('test.order7'), ' '),
  'referencia de la devolución');
select pg_temp.expect_error(format('select public.store_mark_refunded(%L, %L)', current_setting('test.order4'), 'X'),
  'lo gestiona AltaEntrega');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.expect_error(format('select public.store_mark_refunded(%L, %L)', current_setting('test.order7'), 'X'),
  'no pertenece a tu negocio');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.store_mark_refunded(current_setting('test.order7')::uuid, 'DEV-1');
do $$ declare o public.orders%rowtype; begin
  select * into o from public.orders where id = current_setting('test.order7')::uuid;
  if o.estado_pago <> 'reembolsado' or o.reembolso_referencia <> 'DEV-1' or o.reembolsado_at is null then
    raise exception 'El reembolso del negocio no quedó registrado';
  end if;
  if (select cliente_telefono from public.get_order_contacts(o.id)) is not null then
    raise exception 'Tras el reembolso el negocio ya no debe ver el teléfono del cliente';
  end if;
end $$;
select pg_temp.expect_error(format('select public.store_mark_refunded(%L, %L)', current_setting('test.order7'), 'DEV-2'),
  'no tiene un reembolso pendiente');

reset role;

-- ─────────────────────────────────────────────────────────────
-- Eliminar la cuenta (delete_my_account)
-- ─────────────────────────────────────────────────────────────
select pg_temp.as_user('');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b2', 't2@x.com'),
  ('00000000-0000-0000-0000-0000000000b3', 't3@x.com'),
  ('00000000-0000-0000-0000-0000000000c4', 'c4@x.com'),
  ('00000000-0000-0000-0000-0000000000c5', 'c5@x.com'),
  ('00000000-0000-0000-0000-0000000000d3', 'd3@x.com');
insert into public.users (id, email, rol, nombre) values
  ('00000000-0000-0000-0000-0000000000b2', 't2@x.com', 'tienda', 'Tienda2'),
  ('00000000-0000-0000-0000-0000000000b3', 't3@x.com', 'tienda', 'Tienda3'),
  ('00000000-0000-0000-0000-0000000000c4', 'c4@x.com', 'cliente', 'Cliente4'),
  ('00000000-0000-0000-0000-0000000000c5', 'c5@x.com', 'cliente', 'Cliente5'),
  ('00000000-0000-0000-0000-0000000000d3', 'd3@x.com', 'courier', 'Rep3');
insert into public.stores (id, user_id, nombre, direccion, categoria, estado) values
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b2', 'Colmado', 'Calle 2', 'boutique', 'aprobado'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b3', 'Sin ventas', 'Calle 3', 'boutique', 'aprobado');
insert into public.couriers (id, user_id, vehiculo, documento_identidad, matricula, estado) values
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000d3', 'moto', '33333333333', 'K444444', 'aprobado');
insert into public.store_payout_accounts (store_id, banco, tipo_cuenta, numero_cuenta, titular, documento)
values ('00000000-0000-0000-0000-0000000000a2', 'Banco', 'ahorros', '1234567', 'Tienda2', '00100000001');
insert into public.subscription_payments (subscription_id, plan, monto, referencia, comprobante_path, estado)
select sub.id, 'mensual', 500, r, 'suscripciones/x/' || r, e
from public.subscriptions sub, (values ('PAGO-OK', 'aprobado'), ('PAGO-PEND', 'por_confirmar')) v(r, e)
where sub.courier_id = '00000000-0000-0000-0000-0000000000e3';
insert into public.products (id, store_id, nombre, precio, stock) values
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a2', 'Vendido', 10, 5),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000a2', 'Sin vender', 10, 5),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000a3', 'Otro', 10, 5);
insert into public.orders (id, cliente_id, store_id, courier_id, estado, direccion_entrega, subtotal, total, metodo_pago, tienda_nombre, tienda_direccion) values
  ('00000000-0000-0000-0000-00000000a0d1', '00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000a2',
   '00000000-0000-0000-0000-0000000000e3', 'entregado', 'Casa de Cliente4', 10, 10, 'efectivo', 'Colmado', 'Calle 2'),
  ('00000000-0000-0000-0000-00000000a0d2', '00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000a1',
   null, 'pendiente', 'Casa de Cliente5', 10, 10, 'efectivo', 'Boutique', 'Calle Duarte 1');
insert into public.order_items (order_id, product_id, cantidad, precio_unitario, nombre) values
  ('00000000-0000-0000-0000-00000000a0d1', '00000000-0000-0000-0000-0000000000f2', 1, 10, 'Vendido');

set role authenticated;

-- Sin sesión, el admin y quien tiene un pedido en curso no pueden eliminar la cuenta
select pg_temp.expect_error('select public.delete_my_account()', 'Inicia sesión');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error('select public.delete_my_account()', 'administrador');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c5');
select pg_temp.expect_error('select public.delete_my_account()', 'pedidos en curso');
do $$ begin
  if public.account_deletion_blocker() not like 'Tienes pedidos en curso%' then
    raise exception 'account_deletion_blocker debe avisar del pedido en curso';
  end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c4');
do $$ begin
  if public.account_deletion_blocker() is not null then
    raise exception 'account_deletion_blocker no debe bloquear a un cliente sin pedidos en curso';
  end if;
end $$;

-- Cliente con un pedido entregado: el pedido queda sin dueño y sin dirección
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c4');
select public.delete_my_account();
reset role;
do $$ declare o public.orders%rowtype; begin
  if exists (select 1 from auth.users where id = '00000000-0000-0000-0000-0000000000c4')
     or exists (select 1 from public.users where id = '00000000-0000-0000-0000-0000000000c4') then
    raise exception 'El cliente eliminado sigue existiendo';
  end if;
  select * into o from public.orders where id = '00000000-0000-0000-0000-00000000a0d1';
  if not found or o.cliente_id is not null or o.direccion_entrega <> 'Cuenta eliminada' then
    raise exception 'El pedido del cliente eliminado debe quedar sin dueño y sin dirección';
  end if;
end $$;
set role authenticated;

-- Repartidor: se borra su ficha y su entrega pasada queda sin repartidor
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d3');
select public.delete_my_account();
reset role;
do $$ begin
  if exists (select 1 from public.couriers where id = '00000000-0000-0000-0000-0000000000e3') then
    raise exception 'La ficha del repartidor eliminado sigue existiendo';
  end if;
  if (select courier_id from public.orders where id = '00000000-0000-0000-0000-00000000a0d1') is not null then
    raise exception 'La entrega del repartidor eliminado debe quedar sin repartidor';
  end if;
  if not exists (select 1 from public.subscription_payments where referencia = 'PAGO-OK' and subscription_id is null)
     or exists (select 1 from public.subscription_payments where referencia = 'PAGO-PEND') then
    raise exception 'Del repartidor eliminado solo debe quedar el pago de suscripción aprobado';
  end if;
end $$;
set role authenticated;

-- Negocio con ventas: queda oculto y sin dueño; se borran los productos sin ventas
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select public.delete_my_account();
reset role;
do $$ declare s public.stores%rowtype; begin
  select * into s from public.stores where id = '00000000-0000-0000-0000-0000000000a2';
  if not found or s.user_id is not null or s.estado <> 'rechazado' or s.eliminada_at is null then
    raise exception 'El negocio con ventas debe quedar oculto y sin dueño';
  end if;
  if exists (select 1 from public.subscriptions where store_id = s.id)
     or exists (select 1 from public.store_payout_accounts where store_id = s.id) then
    raise exception 'La suscripción o la cuenta bancaria del negocio eliminado siguen existiendo';
  end if;
  if exists (select 1 from public.products where id = '00000000-0000-0000-0000-0000000000f3')
     or (select activo from public.products where id = '00000000-0000-0000-0000-0000000000f2') then
    raise exception 'Los productos del negocio eliminado no se limpiaron';
  end if;
end $$;
set role authenticated;

-- Negocio sin ventas: se borra entero
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
select public.delete_my_account();
reset role;
do $$ begin
  if exists (select 1 from public.stores where id = '00000000-0000-0000-0000-0000000000a3')
     or exists (select 1 from public.products where id = '00000000-0000-0000-0000-0000000000f4') then
    raise exception 'El negocio sin ventas debe borrarse entero';
  end if;
end $$;

-- Foto de perfil: solo una ruta dentro de la carpeta del propio usuario
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'e1@x.com');
insert into public.users (id, email, rol, nombre) values
  ('00000000-0000-0000-0000-0000000000e1', 'e1@x.com', 'cliente', 'Con foto');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
update public.users set avatar_path = '00000000-0000-0000-0000-0000000000e1/foto.webp'
  where id = '00000000-0000-0000-0000-0000000000e1';
select pg_temp.expect_error(
  $q$update public.users set avatar_path = '00000000-0000-0000-0000-00000000000c/foto.webp'
     where id = '00000000-0000-0000-0000-0000000000e1'$q$,
  'users_avatar_path_own_folder');
select pg_temp.expect_error(
  $q$update public.users set avatar_path = 'https://otro-sitio.com/foto.png'
     where id = '00000000-0000-0000-0000-0000000000e1'$q$,
  'users_avatar_path_own_folder');
reset role;

\echo 'OK: todas las pruebas de base de datos pasaron'
