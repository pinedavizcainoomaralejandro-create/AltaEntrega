-- Corrige update_payout: dejaba pasar llamadas sin sesión (rol anon) porque
-- auth.uid() es null también en ese caso, y Supabase concede EXECUTE a anon
-- por defecto. Un visitante podía marcar transferencias como completadas.

revoke execute on function public.update_payout(uuid, text, text, text) from anon;

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
  -- Solo el admin o el servidor (service role). Una llamada sin sesión con
  -- la llave pública llega con rol "anon": no basta con que auth.uid() sea
  -- null para considerarla del servidor.
  if public.current_user_role() is distinct from 'admin'
     and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') not in ('service_role', '')
  then
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
