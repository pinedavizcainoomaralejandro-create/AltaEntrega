import { createClient } from "@/lib/supabase/server";
import { estadoSuscripcion, mensajeSuscripcion } from "@/lib/subscription";
import { formatFecha } from "@/lib/format";
import BankAccountCard from "@/components/pagos/BankAccountCard";
import SubscriptionPaymentForm from "./SubscriptionPaymentForm";

type Offer = {
  fase: string;
  mensual: number;
  anual: number;
  descuento_anual: number;
  dias_gracia: number;
  cuenta: { banco: string; tipo_cuenta: string; numero_cuenta: string; titular: string; documento: string } | null;
};

const ESTADO_PAGO: Record<string, { texto: string; clase: string }> = {
  por_confirmar: { texto: "En revisión", clase: "bg-sol-100 text-sol-800" },
  aprobado: { texto: "Aprobado", clase: "bg-monte-100 text-monte-800" },
  rechazado: { texto: "Rechazado", clase: "bg-red-50 text-red-700" },
};

const PLAN: Record<string, string> = { prueba: "Prueba gratis", mensual: "Mensual", anual: "Anual" };

/** Suscripción del negocio o repartidor: estado, planes, cómo pagar e historial. */
export default async function SubscriptionPanel({ tipo }: { tipo: "tienda" | "courier" }) {
  const supabase = await createClient();
  const [{ data: offerData, error: offerError }, { data: sub }] = await Promise.all([
    supabase.rpc("get_subscription_offer"),
    supabase.from("subscriptions").select("id, plan, vigente_hasta").maybeSingle(),
  ]);
  const offer = offerData as Offer | null;

  if (offerError || !offer) {
    return <p className="card p-6 text-sm text-red-600">No se pudo cargar tu suscripción.</p>;
  }

  if (offer.fase !== "suscripciones") {
    return (
      <p className="card p-6 text-sm text-stone-600">
        En esta etapa de AltaEntrega no se cobran suscripciones: la plataforma se financia con una comisión por venta.
      </p>
    );
  }

  const { data: pagos } = sub
    ? await supabase
        .from("subscription_payments")
        .select("id, plan, monto, referencia, estado, motivo_rechazo, created_at")
        .eq("subscription_id", sub.id)
        .order("created_at", { ascending: false })
        .limit(12)
    : { data: [] };
  const enRevision = (pagos ?? []).some((p) => p.estado === "por_confirmar");
  const estado = sub ? estadoSuscripcion(sub, offer.dias_gracia) : null;
  const alerta = estado && (estado.estado === "gracia" || estado.estado === "pausada");

  return (
    <div className="flex flex-col gap-6">
      <section className={`card p-6 ${alerta ? "border-red-200 bg-red-50/40" : ""}`}>
        <p className="text-sm font-medium text-stone-500">Tu suscripción</p>
        {sub && estado ? (
          <>
            <p className="mt-1 font-display text-3xl font-semibold text-monte-800">{PLAN[sub.plan] ?? sub.plan}</p>
            <p className={`mt-2 text-sm ${alerta ? "font-medium text-red-700" : "text-stone-600"}`}>
              {mensajeSuscripcion(estado, tipo)}
            </p>
            <p className="mt-1 text-xs text-stone-500">Vigente hasta: {formatFecha(sub.vigente_hasta)}</p>
          </>
        ) : (
          <p className="mt-1 text-sm text-stone-600">Tu suscripción empieza cuando un administrador apruebe tu cuenta.</p>
        )}
      </section>

      {sub && (
        <section className="card flex flex-col gap-5 p-6">
          <div>
            <h2 className="font-display text-xl font-semibold">Pagar o renovar</h2>
            <p className="mt-1 text-sm text-stone-500">
              Transfiere el monto de tu plan a la cuenta de AltaEntrega y sube el comprobante. Al confirmarlo, tu
              suscripción se extiende desde su vencimiento (no pierdes días).
            </p>
          </div>
          {enRevision ? (
            <p className="rounded-xl bg-sol-50 p-4 text-sm text-sol-800">
              Tienes un pago en revisión. Te avisaremos aquí cuando lo confirmemos.
            </p>
          ) : offer.cuenta ? (
            <>
              <BankAccountCard
                cuenta={offer.cuenta}
                monto={offer.anual}
                titulo="Cuenta de AltaEntrega (el monto depende del plan que elijas)"
              />
              <SubscriptionPaymentForm mensual={offer.mensual} anual={offer.anual} descuento={offer.descuento_anual} />
            </>
          ) : (
            <p className="rounded-xl bg-sol-50 p-4 text-sm text-sol-800">
              Todavía no hay una cuenta configurada para recibir pagos. Escríbenos y te la enviamos.
            </p>
          )}
        </section>
      )}

      {pagos && pagos.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold">Tus pagos</h2>
          <ul className="flex flex-col gap-2">
            {pagos.map((p) => (
              <li key={p.id} className="card flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <span className="text-stone-500">{formatFecha(p.created_at)}</span>
                <span>
                  {PLAN[p.plan]} · <span className="font-semibold">RD${p.monto.toFixed(2)}</span> · ref. {p.referencia}
                </span>
                <span className={`badge ${ESTADO_PAGO[p.estado]?.clase ?? ""}`}>{ESTADO_PAGO[p.estado]?.texto ?? p.estado}</span>
                {p.motivo_rechazo && <span className="w-full text-xs text-red-700">Motivo: {p.motivo_rechazo}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
