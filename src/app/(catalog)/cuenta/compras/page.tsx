import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatFecha } from "@/lib/format";
import { comprasPorMes, esReembolsada, resumenCompras, type Compra } from "@/lib/purchaseHistory";

export const metadata: Metadata = {
  title: "Historial de compras",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card min-w-0 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{label}</p>
      <p className="mt-1 truncate font-display text-xl font-semibold text-stone-900">{value}</p>
    </div>
  );
}

export default async function HistorialComprasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/cuenta/compras");

  // Solo los clientes compran.
  const { data: profile } = await supabase.from("users").select("rol").eq("id", user.id).maybeSingle();
  if (profile?.rol !== "cliente") redirect("/cuenta");

  // Una compra es un pedido entregado; los que siguen en curso están en "Mis pedidos".
  const { data } = await supabase
    .from("orders")
    .select("id, codigo, tienda_nombre, total, estado_pago, created_at, order_items(nombre, cantidad, precio_unitario)")
    .eq("cliente_id", user.id)
    .eq("estado", "entregado")
    .order("created_at", { ascending: false });

  const compras: Compra[] = (data ?? []).map(({ order_items, ...o }) => ({ ...o, items: order_items }));
  const resumen = resumenCompras(compras);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link href="/cuenta" className="self-start text-sm font-medium underline">
        <span aria-hidden>←</span> Mi cuenta
      </Link>

      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Historial de compras</h1>
        <p className="mt-1 text-sm text-stone-500">
          Tus pedidos entregados. Los que están en curso los ves en{" "}
          <Link href="/pedidos" className="link">
            Mis pedidos
          </Link>
          .
        </p>
      </header>

      {compras.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <p className="font-medium text-stone-900">Todavía no tienes compras entregadas</p>
          <p className="text-sm text-stone-500">Cuando recibas tu primer pedido, aparecerá aquí.</p>
          <Link href="/" className="btn-primary mt-2">
            Explorar negocios
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Compras" value={String(resumen.compras)} />
            <Stat label="Total gastado" value={`RD$${resumen.totalGastado.toFixed(2)}`} />
            {resumen.favorita && (
              <div className="col-span-2 sm:col-span-1">
                <Stat label="Tu negocio favorito" value={resumen.favorita.nombre} />
              </div>
            )}
          </div>

          {comprasPorMes(compras).map((grupo) => (
            <section key={grupo.mes} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-stone-500">{grupo.mes}</h2>
              {grupo.compras.map((c) => (
                <Link key={c.id} href={`/pedidos/${c.id}`} className="card flex flex-col gap-2 p-4 hover:border-stone-400">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.tienda_nombre}</p>
                      <p className="text-xs text-stone-400">
                        {formatFecha(c.created_at)} · {c.codigo}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-medium ${esReembolsada(c) ? "text-stone-400 line-through" : ""}`}>
                        RD${c.total.toFixed(2)}
                      </p>
                      {esReembolsada(c) && (
                        <p className="text-xs text-sol-600">
                          {c.estado_pago === "reembolsado" ? "Reembolsado" : "Reembolso en proceso"}
                        </p>
                      )}
                    </div>
                  </div>
                  <ul className="text-sm text-stone-600">
                    {c.items.map((i, idx) => (
                      <li key={idx} className="truncate">
                        {i.cantidad}× {i.nombre}
                      </li>
                    ))}
                  </ul>
                </Link>
              ))}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
