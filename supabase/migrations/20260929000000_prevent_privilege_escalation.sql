-- Cierra dos escaladas de privilegios que las políticas RLS dejaban abiertas,
-- porque la anon key es pública y cualquiera puede llamar la API directamente:
--
-- 1. users_insert_own / users_update_own_or_admin no limitan la columna "rol":
--    un usuario podía registrarse como admin o cambiar su propio rol a admin.
-- 2. prevent_self_approval solo corre en UPDATE: una tienda o repartidor podía
--    crear su perfil ya con estado = 'aprobado'.
--
-- Cuando auth.uid() es null la operación viene del SQL Editor o de la
-- service role (fuera de RLS), y se deja pasar: así se siguen creando admins.

-- ─────────────────────────────────────────────────────────────
-- USERS: el rol solo lo asigna/cambia un admin
-- ─────────────────────────────────────────────────────────────

create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.current_user_role() = 'admin' then
    return new;
  end if;

  if tg_op = 'INSERT' and new.rol = 'admin' then
    raise exception 'No puedes registrarte con el rol admin';
  end if;

  if tg_op = 'UPDATE' and new.rol is distinct from old.rol then
    raise exception 'Solo un administrador puede cambiar el rol de un usuario';
  end if;

  return new;
end;
$$;

create trigger trg_users_prevent_role_escalation
before insert or update on public.users
for each row execute function public.prevent_role_escalation();

-- ─────────────────────────────────────────────────────────────
-- STORES / COURIERS: todo perfil nuevo nace pendiente
-- ─────────────────────────────────────────────────────────────

create or replace function public.force_pending_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and public.current_user_role() is distinct from 'admin' then
    new.estado := 'pendiente';
  end if;
  return new;
end;
$$;

create trigger trg_stores_force_pending_on_insert
before insert on public.stores
for each row execute function public.force_pending_on_insert();

create trigger trg_couriers_force_pending_on_insert
before insert on public.couriers
for each row execute function public.force_pending_on_insert();
