import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildAzulPaymentForm, getPaymentMode } from "@/lib/payments/azul";
import AzulRedirectForm from "@/components/pagos/AzulRedirectForm";
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
    .select("id, numero, codigo, subtotal, delivery_fee, total, estado")
    .eq("id", orderId)
    .eq("cliente_id", user.id)
    .maybeSingle();

  if (!order) notFound();
  if (order.estado !== "esperando_pago") redirect(`/pedidos/${order.id}`);

  const mode = getPaymentMode();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-2xl font-semibold">Pagar pedido {order.codigo}</h1>
      <p className="mb-6 text-sm text-neutral-500">Tienes 30 minutos para completar el pago; luego el pedido se cancela.</p>

      <div className="mb-6 rounded-lg border border-neutral-200 p-4 text-sm">
        <div className="flex justify-between">
          <span>Productos</span>
          <span>RD${order.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Delivery</span>
          <span>RD${order.delivery_fee.toFixed(2)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-neutral-100 pt-2 text-base font-medium">
          <span>Total</span>
          <span>RD${order.total.toFixed(2)}</span>
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
              className="flex-1 rounded-md bg-neutral-900 px-4 py-2 text-sm text-white"
            >
              Simular pago aprobado
            </button>
            <button
              type="submit"
              name="resultado"
              value="rechazado"
              className="flex-1 rounded-md border border-neutral-300 px-4 py-2 text-sm"
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
            total: order.total,
            siteUrl,
            orderId: order.id,
          })}
        />
      )}

      <Link href={`/pedidos/${order.id}`} className="mt-6 inline-block text-sm underline">
        Ver mi pedido
      </Link>
    </div>
  );
}
