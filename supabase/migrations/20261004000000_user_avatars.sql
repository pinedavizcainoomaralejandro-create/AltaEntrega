-- Foto de perfil de cada usuario (el avatar del encabezado).
--
-- Se guarda la ruta dentro del bucket, no una URL: así nadie puede apuntar su
-- avatar a una imagen de otro sitio. El check obliga a que la ruta esté en la
-- carpeta del propio usuario ("<user_id>/<archivo>").

alter table public.users add column avatar_path text;

alter table public.users
  add constraint users_avatar_path_own_folder
  check (avatar_path is null or (avatar_path like id::text || '/%' and length(avatar_path) <= 200));

-- El avatar se reduce en el navegador (256x256) antes de subirlo; 2 MB deja
-- margen de sobra.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_owner_insert"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_owner_update"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
