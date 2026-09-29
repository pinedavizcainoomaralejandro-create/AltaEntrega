-- Nuevo modelo de cobro y reparto:
--
-- 1. Delivery contra entrega: en línea (AZUL) solo se cobran los productos;
--    el cliente le paga el delivery en efectivo al repartidor, que se lo
--    queda. orders.total sigue siendo el total del pedido (productos +
--    delivery) y orders.subtotal es lo que se cobra en línea.
-- 2. Reparto en el momento del cobro: cuando se aprueba el pago, en la misma
--    transacción se crean dos transferencias (payouts):
--      - al dueño del negocio, por el precio que publicó, a la cuenta
--        bancaria que registró (store_payout_accounts);
--      - a la cuenta de ganancias que eligió el fundador, por la comisión
--        (platform_settings.ganancias_*).
--    Quién ejecuta la transferencia lo decide el conector de pagos de la app
--    (manual hoy; AZUL o una API bancaria cuando estén disponibles).
-- 3. Libro de movimientos (ledger_entries) con el saldo de cada negocio y de
--    la plataforma: crédito al cobrar, débito cuando la transferencia se
--    completa, reverso si se cancela un pedido pagado.

-- ─────────────────────────────────────────────────────────────
-- Cuentas bancarias
-- ─────────────────────────────────────────────────────────────

create table public.store_payout_accounts (
  store_id uuid primary key references public.stores (id) on delete cascade,
  banco text not null check (char_length(banco) between 2 and 60),
  tipo_cuenta text not null check (tipo_cuenta in ('ahorros', 'corriente')),
  numero_cuenta text not null check (numero_cuenta ~ '^[0-9]{6,20}$'),
  titular text not null check (char_length(titular) between 2 and 100),
  documento text not null check (documento ~ '^[0-9]{9,11}$'),
  updated_at timestamptz not null default now()
);

alter table public.store_payout_accounts enable row level security;

create policy "store_payout_accounts_owner_or_admin_select"
  on public.store_payout_accounts for select
  using (
    public.current_user_role() = 'admin'
    or exists (select 1 from public.stores s where s.id = store_payout_accounts.store_id and s.user_id = auth.uid())
  );

create policy "store_payout_accounts_owner_insert"
  on public.store_payout_accounts for insert
  with check (exists (select 1 from public.stores s where s.id = store_payout_accounts.store_id and s.user_id = auth.uid()));

create policy "store_payout_accounts_owner_update"
  on public.store_payout_accounts for update
  using (exists (select 1 from public.stores s where s.id = store_payout_accounts.store_id and s.user_id = auth.uid()));

create trigger trg_store_payout_accounts_updated_at
before update on public.store_payout_accounts
for each row execute function public.set_updated_at();

-- Cuenta de ganancias del fundador (platform_settings ya es solo admin).
alter table public.platform_settings
  add column ganancias_banco text,
  add column ganancias_tipo_cuenta text check (ganancias_tipo_cuenta in ('ahorros', 'corriente')),
  add column ganancias_numero_cuenta text check (ganancias_numero_cuenta ~ '^[0-9]{6,20}$'),
  add column ganancias_titular text,
  add column ganancias_documento text check (ganancias_documento ~ '^[0-9]{9,11}$');

-- ─────────────────────────────────────────────────────────────
-- Libro de movimientos
-- ─────────────────────────────────────────────────────────────

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  cuenta text not null check (cuenta in ('tienda', 'plataforma')),
  store_id uuid references public.stores (id),
  order_id uuid references public.orders (id),
  tipo text not null check (tipo in ('venta', 'comision', 'reverso', 'transferencia')),
  monto numeric(12, 2) not null,
  referencia text,
  check ((cuenta = 'tienda') = (store_id is not null))
);

create index ledger_entries_store_idx on public.ledger_entries (store_id, created_at desc);
create index ledger_entries_cuenta_idx on public.ledger_entries (cuenta, created_at desc);

alter table public.ledger_entries enable row level security;

-- Solo lectura: los movimientos los escriben las funciones SECURITY DEFINER.
create policy "ledger_entries_select_store_or_admin"
  on public.ledger_entries for select
  using (
    public.current_user_role() = 'admin'
    or (
      cuenta = 'tienda'
      and exists (select 1 from public.stores s where s.id = ledger_entries.store_id and s.user_id = auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Transferencias (payouts)
-- ─────────────────────────────────────────────────────────────

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  order_id uuid not null references public.orders (id),
  destino text not null check (destino in ('tienda', 'plataforma')),
  store_id uuid references public.stores (id),
  monto numeric(12, 2) not null check (monto > 0),
  -- Copia de la cuenta destino en el momento del cobro (null si el negocio
  -- todavía no registró su cuenta: queda pendiente hasta que lo haga).
  cuenta jsonb,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'enviado', 'completado', 'fallido', 'cancelado')),
  proveedor text not null default 'manual',
  referencia text,
  error text,
  completado_at timestamptz,
  check ((destino = 'tienda') = (store_id is not null))
);

create index payouts_estado_idx on public.payouts (estado, created_at);
create index payouts_store_idx on public.payouts (store_id, created_at desc);

alter table public.payouts enable row level security;

create policy "payouts_select_store_or_admin"
  on public.payouts for select
  using (
    public.current_user_role() = 'admin'
    or (
      destino = 'tienda'
      and exists (select 1 from public.stores s where s.id = payouts.store_id and s.user_id = auth.uid())
    )
  );

