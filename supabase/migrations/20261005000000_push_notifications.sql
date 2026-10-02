-- Notificaciones push de las apps Android e iOS.
--
-- 1. push_tokens: el token de cada teléfono, ligado al usuario que inició
--    sesión en él. Solo se escribe con register/unregister_push_token.
-- 2. private.send_push(): busca los tokens de los destinatarios y llama a
--    /api/push/send de la app (con pg_net, después del commit), que entrega
--    el aviso por Firebase (Android) o APNs (iOS).
-- 3. Triggers en orders, stores y couriers: deciden a quién avisar y qué
--    decir. Cubren cualquier cambio, venga de una Server Action, de una
--    función RPC llamada desde el navegador o del panel de admin.
--
-- La URL de la app y el secreto compartido van en private.push_config, que se
-- llena aparte (no en una migración: el repositorio es público). Sin esa fila
-- no se envía nada.

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 1. Tokens de los teléfonos
-- ─────────────────────────────────────────────────────────────

create table public.push_tokens (
  token text primary key check (length(token) between 20 and 4096),
  user_id uuid not null references public.users (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_id_idx on public.push_tokens (user_id);

-- Sin políticas: nadie lee ni escribe la tabla directamente.
alter table public.push_tokens enable row level security;

-- Si el teléfono ya estaba registrado con otra cuenta, pasa a la actual: los
-- avisos son de quien tiene la sesión abierta.
create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para recibir notificaciones';
  end if;

  insert into public.push_tokens (token, user_id, platform)
  values (p_token, auth.uid(), p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

revoke execute on function public.register_push_token(text, text) from public, anon;
revoke execute on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. Envío
-- ─────────────────────────────────────────────────────────────

create schema if not exists private;
revoke all on schema private from public;

create table private.push_config (
  id boolean primary key default true check (id),
  dispatch_url text not null,
  secret text not null check (length(secret) >= 32)
);

/**
 * Avisa a los usuarios indicados, menos a quien hizo el cambio (no hace falta
 * avisarle de lo que acaba de hacer). Nunca lanza: un aviso que falla no debe
 * deshacer un pedido ni una aprobación.
 */
create or replace function private.send_push(p_user_ids uuid[], p_title text, p_body text, p_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg private.push_config%rowtype;
  v_tokens jsonb;
begin
  select * into v_cfg from private.push_config;
  if not found then
    return;
  end if;

  select jsonb_agg(jsonb_build_object('token', t.token, 'platform', t.platform))
  into v_tokens
  from public.push_tokens t
  where t.user_id = any (p_user_ids)
    and t.user_id is distinct from auth.uid();

  if v_tokens is null then
    return;
  end if;

  perform net.http_post(
    url := v_cfg.dispatch_url,
    body := jsonb_build_object('tokens', v_tokens, 'title', p_title, 'body', p_body, 'url', p_url),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_cfg.secret),
    timeout_milliseconds := 5000
  );
exception when others then
  raise warning 'send_push: %', sqlerrm;
end;
$$;

revoke all on function private.send_push(uuid[], text, text, text) from public;

-- ─────────────────────────────────────────────────────────────
-- 3. Qué se avisa
-- ─────────────────────────────────────────────────────────────

create or replace function private.notify_order_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tienda uuid;
  v_courier uuid;
  v_pedido text := 'Pedido ' || new.codigo;
  v_url_cliente text := '/pedidos/' || new.id;
begin
  select user_id into v_tienda from public.stores where id = new.store_id;
  if new.courier_id is not null then
    select user_id into v_courier from public.couriers where id = new.courier_id;
  end if;

  -- Transferencias: el cliente envió el comprobante / el negocio no lo confirmó.
  if new.estado_pago = 'por_confirmar' and (tg_op = 'INSERT' or old.estado_pago is distinct from 'por_confirmar') then
    perform private.send_push(array[v_tienda], 'Transferencia por confirmar',
      v_pedido || ': revisa el comprobante y confirma el pago.', '/dashboard/tienda/pedidos');
  end if;
  if tg_op = 'UPDATE' and new.estado_pago = 'rechazado' and old.estado_pago = 'por_confirmar' then
    perform private.send_push(array[new.cliente_id], 'No se confirmó tu pago',
      new.tienda_nombre || ' no pudo confirmar la transferencia. Revisa los datos e inténtalo de nuevo.', v_url_cliente);
  end if;

  if tg_op = 'UPDATE' and new.estado is not distinct from old.estado then
    return null;
  end if;

  case new.estado
    when 'pendiente' then
      perform private.send_push(array[v_tienda], 'Nuevo pedido',
        v_pedido || ' por RD$' || to_char(new.total, 'FM999G999G990D00') || '. Confírmalo para empezar.',
        '/dashboard/tienda/pedidos');
    when 'confirmado' then
      perform private.send_push(array[new.cliente_id], 'Pedido confirmado',
        new.tienda_nombre || ' confirmó tu pedido.', v_url_cliente);
      -- Queda libre para los repartidores que pueden tomarlo ahora mismo.
      if new.courier_id is null then
        perform private.send_push(
          array(
            select c.user_id from public.couriers c
            where c.estado = 'aprobado' and c.disponible and public.subscription_ok(null, c.id)
          ),
          'Nuevo pedido para entregar',
          new.tienda_nombre || ': ' || v_pedido || ' está disponible.',
          '/dashboard/delivery');
      end if;
    when 'preparando' then
      perform private.send_push(array[new.cliente_id], 'Preparando tu pedido',
        new.tienda_nombre || ' está preparando tu pedido.', v_url_cliente);
    when 'en_camino' then
      perform private.send_push(array[new.cliente_id], 'Tu pedido va en camino',
        'El repartidor ya salió con tu pedido de ' || new.tienda_nombre || '.', v_url_cliente);
    when 'entregado' then
      perform private.send_push(array[new.cliente_id], 'Pedido entregado',
        'Gracias por comprar en ' || new.tienda_nombre || '.', v_url_cliente);
    when 'cancelado' then
      -- Un intento de pago que no se completó no es un pedido para nadie.
      if tg_op = 'UPDATE' and old.estado <> 'esperando_pago' then
        perform private.send_push(array[new.cliente_id], 'Pedido cancelado',
          v_pedido || ' de ' || new.tienda_nombre || ' fue cancelado.', v_url_cliente);
        perform private.send_push(array_remove(array[v_tienda, v_courier], null), 'Pedido cancelado',
          v_pedido || ' fue cancelado.', '/');
      end if;
    else
      null;
  end case;

  return null;
end;
$$;

create trigger trg_orders_notify
after insert or update of estado, estado_pago on public.orders
for each row execute function private.notify_order_change();

create or replace function private.notify_application_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tienda boolean := tg_table_name = 'stores';
  v_nombre text;
begin
  -- Solicitud nueva o corregida tras un rechazo: avisar a los admins.
  if new.estado = 'pendiente' and (tg_op = 'INSERT' or old.estado = 'rechazado') then
    select nombre into v_nombre from public.users where id = new.user_id;
    perform private.send_push(
      array(select id from public.users where rol = 'admin'),
      case when v_tienda then 'Nueva solicitud de negocio' else 'Nueva solicitud de repartidor' end,
      coalesce(v_nombre, 'Alguien') || ' espera tu revisión.',
      '/admin');
  end if;

  -- Resultado de la revisión: avisar al solicitante.
  if tg_op = 'UPDATE' and old.estado = 'pendiente' and new.estado in ('aprobado', 'rechazado') then
    perform private.send_push(
      array[new.user_id],
      case when new.estado = 'aprobado' then '¡Solicitud aprobada!' else 'Revisamos tu solicitud' end,
      case
        when new.estado = 'rechazado' then 'Corrige tus datos y envíalos de nuevo.'
        when v_tienda then 'Ya puedes subir tus productos y recibir pedidos.'
        else 'Ya puedes tomar entregas.'
      end,
      '/');
  end if;

  return null;
end;
$$;

create trigger trg_stores_notify
after insert or update of estado on public.stores
for each row execute function private.notify_application_change();

create trigger trg_couriers_notify
after insert or update of estado on public.couriers
for each row execute function private.notify_application_change();
