-- Fases de cobro de AltaEntrega (se cambian en /admin → platform_settings.fase):
--
--   'suscripciones' (fase 1, inicio): negocios y repartidores pagan una
--       suscripción mensual o anual (15% de descuento) por transferencia a la
--       cuenta del fundador; el cliente usa la plataforma gratis y le paga el
--       pedido al negocio por transferencia, subiendo el comprobante; el
--       negocio lo confirma. Precios sin comisión.
--   'azul' (fase 2, con más popularidad): pago con tarjeta por AZUL, 5% de
--       comisión y reparto al cobrar (migraciones 20260930000003 y 06).
--
-- Suscripciones: 30 días de prueba desde la aprobación; si vence, 5 días de
-- gracia y luego el negocio no sale en el catálogo y el repartidor no puede
-- aceptar entregas, hasta que pague. Solo se aplican en la fase 1.

-- ─────────────────────────────────────────────────────────────
-- Configuración
-- ─────────────────────────────────────────────────────────────

alter table public.platform_settings
  add column fase text not null default 'suscripciones' check (fase in ('suscripciones', 'azul')),
  add column precio_negocio_mensual numeric(10, 2) not null default 1000 check (precio_negocio_mensual >= 0),
  add column precio_delivery_mensual numeric(10, 2) not null default 500 check (precio_delivery_mensual >= 0),
  add column descuento_anual numeric(4, 3) not null default 0.15 check (descuento_anual >= 0 and descuento_anual < 0.9),
  add column dias_prueba integer not null default 30 check (dias_prueba between 0 and 365),
  add column dias_gracia integer not null default 5 check (dias_gracia between 0 and 60),
  add column horas_para_transferir integer not null default 12 check (horas_para_transferir between 1 and 168);

-- Lo que cualquiera puede saber de la configuración (sin la comisión).
create or replace function public.get_public_config()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('fase', fase, 'delivery_fee', delivery_fee, 'horas_para_transferir', horas_para_transferir)
  from public.platform_settings;
$$;

grant execute on function public.get_public_config() to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Pedidos pagados por transferencia
-- ─────────────────────────────────────────────────────────────

alter table public.orders drop constraint orders_estado_pago_check;
alter table public.orders
  add constraint orders_estado_pago_check check (estado_pago in (
    'pendiente', 'por_confirmar', 'pagado', 'rechazado', 'expirado', 'reembolso_pendiente', 'reembolsado'
  )),
  add column comprobante_path text,
  add column pago_motivo_rechazo text;

-- ─────────────────────────────────────────────────────────────
-- Suscripciones
-- ─────────────────────────────────────────────────────────────

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid unique references public.stores (id) on delete cascade,
  courier_id uuid unique references public.couriers (id) on delete cascade,
  plan text not null default 'prueba' check (plan in ('prueba', 'mensual', 'anual')),
  vigente_hasta timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(store_id, courier_id) = 1)
);

create trigger trg_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  plan text not null check (plan in ('mensual', 'anual')),
  monto numeric(10, 2) not null check (monto >= 0),
  referencia text not null check (char_length(referencia) between 1 and 100),
  comprobante_path text not null,
  estado text not null default 'por_confirmar' check (estado in ('por_confirmar', 'aprobado', 'rechazado')),
  motivo_rechazo text,
  created_at timestamptz not null default now(),
  revisado_at timestamptz
);

create index subscription_payments_estado_idx on public.subscription_payments (estado, created_at);

alter table public.subscriptions enable row level security;
alter table public.subscription_payments enable row level security;

create or replace function public.owns_subscription(p_subscription_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions sub
    left join public.stores s on s.id = sub.store_id
    left join public.couriers c on c.id = sub.courier_id
    where sub.id = p_subscription_id and (s.user_id = auth.uid() or c.user_id = auth.uid())
  );
$$;

revoke all on function public.owns_subscription(uuid) from public, anon;
grant execute on function public.owns_subscription(uuid) to authenticated;

create policy "subscriptions_select_owner_or_admin"
  on public.subscriptions for select
  using (public.current_user_role() = 'admin' or public.owns_subscription(id));

create policy "subscription_payments_select_owner_or_admin"
  on public.subscription_payments for select
  using (public.current_user_role() = 'admin' or public.owns_subscription(subscription_id));

