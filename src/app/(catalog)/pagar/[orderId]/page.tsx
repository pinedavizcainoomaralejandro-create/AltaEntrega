import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildAzulPaymentForm, getPaymentMode } from "@/lib/payments/azul";
import AzulRedirectForm from "@/components/pagos/AzulRedirectForm";
import BankAccountCard from "@/components/pagos/BankAccountCard";
import TransferProofForm from "@/components/pagos/TransferProofForm";
import { getPublicConfig } from "@/lib/config";
import { simulatePaymentAction } from "./actions";

export default async function PagarPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: order } = await supabase
    .from("orders")
    .select("id, numero, codigo, subtotal, delivery_fee, total, estado, metodo_pago, estado_pago, pago_motivo_rechazo")
    .eq("id", orderId)
    .eq("cliente_id", user.id)
    .maybeSingle();

  if (!order) notFound();
  if (order.estado !== "esperando_pago") redirect(`/pedidos/${order.id}`);

  // Fase 1: transferencia directa al negocio con comprobante.
  if (order.metodo_pago === "transferencia") {
    const [{ data: cuenta }, config] = await Promise.all([
      supabase.rpc("get_order_payment_account", { p_order_id: order.id }),
      getPublicConfig(supabase),
    ]);
    const datos = cuenta as { banco: string; tipo_cuenta: string; numero_cuenta: string; titular: string; documento: string } | null;

    return (
      <div className="card mx-auto flex max-w-md flex-col gap-6 p-6 sm:p-8">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Pagar pedido {order.codigo}</h1>
          <p className="mt-1 text-sm text-stone-500">
            Transfiere al negocio y envía el comprobante. Tienes {config.horas_para_transferir} horas; luego el pedido
            se cancela. El delivery (RD${order.delivery_fee.toFixed(2)}) se lo pagas en efectivo al repartidor.
          </p>
        </div>

        {order.estado_pago === "por_confirmar" ? (
          <p className="rounded-xl bg-monte-50 p-4 text-sm text-monte-800">
            Recibimos tu comprobante. El negocio está confirmando tu transferencia; te avisaremos en tu pedido.
          </p>
        ) : datos ? (
          <>
            {order.estado_pago === "rechazado" && (
              <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                El negocio no pudo confirmar tu transferencia
                {order.pago_motivo_rechazo ? `: ${order.pago_motivo_rechazo}` : "."} Revisa los datos y envía otro
                comprobante.
              </p>
            )}
            <BankAccountCard cuenta={datos} monto={order.subtotal} titulo="Transfiere a la cuenta del negocio" />
            <TransferProofForm orderId={order.id} />
          </>
        ) : (
          <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
            No pudimos cargar la cuenta del negocio. Vuelve a intentarlo en unos minutos.
          </p>
        )}

        <Link href={`/pedidos/${order.id}`} className="link text-sm">
          Ver mi pedido
        </Link>
      </div>
    );
  }

  const mode = getPaymentMode();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return (
    <div className="card mx-auto max-w-md p-6 sm:p-8">
      <h1 className="mb-1 font-display text-3xl font-semibold tracking-tight">Pagar pedido {order.codigo}</h1>
      <p className="mb-6 text-sm text-stone-500">Tienes 30 minutos para completar el pago; luego el pedido se cancela.</p>

      <div className="mb-6 card p-4 text-sm">
        <div className="flex justify-between text-base font-semibold">
          <span>Pagas ahora con tarjeta</span>
          <span>RD${order.subtotal.toFixed(2)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-stone-100 pt-2 text-stone-600">
          <span>Delivery, en efectivo al repartidor</span>
          <span>RD${order.delivery_fee.toFixed(2)}</span>
        </div>
      </div>

      {mode === "simulado" ? (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-amber-400 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            Modo de pago simulado (desarrollo): no se cobra nada. Configura AZUL para cobrar de verdad.
          </p>
          <form action={simulatePaymentAction} className="flex gap-2">
            <input type="hidden" name="orderId" value={order.id} />
            <button
              type="submit"
              name="resultado"
              value="aprobado"
              className="flex-1 btn-primary"
            >
              Simular pago aprobado
            </button>
            <button
              type="submit"
              name="resultado"
              value="rechazado"
              className="flex-1 btn-secondary"
            >
              Simular rechazo
            </button>
          </form>
        </div>
      ) : (
        <AzulRedirectForm
          form={buildAzulPaymentForm({
            mode,
            orderNumber: String(order.numero),
            // En línea solo los productos: el delivery se paga en efectivo al recibir.
            total: order.subtotal,
            siteUrl,
            orderId: order.id,
          })}
        />
      )}

      <Link href={`/pedidos/${order.id}`} className="link mt-6 inline-block text-sm">
        Ver mi pedido
      </Link>
    </div>
  );
}
