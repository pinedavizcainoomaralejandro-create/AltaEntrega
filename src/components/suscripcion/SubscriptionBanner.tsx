import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPublicConfig } from "@/lib/config";
import { estadoSuscripcion, mensajeSuscripcion } from "@/lib/subscription";

/** Aviso en los paneles cuando la prueba o la suscripción están por terminar o vencidas. */
export default async function SubscriptionBanner({ tipo, href }: { tipo: "tienda" | "courier"; href: string }) {
  const supabase = await createClient();
  const config = await getPublicConfig(supabase);
  if (config.fase !== "suscripciones") return null;

  const [{ data: sub }, { data: offer }] = await Promise.all([
    supabase.from("subscriptions").select("plan, vigente_hasta").maybeSingle(),
    supabase.rpc("get_subscription_offer"),
  ]);
  if (!sub) return null;

  const diasGracia = Number((offer as { dias_gracia?: number } | null)?.dias_gracia ?? 5);
  const estado = estadoSuscripcion(sub, diasGracia);
  // Solo avisamos cuando hace falta actuar (o en los últimos días de la prueba).
  if (estado.estado === "activa" || (estado.estado === "prueba" && estado.dias > 7)) return null;

  const grave = estado.estado === "gracia" || estado.estado === "pausada";
  return (
    <div
      className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 text-sm ${
        grave ? "bg-red-50 text-red-800" : "bg-sol-50 text-sol-800"
      }`}
    >
      <p className="font-medium">{mensajeSuscripcion(estado, tipo)}</p>
      <Link href={href} className={grave ? "btn-danger btn-sm" : "btn-accent btn-sm"}>
        {grave ? "Pagar ahora" : "Ver planes"}
      </Link>
    </div>
  );
}
