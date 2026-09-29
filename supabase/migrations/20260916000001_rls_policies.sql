-- AltaEntrega: Row Level Security

alter table public.users enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.couriers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;

-- Lee el rol del usuario autenticado sin disparar recursión de RLS sobre "users"
create or replace function public.current_user_role()
returns user_role
language sql
security definer
stable
set search_path = public
as $$
  select rol from public.users where id = auth.uid();
$$;

-- Evita que tienda/courier se autoaprueben cambiando su propio "estado";
-- solo un admin puede mover pendiente -> aprobado/rechazado.
create or replace function public.prevent_self_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado is distinct from old.estado and public.current_user_role() <> 'admin' then
    new.estado := old.estado;
  end if;
  return new;
end;
$$;

create trigger trg_stores_prevent_self_approval
before update on public.stores
for each row execute function public.prevent_self_approval();

create trigger trg_couriers_prevent_self_approval
before update on public.couriers
for each row execute function public.prevent_self_approval();

-- ─────────────────────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────────────────────

create policy "users_select_own_or_admin"
  on public.users for select
  using (id = auth.uid() or public.current_user_role() = 'admin');

create policy "users_insert_own"
  on public.users for insert
  with check (id = auth.uid());

create policy "users_update_own_or_admin"
  on public.users for update
  using (id = auth.uid() or public.current_user_role() = 'admin');

-- ─────────────────────────────────────────────────────────────
-- STORES
-- ─────────────────────────────────────────────────────────────

create policy "stores_select_owner_admin_or_approved"
  on public.stores for select
  using (
    user_id = auth.uid()
    or public.current_user_role() = 'admin'
    or estado = 'aprobado'
  );

create policy "stores_insert_own"
  on public.stores for insert
  with check (user_id = auth.uid() and public.current_user_role() = 'tienda');

create policy "stores_update_owner_or_admin"
  on public.stores for update
  using (user_id = auth.uid() or public.current_user_role() = 'admin');

-- ─────────────────────────────────────────────────────────────
-- PRODUCTS
-- ─────────────────────────────────────────────────────────────

create policy "products_select_owner_admin_or_store_approved"
  on public.products for select
  using (
    exists (
      select 1 from public.stores s
      where s.id = products.store_id
        and (
          s.user_id = auth.uid()
          or public.current_user_role() = 'admin'
          or s.estado = 'aprobado'
        )
    )
  );

create policy "products_insert_owner"
  on public.products for insert
  with check (
    exists (
      select 1 from public.stores s
      where s.id = products.store_id and s.user_id = auth.uid()
    )
  );

create policy "products_update_owner_or_admin"
  on public.products for update
  using (
    exists (
      select 1 from public.stores s
      where s.id = products.store_id
        and (s.user_id = auth.uid() or public.current_user_role() = 'admin')
    )
  );

create policy "products_delete_owner_or_admin"
  on public.products for delete
  using (
    exists (
      select 1 from public.stores s
      where s.id = products.store_id
        and (s.user_id = auth.uid() or public.current_user_role() = 'admin')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- COURIERS
-- ─────────────────────────────────────────────────────────────

create policy "couriers_select_owner_or_admin"
  on public.couriers for select
  using (user_id = auth.uid() or public.current_user_role() = 'admin');

create policy "couriers_insert_own"
  on public.couriers for insert
  with check (user_id = auth.uid() and public.current_user_role() = 'courier');

create policy "couriers_update_owner_or_admin"
  on public.couriers for update
  using (user_id = auth.uid() or public.current_user_role() = 'admin');

-- ─────────────────────────────────────────────────────────────
-- ORDERS
-- ─────────────────────────────────────────────────────────────

create policy "orders_select_involved_or_admin"
  on public.orders for select
  using (
    cliente_id = auth.uid()
    or public.current_user_role() = 'admin'
    or exists (select 1 from public.stores s where s.id = orders.store_id and s.user_id = auth.uid())
    or exists (select 1 from public.couriers c where c.id = orders.courier_id and c.user_id = auth.uid())
  );

create policy "orders_insert_cliente"
  on public.orders for insert
  with check (cliente_id = auth.uid() and public.current_user_role() = 'cliente');

create policy "orders_update_involved_or_admin"
  on public.orders for update
  using (
    public.current_user_role() = 'admin'
    or exists (select 1 from public.stores s where s.id = orders.store_id and s.user_id = auth.uid())
    or exists (select 1 from public.couriers c where c.id = orders.courier_id and c.user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- ORDER ITEMS
-- ─────────────────────────────────────────────────────────────

create policy "order_items_select_involved_or_admin"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (
          o.cliente_id = auth.uid()
          or public.current_user_role() = 'admin'
          or exists (select 1 from public.stores s where s.id = o.store_id and s.user_id = auth.uid())
          or exists (select 1 from public.couriers c where c.id = o.courier_id and c.user_id = auth.uid())
        )
    )
  );

create policy "order_items_insert_cliente"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.cliente_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- ORDER STATUS HISTORY (solo lectura para involucrados; el insert lo hace el trigger)
-- ─────────────────────────────────────────────────────────────

create policy "order_status_history_select_involved_or_admin"
  on public.order_status_history for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_status_history.order_id
        and (
          o.cliente_id = auth.uid()
          or public.current_user_role() = 'admin'
          or exists (select 1 from public.stores s where s.id = o.store_id and s.user_id = auth.uid())
          or exists (select 1 from public.couriers c where c.id = o.courier_id and c.user_id = auth.uid())
        )
    )
  );
