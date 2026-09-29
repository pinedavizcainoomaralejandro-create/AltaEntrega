-- AltaEntrega: habilita Realtime sobre order_status_history para que la línea
-- de tiempo del pedido del cliente se actualice en vivo cuando la tienda o el
-- repartidor cambian el estado.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_status_history'
     )
  then
    alter publication supabase_realtime add table public.order_status_history;
  end if;
end $$;
