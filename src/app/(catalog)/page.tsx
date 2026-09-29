import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { escapeLike, quotePostgrestValue } from "@/lib/validation";

export default async function CatalogHomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const q = ((await searchParams).q ?? "").trim();

  let query = supabase
    .from("stores")
    .select("id, nombre, categoria, direccion, logo")
    .eq("estado", "aprobado")
    .order("nombre");

  if (q) {
    const quoted = quotePostgrestValue(`%${escapeLike(q)}%`);
    query = query.or(`nombre.ilike.${quoted},categoria.ilike.${quoted}`);
  }

  const { data: stores } = await query;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Boutiques en Villa Altagracia</h1>
      <p className="mb-6 text-neutral-500">Explora las tiendas aprobadas y arma tu pedido.</p>

      <form className="mb-6 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar tienda por nombre o categoría..."
          className="w-full max-w-sm rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white">
          Buscar
        </button>
      </form>

      {!stores || stores.length === 0 ? (
        <p className="text-neutral-500">
          {q ? `No encontramos tiendas para "${q}".` : "Todavía no hay tiendas aprobadas."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((s) => (
            <Link
              key={s.id}
              href={`/tiendas/${s.id}`}
              className="flex gap-3 rounded-lg border border-neutral-200 p-4 hover:border-neutral-400"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-neutral-100">
                {s.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.logo} alt={s.nombre} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{s.nombre}</p>
                <p className="text-sm text-neutral-500">{s.categoria}</p>
                <p className="truncate text-xs text-neutral-400">{s.direccion}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
