import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OrderTimeline from "@/components/pedidos/OrderTimeline";
import PaymentResultBanner from "@/components/pagos/PaymentResultBanner";

const ESTADO_PAGO_LABEL: Record<string, string> = {
  pendiente: "Pendiente de pago",
  por_confirmar: "Transferencia enviada, el negocio la está confirmando",
  pagado: "Pagado",
  rechazado: "Pago rechazado",
  expirado: "Pago no completado",
  reembolso_pendiente: "Reembolso en proceso",
  reembolsado: "Reembolsado",
};

export default async function PedidoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ pago?: string }>;
}) {
  const { orderId } = await params;
  const { pago } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, codigo, tienda_nombre, direccion_entrega, subtotal, delivery_fee, total, estado, estado_pago, metodo_pago, reembolso_referencia, created_at"
    )
    .eq("id", orderId)
    .eq("cliente_id", user.id)
    .maybeSingle();

  if (!order) notFound();

  const { data: items } = await supabase
    .from("order_items")
    .select("id, nombre, cantidad, precio_unitario")
    .eq("order_id", order.id);

  const { data: history } = await supabase
    .from("order_status_history")
    .select("*")
    .eq("order_id", order.id)
    .order("fecha", { ascending: true });

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/pedidos" className="link mb-4 inline-block text-sm">
        ← Mis pedidos
      </Link>

      <PaymentResultBanner pago={pago} />

      <h1 className="mb-1 font-display text-3xl font-semibold tracking-tight">{order.tienda_nombre}</h1>
      <p className="text-xs text-stone-400">Pedido {order.codigo}</p>
      <p className="mb-6 text-sm text-stone-500">{order.direccion_entrega}</p>

      <div className="mb-6 card p-4">
        <p className="mb-2 font-medium">Productos</p>
        <ul className="flex flex-col gap-1 text-sm text-stone-600">
          {(items ?? []).map((i) => (
            <li key={i.id} className="flex justify-between gap-2">
              <span className="min-w-0 truncate">
                {i.cantidad}× {i.nombre}
              </span>
              <span className="shrink-0">RD${(i.precio_unitario * i.cantidad).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex justify-between border-t border-stone-100 pt-2 text-sm">
          <span>{order.metodo_pago === "transferencia" ? "Por transferencia al negocio" : "Con tarjeta"}</span>
          <span>RD${order.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-stone-600">
          <span>Delivery, en efectivo al repartidor</span>
          <span>RD${order.delivery_fee.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm font-medium">
          <span>Total del pedido</span>
          <span>RD${order.total.toFixed(2)}</span>
        </div>
        <p className="mt-1 text-xs text-stone-400">{ESTADO_PAGO_LABEL[order.estado_pago] ?? order.estado_pago}</p>
        {order.metodo_pago === "transferencia" && order.estado_pago === "reembolso_pendiente" && (
          <p className="mt-2 rounded-xl bg-sol-50 p-3 text-sm text-stone-700">
            El negocio te devolverá RD${order.subtotal.toFixed(2)} por transferencia y te contactará para coordinarlo.
          </p>
        )}
        {order.estado_pago === "reembolsado" && order.reembolso_referencia && (
          <p className="mt-1 text-xs text-stone-500">Referencia de la devolución: {order.reembolso_referencia}</p>
        )}
        {order.estado === "esperando_pago" && order.estado_pago !== "por_confirmar" && (
          <Link
            href={`/pagar/${order.id}`}
            className="mt-3 inline-block btn-primary"
          >
            {order.metodo_pago === "transferencia" ? "Transferir y enviar comprobante" : "Completar el pago"}
          </Link>
        )}
      </div>

      <h2 className="mb-3 font-display text-xl font-semibold">Seguimiento</h2>
      <OrderTimeline orderId={order.id} initialHistory={history ?? []} />
    </div>
  );
}
