import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { escapeLike } from "@/lib/validation";
import AddToCartButton from "@/components/catalog/AddToCartButton";

export default async function StorePage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();

  const { data: store } = await supabase
    .from("stores")
    .select("id, nombre, categoria, direccion, logo, estado")
    .eq("id", (await params).storeId)
    .maybeSingle();

  if (!store || store.estado !== "aprobado") notFound();

  const q = ((await searchParams).q ?? "").trim();
  let productsQuery = supabase
    .from("products")
    .select("id, nombre, descripcion, precio, talla, color, stock, foto, agotado")
    .eq("store_id", store.id)
    .eq("activo", true)
    .order("nombre");

  if (q) productsQuery = productsQuery.ilike("nombre", `%${escapeLike(q)}%`);

  const { data: products } = await productsQuery;

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-neutral-100">
          {store.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logo} alt={store.nombre} className="h-full w-full object-cover" />
          )}
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{store.nombre}</h1>
          <p className="text-sm text-neutral-500">
            {store.categoria} · {store.direccion}
          </p>
        </div>
      </div>

      <form className="mb-6 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar producto en esta tienda..."
          className="w-full max-w-sm rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white">
          Buscar
        </button>
      </form>

      {!products || products.length === 0 ? (
        <p className="text-neutral-500">
          {q ? `No encontramos productos para "${q}".` : "Esta tienda aún no tiene productos."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="flex flex-col overflow-hidden rounded-lg border border-neutral-200">
              <div className="relative aspect-square bg-neutral-100">
                {p.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.foto} alt={p.nombre} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                    Sin foto
                  </div>
                )}
                {p.agotado && (
                  <span className="absolute left-2 top-2 rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
                    Agotado
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="font-medium">{p.nombre}</p>
                <p className="text-sm text-neutral-500">
                  {[p.talla, p.color].filter(Boolean).join(" · ") || "—"}
                </p>
                <p className="text-sm">RD${p.precio.toFixed(2)}</p>
                <div className="mt-auto pt-2">
                  <AddToCartButton
                    storeId={store.id}
                    storeNombre={store.nombre}
                    product={{
                      productId: p.id,
                      nombre: p.nombre,
                      precio: p.precio,
                      foto: p.foto,
                      stockDisponible: p.stock,
                    }}
                    disabled={p.agotado || p.stock <= 0}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
