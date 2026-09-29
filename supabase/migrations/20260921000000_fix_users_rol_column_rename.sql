-- Corrige un renombre accidental hecho desde el Table Editor: la columna
-- "rol" (enum user_role) terminó llamándose "admin". El resto del esquema
-- (tipo, enum, default, RLS) sigue intacto; solo hace falta el nombre.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'admin'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'rol'
  ) then
    alter table public.users rename column admin to rol;
  end if;
end $$;
