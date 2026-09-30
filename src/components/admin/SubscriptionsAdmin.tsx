import { createClient } from "@/lib/supabase/server";
import { formatFecha } from "@/lib/format";
import { estadoSuscripcion } from "@/lib/subscription";
import SubscriptionReviewButtons from "./SubscriptionReviewButtons";

const ESTADO: Record<string, { texto: string; clase: string }> = {
  prueba: { texto: "Prueba", clase: "bg-monte-50 text-monte-700" },
  activa: { texto: "Al día", clase: "bg-monte-100 text-monte-800" },
  por_vencer: { texto: "Por vencer", clase: "bg-sol-100 text-sol-800" },
  gracia: { texto: "En gracia", clase: "bg-red-50 text-red-700" },
  pausada: { texto: "Pausada", clase: "bg-red-100 text-red-800" },
};

/** Pagos de suscripción por revisar y estado de todas las suscripciones. */
export default async function SubscriptionsAdmin() {
  const supabase = await createClient();

  const [{ data: pagos }, { data: subs }, { data: settings }] = await Promise.all([
    supabase
      .from("subscription_payments")
      .select("id, subscription_id, plan, monto, referencia, comprobante_path, created_at")
      .eq("estado", "por_confirmar")
      .order("created_at", { ascending: true }),
    supabase.from("subscriptions").select("id, store_id, courier_id, plan, vigente_hasta").order("vigente_hasta"),
    supabase.from("platform_settings").select("dias_gracia").maybeSingle(),
  ]);

  const subRows = subs ?? [];
  const storeIds = subRows.map((s) => s.store_id).filter((id): id is string => Boolean(id));
  const courierIds = subRows.map((s) => s.courier_id).filter((id): id is string => Boolean(id));
  const [{ data: stores }, { data: couriers }] = await Promise.all([
    storeIds.length
      ? supabase.from("stores").select("id, nombre").in("id", storeIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
    courierIds.length
      ? supabase.from("couriers").select("id, user_id").in("id", courierIds)
      : Promise.resolve({ data: [] as { id: string; user_id: string }[] }),
  ]);
  const { data: courierUsers } = (couriers ?? []).length
    ? await supabase.from("users").select("id, nombre").in("id", (couriers ?? []).map((c) => c.user_id))
    : { data: [] as { id: string; nombre: string }[] };

  const storeName = new Map((stores ?? []).map((s) => [s.id, s.nombre] as const));
  const userName = new Map((courierUsers ?? []).map((u) => [u.id, u.nombre] as const));
  const courierName = new Map((couriers ?? []).map((c) => [c.id, userName.get(c.user_id) ?? "Repartidor"] as const));
  const nombreDe = (s: { store_id: string | null; courier_id: string | null }) =>
    s.store_id ? `${storeName.get(s.store_id) ?? "Negocio"} (negocio)` : `${courierName.get(s.courier_id ?? "") ?? "Repartidor"} (repartidor)`;
  const subById = new Map(subRows.map((s) => [s.id, s] as const));

  // Enlaces temporales a los comprobantes (bucket privado).
  const paths = (pagos ?? []).map((p) => p.comprobante_path);
  const { data: signed } = paths.length
    ? await supabase.storage.from("comprobantes").createSignedUrls(paths, 60 * 30)
    : { data: [] };
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl] as const));

  const diasGracia = settings?.dias_gracia ?? 5;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-6">
        <h2 className="font-display text-xl font-semibold">Pagos de suscripción por revisar</h2>
        <p className="mb-4 mt-1 text-sm text-stone-500">
          Verifica en tu banco que llegó la transferencia. Al aprobar, la suscripción se extiende un mes o un año.
        </p>
        {!pagos || pagos.length === 0 ? (
          <p className="text-sm text-stone-500">Nada por revisar.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pagos.map((p) => {
              const sub = subById.get(p.subscription_id);
              const url = urlByPath.get(p.comprobante_path);
              return (
                <li key={p.id} className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-arena-50 p-3 text-sm">
                  <p className="font-medium">
                    {sub ? nombreDe(sub) : "—"} · plan {p.plan} ·{" "}
                    <span className="font-display text-lg">RD${p.monto.toFixed(2)}</span>
                  </p>
                  <p className="text-xs text-stone-500">
                    {formatFecha(p.created_at)} · ref. {p.referencia}
                    {url && (
                      <>
                        {" · "}
                        <a href={url} target="_blank" rel="noopener noreferrer" className="link">
                          Ver comprobante
                        </a>
                      </>
                    )}
                  </p>
                  <SubscriptionReviewButtons id={p.id} />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card p-6">
        <h2 className="mb-4 font-display text-xl font-semibold">Suscripciones</h2>
        {subRows.length === 0 ? (
          <p className="text-sm text-stone-500">Todavía no hay negocios ni repartidores aprobados.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-stone-100 text-sm">
            {subRows.map((s) => {
              const e = estadoSuscripcion(s, diasGracia);
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0 truncate">{nombreDe(s)}</span>
                  <span className="flex items-center gap-2 text-xs text-stone-500">
                    hasta {formatFecha(s.vigente_hasta).split(",")[0]}
                    <span className={`badge ${ESTADO[e.estado].clase}`}>{ESTADO[e.estado].texto}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
