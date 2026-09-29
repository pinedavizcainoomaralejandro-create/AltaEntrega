import Image from "next/image";
import Link from "next/link";
import { MapPinIcon, SearchIcon } from "@/components/ui/icons";
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

  const pasos = [
    {
      img: "/images/boutique-fachada.svg",
      titulo: "Elige tu boutique",
      texto: "Tiendas de Villa Altagracia verificadas por nuestro equipo.",
    },
    {
      img: "/images/boutique-percha.svg",
      titulo: "Arma tu pedido y paga seguro",
      texto: "Pagas con tarjeta en la página segura de AZUL (Banco Popular).",
    },
    {
      img: "/images/repartidor.svg",
      titulo: "Recíbelo en tu casa",
      texto: "Un repartidor del pueblo te lo lleva y sigues tu pedido en vivo.",
    },
  ];

  return (
    <div className="flex flex-col gap-14">
      <section className="relative isolate overflow-hidden rounded-3xl bg-monte-900 px-6 py-14 text-white shadow-suave sm:px-12 sm:py-20">
        <Image
          src="/images/villa-altagracia-montanas.jpg"
          alt="Lomas de Villa Altagracia vistas desde la Autopista Duarte"
          fill
          priority
          sizes="(max-width: 1200px) 100vw, 1200px"
          className="-z-10 object-cover object-[center_40%]"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-monte-950/90 via-monte-950/65 to-monte-950/20" />
        <span className="badge bg-sol-400/90 text-monte-950">Villa Altagracia · San Cristóbal</span>
        <h1 className="mt-5 max-w-2xl font-display text-4xl font-semibold leading-tight text-white text-balance sm:text-5xl">
          Las boutiques de tu pueblo, en la puerta de tu casa.
        </h1>
        <p className="mt-4 max-w-xl text-base text-monte-100 sm:text-lg">
          Ropa, calzado y accesorios de las tiendas de Villa Altagracia, con pago seguro y delivery local.
        </p>

        <form className="mt-8 flex max-w-xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-2xl sm:flex-row">
          <label className="flex flex-1 items-center gap-2 px-3 text-stone-400">
            <SearchIcon />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Busca una tienda o categoría: ropa, calzado..."
              className="w-full bg-transparent py-2.5 text-stone-900 placeholder:text-stone-400 focus:outline-none"
            />
          </label>
          <button type="submit" className="btn-accent px-6">
            Buscar
          </button>
        </form>
      </section>

      <section id="tiendas">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              {q ? `Resultados para "${q}"` : "Boutiques en Villa Altagracia"}
            </h2>
            <p className="mt-1 text-stone-500">
              {q ? "Tiendas que coinciden con tu búsqueda." : "Tiendas locales verificadas, listas para tu pedido."}
            </p>
          </div>
          {q && (
            <Link href="/" className="link text-sm">
              Ver todas
            </Link>
          )}
        </div>

        {!stores || stores.length === 0 ? (
          <div className="card flex flex-col items-center gap-4 px-6 py-12 text-center">
            <Image src="/images/boutique-fachada.svg" alt="" width={120} height={165} unoptimized />
            <p className="font-display text-xl font-semibold">
              {q ? `No encontramos tiendas para "${q}"` : "Pronto verás aquí las boutiques del pueblo"}
            </p>
            <p className="max-w-md text-sm text-stone-500">
              {q
                ? "Prueba con otra palabra, como ropa, calzado o el nombre de la tienda."
                : "Estamos sumando las primeras tiendas de Villa Altagracia."}
            </p>
            {!q && (
              <Link href="/register" className="btn-primary">
                ¿Tienes una boutique? Regístrala gratis
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((s, i) => (
              <Link
                key={s.id}
                href={`/tiendas/${s.id}`}
                className="group card overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div
                  className={`h-20 ${
                    ["bg-monte-600", "bg-sol-400", "bg-monte-800", "bg-sol-600"][i % 4]
                  } bg-[radial-gradient(circle_at_85%_20%,rgb(255_255_255/0.25),transparent_45%)]`}
                />
                <div className="-mt-10 flex flex-col gap-3 px-5 pb-5">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-arena-200 shadow-md">
                    {s.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.logo} alt={s.nombre} className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-display text-3xl font-semibold text-monte-700">
                        {s.nombre.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-display text-xl font-semibold group-hover:text-monte-700">{s.nombre}</p>
                    <span className="badge mt-1 bg-monte-50 text-monte-700">{s.categoria}</span>
                    <p className="mt-3 flex items-center gap-1.5 truncate text-sm text-stone-500">
                      <MapPinIcon />
                      {s.direccion}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-3xl font-semibold tracking-tight">Así de fácil</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {pasos.map((p, i) => (
            <div key={p.titulo} className="card overflow-hidden">
              <div className="relative h-44 bg-arena-200">
                <Image src={p.img} alt="" fill unoptimized className="object-contain p-3" />
              </div>
              <div className="p-5">
                <span className="text-xs font-bold uppercase tracking-wider text-sol-600">Paso {i + 1}</span>
                <p className="mt-1 font-display text-xl font-semibold">{p.titulo}</p>
                <p className="mt-1 text-sm text-stone-500">{p.texto}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