-- Cuenta destino actual de un payout (la del negocio o la de ganancias).
create or replace function public.payout_destination(p_destino text, p_store_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_destino = 'tienda' then (
      select jsonb_build_object('banco', banco, 'tipo_cuenta', tipo_cuenta, 'numero_cuenta', numero_cuenta,
                                'titular', titular, 'documento', documento)
      from public.store_payout_accounts where store_id = p_store_id
    )
    else (
      select case when ganancias_numero_cuenta is null then null else
        jsonb_build_object('banco', ganancias_banco, 'tipo_cuenta', ganancias_tipo_cuenta,
                           'numero_cuenta', ganancias_numero_cuenta, 'titular', ganancias_titular,
                           'documento', ganancias_documento) end
      from public.platform_settings
    )
  end;
$$;

revoke all on function public.payout_destination(text, uuid) from public, anon, authenticated;

-- Actualiza el estado de una transferencia. Lo usan el conector de pagos
-- (service role) y el admin (modo manual). Al completarse, se descuenta del
-- saldo correspondiente.
create or replace function public.update_payout(
  p_payout_id uuid,
  p_estado text,
  p_referencia text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout public.payouts%rowtype;
  v_cuenta jsonb;
begin
  if auth.uid() is not null and public.current_user_role() is distinct from 'admin' then
    raise exception 'Solo un administrador puede actualizar transferencias';
  end if;

  if p_estado not in ('enviado', 'completado', 'fallido') then
    raise exception 'Estado de transferencia inválido';
  end if;

  select * into v_payout from public.payouts where id = p_payout_id for update;
  if not found then
    raise exception 'Transferencia no encontrada';
  end if;

  if v_payout.estado in ('completado', 'cancelado') then
    raise exception 'Esta transferencia ya está %', v_payout.estado;
  end if;

  -- Si al cobrar el negocio no tenía cuenta, se toma la que tenga ahora.
  v_cuenta := coalesce(v_payout.cuenta, public.payout_destination(v_payout.destino, v_payout.store_id));
  if p_estado in ('enviado', 'completado') and v_cuenta is null then
    raise exception 'La cuenta destino no está registrada';
  end if;

  update public.payouts
  set estado = p_estado,
      cuenta = v_cuenta,
      referencia = coalesce(nullif(btrim(p_referencia), ''), referencia),
      error = p_error,
      completado_at = case when p_estado = 'completado' then now() else completado_at end
  where id = p_payout_id;

  if p_estado = 'completado' then
    insert into public.ledger_entries (cuenta, store_id, order_id, tipo, monto, referencia)
    values (v_payout.destino, v_payout.store_id, v_payout.order_id, 'transferencia', -v_payout.monto,
            nullif(btrim(p_referencia), ''));
  end if;
end;
$$;

revoke all on function public.update_payout(uuid, text, text, text) from public;
grant execute on function public.update_payout(uuid, text, text, text) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- Checkout: el delivery ya no es deuda de la plataforma
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

  -- El delivery lo cobra el repartidor en efectivo: la plataforma no le debe nada.
  insert into public.order_settlements (order_id, store_id, monto_tienda, monto_delivery, comision)
  values (v_order_id, p_store_id, v_monto_tienda, 0, v_subtotal - v_monto_tienda);

  return v_order_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Pago aprobado: cobra solo productos y acredita al instante
-- ─────────────────────────────────────────────────────────────

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

  -- En línea solo se cobran los productos; el delivery se paga en efectivo.
  if round(v_order.subtotal * 100)::bigint <> p_monto_centavos then
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

  -- En el mismo instante del pago: la parte de la tienda a su saldo y la
  -- comisión a las ganancias de la plataforma.
  insert into public.ledger_entries (order_id, store_id, cuenta, tipo, monto)
  select p_order_id, st.store_id, 'tienda', 'venta', st.monto_tienda
  from public.order_settlements st where st.order_id = p_order_id
  union all
  select p_order_id, null, 'plataforma', 'comision', st.comision
  from public.order_settlements st where st.order_id = p_order_id;

  -- Y las dos transferencias: al dueño del negocio y a la cuenta de ganancias.
  insert into public.payouts (order_id, destino, store_id, monto, cuenta)
  select p_order_id, 'tienda', st.store_id, st.monto_tienda, public.payout_destination('tienda', st.store_id)
  from public.order_settlements st where st.order_id = p_order_id and st.monto_tienda > 0
  union all
  select p_order_id, 'plataforma', null, st.comision, public.payout_destination('plataforma', null)
  from public.order_settlements st where st.order_id = p_order_id and st.comision > 0;

  return 'pagado';
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Cancelación de un pedido pagado: revierte lo acreditado
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

  -- Si ya estaba pagado, se revierte lo acreditado a la tienda y a la
  -- plataforma (el dinero vuelve al cliente con el reembolso).
  if v_order.estado_pago = 'pagado' then
    insert into public.ledger_entries (order_id, store_id, cuenta, tipo, monto)
    select p_order_id, st.store_id, 'tienda', 'reverso', -st.monto_tienda
    from public.order_settlements st where st.order_id = p_order_id
    union all
    select p_order_id, null, 'plataforma', 'reverso', -st.comision
    from public.order_settlements st where st.order_id = p_order_id;

    -- Las transferencias que todavía no salieron se cancelan; las ya
    -- completadas quedan como saldo negativo que se descuenta de las
    -- próximas ventas.
    update public.payouts set estado = 'cancelado'
    where order_id = p_order_id and estado in ('pendiente', 'fallido');
  end if;

  update public.orders
  set estado = 'cancelado',
      estado_pago = case when v_order.estado_pago = 'pagado' then 'reembolso_pendiente' else v_order.estado_pago end
  where id = p_order_id;
end;
$$;