-- ¿El negocio o repartidor puede operar? En fase 2 las suscripciones no aplican.
create or replace function public.subscription_ok(p_store_id uuid, p_courier_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when (select fase from public.platform_settings) <> 'suscripciones' then true
    else exists (
      select 1 from public.subscriptions sub
      where (sub.store_id = p_store_id or sub.courier_id = p_courier_id)
        and sub.vigente_hasta + make_interval(days => (select dias_gracia from public.platform_settings)) >= now()
    )
  end;
$$;

grant execute on function public.subscription_ok(uuid, uuid) to anon, authenticated;

-- Al aprobar un negocio o repartidor empieza su prueba gratis.
create or replace function public.start_trial_on_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dias integer := (select dias_prueba from public.platform_settings);
begin
  if new.estado = 'aprobado' and (tg_op = 'INSERT' or old.estado is distinct from 'aprobado') then
    if tg_table_name = 'stores' then
      insert into public.subscriptions (store_id, vigente_hasta)
      values (new.id, now() + make_interval(days => v_dias))
      on conflict (store_id) do nothing;
    else
      insert into public.subscriptions (courier_id, vigente_hasta)
      values (new.id, now() + make_interval(days => v_dias))
      on conflict (courier_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_stores_start_trial
after insert or update of estado on public.stores
for each row execute function public.start_trial_on_approval();

create trigger trg_couriers_start_trial
after insert or update of estado on public.couriers
for each row execute function public.start_trial_on_approval();

-- Los ya aprobados empiezan su prueba hoy.
insert into public.subscriptions (store_id, vigente_hasta)
select id, now() + interval '30 days' from public.stores where estado = 'aprobado'
on conflict (store_id) do nothing;
insert into public.subscriptions (courier_id, vigente_hasta)
select id, now() + interval '30 days' from public.couriers where estado = 'aprobado'
on conflict (courier_id) do nothing;

-- Oferta para el negocio o repartidor que llama: precios de su tipo y la
-- cuenta del fundador a la que debe transferir.
create or replace function public.get_subscription_offer()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rol user_role := public.current_user_role();
  v_ps public.platform_settings%rowtype;
  v_mensual numeric;
begin
  if v_rol not in ('tienda', 'courier') then
    raise exception 'Solo negocios y repartidores tienen suscripción';
  end if;

  select * into v_ps from public.platform_settings;
  v_mensual := case when v_rol = 'tienda' then v_ps.precio_negocio_mensual else v_ps.precio_delivery_mensual end;

  return jsonb_build_object(
    'fase', v_ps.fase,
    'mensual', v_mensual,
    'anual', round(v_mensual * 12 * (1 - v_ps.descuento_anual), 2),
    'descuento_anual', v_ps.descuento_anual,
    'dias_gracia', v_ps.dias_gracia,
    'cuenta', case when v_ps.ganancias_numero_cuenta is null then null else jsonb_build_object(
      'banco', v_ps.ganancias_banco, 'tipo_cuenta', v_ps.ganancias_tipo_cuenta,
      'numero_cuenta', v_ps.ganancias_numero_cuenta, 'titular', v_ps.ganancias_titular,
      'documento', v_ps.ganancias_documento) end
  );
end;
$$;

revoke all on function public.get_subscription_offer() from public, anon;
grant execute on function public.get_subscription_offer() to authenticated;

-- El negocio o repartidor envía el comprobante de su pago.
create or replace function public.submit_subscription_payment(
  p_plan text,
  p_referencia text,
  p_comprobante_path text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub_id uuid;
  v_offer jsonb := public.get_subscription_offer();
  v_id uuid;
begin
  if p_plan not in ('mensual', 'anual') then
    raise exception 'Elige el plan mensual o anual';
  end if;
  if p_referencia is null or btrim(p_referencia) = '' then
    raise exception 'Escribe la referencia de tu transferencia';
  end if;

  select sub.id into v_sub_id
  from public.subscriptions sub
  left join public.stores s on s.id = sub.store_id
  left join public.couriers c on c.id = sub.courier_id
  where s.user_id = auth.uid() or c.user_id = auth.uid();

  if v_sub_id is null then
    raise exception 'Tu cuenta todavía no fue aprobada';
  end if;

  -- El comprobante tiene que estar en la carpeta del usuario.
  if p_comprobante_path not like 'suscripciones/' || auth.uid()::text || '/%' then
    raise exception 'Comprobante inválido';
  end if;

  if exists (select 1 from public.subscription_payments where subscription_id = v_sub_id and estado = 'por_confirmar') then
    raise exception 'Ya tienes un pago en revisión. Espera a que lo confirmemos.';
  end if;

  insert into public.subscription_payments (subscription_id, plan, monto, referencia, comprobante_path)
  values (v_sub_id, p_plan, (v_offer ->> p_plan)::numeric, btrim(p_referencia), p_comprobante_path)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_subscription_payment(text, text, text) from public, anon;
grant execute on function public.submit_subscription_payment(text, text, text) to authenticated;

-- El admin aprueba o rechaza un pago de suscripción. Al aprobar, extiende la
-- vigencia desde hoy o desde el vencimiento actual si todavía está vigente.
create or replace function public.review_subscription_payment(p_payment_id uuid, p_aprobar boolean, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay public.subscription_payments%rowtype;
begin
  if public.current_user_role() is distinct from 'admin' then
    raise exception 'Solo un administrador puede revisar pagos de suscripción';
  end if;

  select * into v_pay from public.subscription_payments where id = p_payment_id for update;
  if not found or v_pay.estado <> 'por_confirmar' then
    raise exception 'Este pago ya fue revisado';
  end if;

  if not p_aprobar then
    update public.subscription_payments
    set estado = 'rechazado', motivo_rechazo = nullif(btrim(p_motivo), ''), revisado_at = now()
    where id = p_payment_id;
    return;
  end if;

  update public.subscription_payments set estado = 'aprobado', revisado_at = now() where id = p_payment_id;

  update public.subscriptions
  set plan = v_pay.plan,
      vigente_hasta = greatest(vigente_hasta, now())
        + case when v_pay.plan = 'anual' then interval '1 year' else interval '1 month' end
  where id = v_pay.subscription_id;
end;
$$;

revoke all on function public.review_subscription_payment(uuid, boolean, text) from public, anon;
grant execute on function public.review_subscription_payment(uuid, boolean, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Catálogo: solo negocios con la suscripción al día; en fase 1 sin comisión
-- ─────────────────────────────────────────────────────────────

drop policy "stores_select_owner_admin_or_approved" on public.stores;

create policy "stores_select_owner_admin_or_approved"
  on public.stores for select
  using (
    user_id = auth.uid()
    or public.current_user_role() = 'admin'
    or (estado = 'aprobado' and public.subscription_ok(id, null))
  );

create or replace view public.catalog_products
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
  round(p.precio * (1 + case when ps.fase = 'azul' then ps.commission_rate else 0 end), 2) as precio
from public.products p
join public.stores s on s.id = p.store_id and s.estado = 'aprobado'
cross join public.platform_settings ps
where public.subscription_ok(s.id, null);

-- ─────────────────────────────────────────────────────────────
-- Pago de pedidos por transferencia al negocio
-- ─────────────────────────────────────────────────────────────

-- Cuenta del negocio a la que el cliente debe transferir (solo el cliente
-- del pedido, mientras espera pago).
create or replace function public.get_order_payment_account(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('banco', a.banco, 'tipo_cuenta', a.tipo_cuenta, 'numero_cuenta', a.numero_cuenta,
                            'titular', a.titular, 'documento', a.documento)
  from public.orders o
  join public.store_payout_accounts a on a.store_id = o.store_id
  where o.id = p_order_id and o.cliente_id = auth.uid() and o.estado = 'esperando_pago';
$$;

revoke all on function public.get_order_payment_account(uuid) from public, anon;
grant execute on function public.get_order_payment_account(uuid) to authenticated;

-- El cliente avisa que transfirió y sube el comprobante.
create or replace function public.submit_order_transfer(p_order_id uuid, p_referencia text, p_comprobante_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;

  if not found or v_order.cliente_id is distinct from auth.uid() then
    raise exception 'Pedido no encontrado';
  end if;
  if v_order.estado <> 'esperando_pago' or v_order.metodo_pago <> 'transferencia' then
    raise exception 'Este pedido ya no espera una transferencia';
  end if;
  if v_order.estado_pago = 'por_confirmar' then
    raise exception 'Ya enviaste tu comprobante; el negocio lo está revisando';
  end if;
  if p_referencia is null or btrim(p_referencia) = '' or length(p_referencia) > 100 then
    raise exception 'Escribe la referencia de tu transferencia';
  end if;
  if p_comprobante_path not like 'pedidos/' || p_order_id::text || '/%' then
    raise exception 'Comprobante inválido';
  end if;

  update public.orders
  set estado_pago = 'por_confirmar', pago_referencia = btrim(p_referencia),
      comprobante_path = p_comprobante_path, pago_motivo_rechazo = null
  where id = p_order_id;
end;
$$;

revoke all on function public.submit_order_transfer(uuid, text, text) from public, anon;
grant execute on function public.submit_order_transfer(uuid, text, text) to authenticated;

-- El negocio confirma que recibió la transferencia (el pedido entra) o la
-- rechaza (el cliente puede enviar otro comprobante).
create or replace function public.store_review_transfer(p_order_id uuid, p_aprobar boolean, p_motivo text default null)
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
  if v_order.estado <> 'esperando_pago' or v_order.estado_pago <> 'por_confirmar' then
    raise exception 'Este pedido no tiene una transferencia por confirmar';
  end if;

  if p_aprobar then
    update public.orders
    set estado = 'pendiente', estado_pago = 'pagado', pagado_at = now()
    where id = p_order_id;
  else
    update public.orders
    set estado_pago = 'rechazado', pago_motivo_rechazo = nullif(btrim(p_motivo), '')
    where id = p_order_id;
  end if;
end;
$$;

revoke all on function public.store_review_transfer(uuid, boolean, text) from public, anon;
grant execute on function public.store_review_transfer(uuid, boolean, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Comprobantes (Storage privado)
-- ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- Rutas: pedidos/<order_id>/<archivo> y suscripciones/<user_id>/<archivo>.
create policy "comprobantes_insert_owner"
  on storage.objects for insert
  with check (
    bucket_id = 'comprobantes'
    and (
      ((storage.foldername(name))[1] = 'pedidos' and exists (
        select 1 from public.orders o
        where o.id::text = (storage.foldername(name))[2] and o.cliente_id = auth.uid()
      ))
      or ((storage.foldername(name))[1] = 'suscripciones' and (storage.foldername(name))[2] = auth.uid()::text)
    )
  );

create policy "comprobantes_select_involved"
  on storage.objects for select
  using (
    bucket_id = 'comprobantes'
    and (
      public.current_user_role() = 'admin'
      or ((storage.foldername(name))[1] = 'pedidos' and exists (
        select 1 from public.orders o
        left join public.stores s on s.id = o.store_id
        where o.id::text = (storage.foldername(name))[2]
          and (o.cliente_id = auth.uid() or s.user_id = auth.uid())
      ))
      or ((storage.foldername(name))[1] = 'suscripciones' and (storage.foldername(name))[2] = auth.uid()::text)
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Funciones existentes adaptadas a las fases
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
    cliente_id, store_id, direccion_entrega, subtotal, delivery_fee, total, metodo_pago, estado
  )
  values (
    v_cliente_id, p_store_id, btrim(p_direccion_entrega), 0, v_fee, 0,
    case when v_fase = 'azul' then 'tarjeta' else 'transferencia' end::payment_method, 'esperando_pago'
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

  -- Solo en fase 2 la plataforma cobra y reparte. El delivery lo cobra el
  -- repartidor en efectivo: la plataforma no le debe nada.
  if v_fase = 'azul' then
    insert into public.order_settlements (order_id, store_id, monto_tienda, monto_delivery, comision)
    values (v_order_id, p_store_id, v_monto_tienda, 0, v_subtotal - v_monto_tienda);
  end if;

  return v_order_id;
end;
$$;

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
    if v_order.estado_pago = 'por_confirmar' then
      raise exception 'El negocio está revisando tu transferencia. Para cancelar, contacta al negocio.';
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
      estado_pago = case
        when v_order.estado_pago in ('pagado', 'por_confirmar') then 'reembolso_pendiente'
        else v_order.estado_pago
      end
  where id = p_order_id;
end;
$$;

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

  if not public.subscription_ok(null, v_courier.id) then
    raise exception 'Tu suscripción está vencida. Renuévala en "Mi suscripción" para aceptar entregas.';
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
    where estado = 'esperando_pago'
      -- Un comprobante enviado espera a que el negocio lo revise.
      and estado_pago <> 'por_confirmar'
      and created_at < now() - case
        when metodo_pago = 'transferencia'
          then make_interval(hours => (select horas_para_transferir from public.platform_settings))
        else interval '30 minutes'
      end
    order by id
    for update skip locked
  loop
    perform public.restore_order_stock(v_id);
    update public.orders set estado = 'cancelado', estado_pago = 'expirado' where id = v_id;
  end loop;
end;
$$;
