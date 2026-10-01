-- Eliminar la cuenta desde la app (lo exigen Google Play y App Store).
--
-- public.delete_my_account() borra la cuenta del usuario que la llama:
--   - Cliente: sus pedidos terminados se conservan sin dueño (cliente_id null)
--     y sin la dirección de entrega.
--   - Negocio: si no tiene pedidos, se borra entero (productos, cuenta
--     bancaria, suscripción). Si tiene, el negocio queda oculto y sin dueño
--     para conservar los pedidos y la contabilidad; se borran la cuenta
--     bancaria, la suscripción, el logo y los productos sin ventas.
--   - Negocio y repartidor: de su suscripción solo quedan los pagos aprobados
--     (ingresos de la plataforma), sin dueño.
--   - Repartidor: se borra su ficha (cédula, matrícula, vehículo); sus
--     entregas pasadas quedan sin repartidor.
--   - Al final se borra el usuario de Supabase Auth, que borra public.users.
--
-- No se puede eliminar con pedidos en curso, reembolsos pendientes o
-- transferencias pendientes de recibir. Los administradores no pueden
-- eliminarse desde la app.
--
-- Las fotos y logos de Storage los borra la app antes de llamar a la función
-- (Supabase no permite borrar archivos de Storage con SQL).

-- ─────────────────────────────────────────────────────────────
-- 1. Pedidos y negocios que sobreviven a su dueño
-- ─────────────────────────────────────────────────────────────

alter table public.orders alter column cliente_id drop not null;
alter table public.orders drop constraint orders_cliente_id_fkey;
alter table public.orders
  add constraint orders_cliente_id_fkey
  foreign key (cliente_id) references public.users (id) on delete set null;

alter table public.stores alter column user_id drop not null;
alter table public.stores drop constraint stores_user_id_fkey;
alter table public.stores
  add constraint stores_user_id_fkey
  foreign key (user_id) references public.users (id) on delete set null;

alter table public.stores add column eliminada_at timestamptz;

-- Los pagos de suscripción aprobados son ingresos de la plataforma: se
-- conservan aunque se borre la suscripción.
alter table public.subscription_payments alter column subscription_id drop not null;
alter table public.subscription_payments drop constraint subscription_payments_subscription_id_fkey;
alter table public.subscription_payments
  add constraint subscription_payments_subscription_id_fkey
  foreign key (subscription_id) references public.subscriptions (id) on delete set null;

-- ─────────────────────────────────────────────────────────────
-- 2. Los triggers de protección dejan pasar el borrado de la cuenta
-- ─────────────────────────────────────────────────────────────
-- delete_my_account() corre con el auth.uid() del usuario, así que estos
-- triggers revertirían el cambio de estado o rechazarían el cambio de
-- dirección. La función activa "app.eliminando_cuenta" solo durante su
-- transacción; la API de Supabase no permite fijar esa variable.

create or replace function public.prevent_self_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.eliminando_cuenta', true) = 'on' then
    return new;
  end if;
  -- Igual que en 20260930000000: el rechazado puede volver a pendiente.
  if new.estado is distinct from old.estado
     and public.current_user_role() <> 'admin'
     and not (old.estado = 'rechazado' and new.estado = 'pendiente')
  then
    new.estado := old.estado;
  end if;
  return new;
end;
$$;

create or replace function public.lock_approved_store_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
    or public.current_user_role() = 'admin'
    or current_setting('app.eliminando_cuenta', true) = 'on'
  then
    return new;
  end if;

  if old.estado = 'aprobado' and (
    new.nombre is distinct from old.nombre
    or new.direccion is distinct from old.direccion
  ) then
    raise exception 'El nombre y la dirección de tu tienda ya fueron verificados. Para cambiarlos, contacta a soporte.';
  end if;

  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. account_deletion_blocker() y delete_my_account()
-- ─────────────────────────────────────────────────────────────

-- Motivo por el que el usuario actual no puede eliminar su cuenta, o null si
-- puede. La app lo consulta antes de borrar las fotos de Storage, para no
-- borrarlas si luego delete_my_account() va a fallar.
create or replace function public.account_deletion_blocker()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_store_id uuid;
  v_courier_id uuid;
begin
  if v_uid is null then
    return 'Inicia sesión para eliminar tu cuenta.';
  end if;

  if (select rol from public.users where id = v_uid) = 'admin' then
    return 'Un administrador no puede eliminar su cuenta desde la app.';
  end if;

  select id into v_store_id from public.stores where user_id = v_uid;
  select id into v_courier_id from public.couriers where user_id = v_uid;

  if exists (
    select 1 from public.orders o
    where (o.cliente_id = v_uid or o.store_id = v_store_id or o.courier_id = v_courier_id)
      and (o.estado not in ('entregado', 'cancelado') or o.estado_pago = 'reembolso_pendiente')
  ) then
    return 'Tienes pedidos en curso o reembolsos pendientes. Espera a que terminen para eliminar tu cuenta.';
  end if;

  if v_store_id is not null and exists (
    select 1 from public.payouts p
    where p.store_id = v_store_id and p.estado in ('pendiente', 'enviado')
  ) then
    return 'Tienes transferencias pendientes de recibir. Espera a que se completen para eliminar tu cuenta.';
  end if;

  return null;
end;
$$;

revoke all on function public.account_deletion_blocker() from public, anon;
grant execute on function public.account_deletion_blocker() to authenticated;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_blocker text := public.account_deletion_blocker();
  v_store_id uuid;
  v_courier_id uuid;
begin
  if v_blocker is not null then
    raise exception '%', v_blocker;
  end if;

  select id into v_store_id from public.stores where user_id = v_uid;
  select id into v_courier_id from public.couriers where user_id = v_uid;

  perform set_config('app.eliminando_cuenta', 'on', true);

  -- Pagos de suscripción: solo se conservan los aprobados (ingresos).
  delete from public.subscription_payments sp
  using public.subscriptions sub
  where sp.subscription_id = sub.id
    and sp.estado <> 'aprobado'
    and (sub.store_id = v_store_id or sub.courier_id = v_courier_id);

  -- Cliente: los pedidos se quedan para la contabilidad del negocio, sin la
  -- dirección. cliente_id pasa a null al borrar el usuario.
  update public.orders
  set direccion_entrega = 'Cuenta eliminada'
  where cliente_id = v_uid;

  -- Negocio
  if v_store_id is not null then
    if exists (select 1 from public.orders where store_id = v_store_id) then
      delete from public.store_payout_accounts where store_id = v_store_id;
      delete from public.subscriptions where store_id = v_store_id;
      delete from public.products p
      where p.store_id = v_store_id
        and not exists (select 1 from public.order_items i where i.product_id = p.id);
      update public.products set activo = false, foto = null where store_id = v_store_id;
      update public.stores
      set estado = 'rechazado', eliminada_at = now(), logo = null, direccion = 'Negocio eliminado'
      where id = v_store_id;
    else
      delete from public.stores where id = v_store_id;
    end if;
  end if;

  -- Repartidor
  if v_courier_id is not null then
    delete from public.couriers where id = v_courier_id;
  end if;

  -- Borra public.users en cascada; stores.user_id y orders.cliente_id pasan a null.
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
