-- AltaEntrega: verificación de identidad de repartidores
-- Exige cédula + matrícula del vehículo, y prohíbe duplicados a nivel de BD
-- (evita que un mismo documento o matrícula se use para más de una cuenta).

alter table public.couriers
  add column matricula text;

-- Backfill defensivo por si ya hubiera filas (no debería en un proyecto nuevo).
update public.couriers set matricula = 'PENDIENTE-' || id::text where matricula is null;

alter table public.couriers
  alter column matricula set not null;

-- No se permiten documentos vacíos ni solo espacios.
alter table public.couriers
  add constraint couriers_documento_identidad_not_blank check (btrim(documento_identidad) <> ''),
  add constraint couriers_matricula_not_blank check (btrim(matricula) <> '');

-- Un mismo documento de identidad o una misma matrícula no puede repetirse entre repartidores.
alter table public.couriers
  add constraint couriers_documento_identidad_unique unique (documento_identidad),
  add constraint couriers_matricula_unique unique (matricula);
