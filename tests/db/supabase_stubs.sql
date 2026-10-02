-- Imitación mínima de lo que Supabase provee (auth.uid, storage, roles) para
-- poder aplicar las migraciones en un Postgres local vacío.
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid
$$;

create schema storage;
create table storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (id uuid, bucket_id text, name text);
create function storage.foldername(name text) returns text[] language sql as $$
  select string_to_array(name, '/')
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role;
  end if;
end $$;

-- pg_net: en vez de hacer la petición HTTP, la guarda para revisarla.
create schema net;
create table net.test_requests (url text, body jsonb, headers jsonb);
create function net.http_post(
  url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}',
  timeout_milliseconds int default 5000
) returns bigint language sql as $$
  insert into net.test_requests values (url, body, headers);
  select 1::bigint;
$$;
