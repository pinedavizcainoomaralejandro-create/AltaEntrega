-- AltaEntrega: buckets de Storage para fotos de productos y logos de tienda
-- Convención de paths: "<store_id>/<archivo>" para poder validar el dueño vía la tabla stores.

insert into storage.buckets (id, name, public)
values
  ('product-photos', 'product-photos', true),
  ('store-logos', 'store-logos', true)
on conflict (id) do nothing;

-- Lectura pública (son fotos de catálogo)
create policy "product_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'product-photos');

create policy "store_logos_public_read"
  on storage.objects for select
  using (bucket_id = 'store-logos');

-- Solo el dueño de la tienda (carpeta = store_id) puede subir/editar/borrar sus fotos
create policy "product_photos_owner_write"
  on storage.objects for insert
  with check (
    bucket_id = 'product-photos'
    and exists (
      select 1 from public.stores s
      where s.id::text = (storage.foldername(name))[1]
        and s.user_id = auth.uid()
    )
  );

create policy "product_photos_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'product-photos'
    and exists (
      select 1 from public.stores s
      where s.id::text = (storage.foldername(name))[1]
        and s.user_id = auth.uid()
    )
  );

create policy "product_photos_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'product-photos'
    and exists (
      select 1 from public.stores s
      where s.id::text = (storage.foldername(name))[1]
        and s.user_id = auth.uid()
    )
  );

create policy "store_logos_owner_write"
  on storage.objects for insert
  with check (
    bucket_id = 'store-logos'
    and exists (
      select 1 from public.stores s
      where s.id::text = (storage.foldername(name))[1]
        and s.user_id = auth.uid()
    )
  );

create policy "store_logos_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'store-logos'
    and exists (
      select 1 from public.stores s
      where s.id::text = (storage.foldername(name))[1]
        and s.user_id = auth.uid()
    )
  );

create policy "store_logos_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'store-logos'
    and exists (
      select 1 from public.stores s
      where s.id::text = (storage.foldername(name))[1]
        and s.user_id = auth.uid()
    )
  );
