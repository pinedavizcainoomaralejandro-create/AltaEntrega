import Image from "next/image";
import Link from "next/link";
import { MapPinIcon, SearchIcon } from "@/components/ui/icons";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { escapeLike } from "@/lib/validation";
import type { CatalogProduct } from "@/types/database";
import { etiquetasVariante, getCategoria } from "@/lib/categories";
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
    .from("catalog_products")
    .select("id, nombre, descripcion, precio, talla, color, stock, foto, agotado")
    .eq("store_id", store.id)
    .eq("activo", true)
    .order("nombre");

  if (q) productsQuery = productsQuery.ilike("nombre", `%${escapeLike(q)}%`);

  const { data } = await productsQuery;
  const products = data as CatalogProduct[] | null;

  const variante = etiquetasVariante(store.categoria);
  const ilustracion = getCategoria(store.categoria)?.ilustracion ?? "/images/boutique-percha.svg";
  const formatPrecio = (n: number) => n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col gap-8">
      <Link href="/" className="link w-fit text-sm">
        ← Todos los negocios
      </Link>

      <section className="card overflow-hidden">
        <div className="h-28 bg-monte-700 bg-[radial-gradient(circle_at_85%_10%,rgb(242_158_51/0.55),transparent_40%)] sm:h-36" />
        <div className="-mt-12 flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-arena-200 shadow-md">
              {store.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={store.logo} alt={store.nombre} className="h-full w-full object-cover" />
              ) : (
                <span className="font-display text-4xl font-semibold text-monte-700">
                  {store.nombre.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="pb-1">
              <h1 className="font-display text-3xl font-semibold tracking-tight">{store.nombre}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-500">
                <span className="badge bg-monte-50 text-monte-700">{getCategoria(store.categoria)?.nombre ?? store.categoria}</span>
                <span className="inline-flex items-center gap-1">
                  <MapPinIcon />
                  {store.direccion}
                </span>
              </div>
            </div>
          </div>

          <form className="flex w-full max-w-sm items-center gap-2 rounded-xl border border-stone-300 bg-white pl-3 shadow-sm focus-within:border-monte-500 focus-within:ring-4 focus-within:ring-monte-500/15">
            <SearchIcon className="h-4 w-4 text-stone-400" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar en este negocio..."
              className="w-full bg-transparent py-2.5 text-sm focus:outline-none"
            />
            <button type="submit" className="btn-primary btn-sm m-1">
              Buscar
            </button>
          </form>
        </div>
      </section>

      {!products || products.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <Image src={ilustracion} alt="" width={220} height={160} unoptimized className="rounded-2xl" />
          <p className="font-display text-xl font-semibold">
            {q ? `No encontramos "${q}" en este negocio` : "Este negocio está preparando su menú y vitrina"}
          </p>
          <p className="text-sm text-stone-500">
            {q ? "Prueba con otra palabra." : "Vuelve pronto para ver sus productos."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          {products.map((p) => (
            <article key={p.id} className="group card flex flex-col overflow-hidden">
              <div className="relative aspect-[4/5] overflow-hidden bg-arena-200">
                {p.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.foto}
                    alt={p.nombre}
                    className={`h-full w-full object-cover transition duration-300 group-hover:scale-105 ${
                      p.agotado ? "opacity-60 grayscale" : ""
                    }`}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-6">
                    <Image src={ilustracion} alt="" width={160} height={116} unoptimized className="rounded-xl opacity-80" />
                  </div>
                )}
                {p.agotado && (
                  <span className="badge absolute left-3 top-3 bg-stone-900/85 text-white">Agotado</span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-4">
                <p className="line-clamp-2 font-medium text-stone-900">{p.nombre}</p>
                {(p.talla || p.color) && (
                  <p className="text-xs text-stone-500">{[p.talla && `${variante.talla}: ${p.talla}`, p.color && `${variante.color}: ${p.color}`].filter(Boolean).join(" · ")}</p>
                )}
                <p className="mt-1 font-display text-lg font-semibold text-monte-800">RD${formatPrecio(p.precio)}</p>
                <div className="mt-auto pt-3">
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
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
