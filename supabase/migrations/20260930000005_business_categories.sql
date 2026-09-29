-- AltaEntrega deja de ser solo para boutiques: restaurantes, puestos de
-- empanadas, cafeterías, panaderías, reposterías y boutiques. La categoría
-- pasa de texto libre a una lista fija (src/lib/categories.ts), que permite
-- filtrar el catálogo por tipo de negocio.

-- Por si ya hubiera tiendas con texto libre, se asignan a "boutique" (el
-- único tipo que existía).
update public.stores set categoria = 'boutique'
where categoria not in ('restaurante', 'empanadas', 'cafeteria', 'panaderia', 'reposteria', 'boutique');

alter table public.stores
  add constraint stores_categoria_check
  check (categoria in ('restaurante', 'empanadas', 'cafeteria', 'panaderia', 'reposteria', 'boutique'));

create index stores_categoria_idx on public.stores (categoria) where estado = 'aprobado';
