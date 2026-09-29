import { createClient } from "@/lib/supabase/server";
import { formatFecha } from "@/lib/format";
import { markRefundedAction, saveGananciasAccountAction } from "@/app/admin/actions";
import BankAccountForm from "@/components/pagos/BankAccountForm";
import AdminActionButton from "./AdminActionButton";
import PayoutCompleteForm from "./PayoutCompleteForm";
import PlatformSettingsForm from "./PlatformSettingsForm";

type Cuenta = { banco: string; tipo_cuenta: string; numero_cuenta: string; titular: string; documento: string };

const ESTADO_PAYOUT: Record<string, string> = {
  pendiente: "Por transferir",
  enviado: "Enviada, esperando confirmación",
  fallido: "Falló",
};

/**
 * Cobros y reparto: configuración, cuenta de ganancias del fundador, cola de
 * transferencias creadas en el momento de cada cobro y reembolsos.
 */
export default async function PaymentsAdmin({ configResult }: { configResult?: string }) {
  const supabase = await createClient();

  const [{ data: settings }, { data: pendientes }, { data: plataforma }, { data: refunds }] = await Promise.all([
    supabase
      .from("platform_settings")
      .select(
        "commission_rate, delivery_fee, ganancias_banco, ganancias_tipo_cuenta, ganancias_numero_cuenta, ganancias_titular, ganancias_documento"
      )
      .maybeSingle(),
    supabase
      .from("payouts")
      .select("id, order_id, destino, store_id, monto, estado, cuenta, error, created_at")
      .in("estado", ["pendiente", "enviado", "fallido"])
      .order("created_at", { ascending: true }),
    supabase.from("ledger_entries").select("monto, tipo").eq("cuenta", "plataforma"),
    supabase
      .from("orders")
      .select("id, numero, codigo, total, subtotal, pago_referencia, pagado_at")
      .eq("estado_pago", "reembolso_pendiente")
      .order("pagado_at", { ascending: true }),
  ]);

  const payouts = pendientes ?? [];
  const storeIds = Array.from(new Set(payouts.map((p) => p.store_id).filter((id): id is string => Boolean(id))));
  const orderIds = Array.from(new Set(payouts.map((p) => p.order_id)));
  const [{ data: stores }, { data: orders }, { data: cuentasActuales }] = await Promise.all([
    storeIds.length
      ? supabase.from("stores").select("id, nombre").in("id", storeIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
    orderIds.length
      ? supabase.from("orders").select("id, codigo").in("id", orderIds)
      : Promise.resolve({ data: [] as { id: string; codigo: string }[] }),
    storeIds.length
      ? supabase
          .from("store_payout_accounts")
          .select("store_id, banco, tipo_cuenta, numero_cuenta, titular, documento")
          .in("store_id", storeIds)
      : Promise.resolve({ data: [] as (Cuenta & { store_id: string })[] }),
  ]);
  const storeName = new Map((stores ?? []).map((s) => [s.id, s.nombre] as const));
  const orderCode = new Map((orders ?? []).map((o) => [o.id, o.codigo] as const));
  const cuentaActual = new Map((cuentasActuales ?? []).map((c) => [c.store_id, c] as const));

  const gananciasCuenta: Cuenta | null =
    settings?.ganancias_numero_cuenta && settings.ganancias_banco && settings.ganancias_tipo_cuenta
      ? {
          banco: settings.ganancias_banco,
          tipo_cuenta: settings.ganancias_tipo_cuenta,
          numero_cuenta: settings.ganancias_numero_cuenta,
          titular: settings.ganancias_titular ?? "",
          documento: settings.ganancias_documento ?? "",
        }
      : null;

  const movimientosPlataforma = plataforma ?? [];
  const gananciasTotales = movimientosPlataforma
    .filter((m) => m.tipo !== "transferencia")
    .reduce((s, m) => s + m.monto, 0);
  const gananciasPorTransferir = movimientosPlataforma.reduce((s, m) => s + m.monto, 0);
  const porTransferirNegocios = payouts.filter((p) => p.destino === "tienda").reduce((s, p) => s + p.monto, 0);

  // La cuenta guardada al cobrar o, si entonces no había, la registrada ahora.
  const cuentaDe = (p: (typeof payouts)[number]): Cuenta | null =>
    (p.cuenta as Cuenta | null) ??
    (p.destino === "tienda" ? cuentaActual.get(p.store_id ?? "") ?? null : gananciasCuenta);

  return (
    <section className="mb-10 flex flex-col gap-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm font-medium text-stone-500">Ganancias de la plataforma</p>
          <p className="mt-1 font-display text-3xl font-semibold text-monte-800">RD${gananciasTotales.toFixed(2)}</p>
          <p className="mt-1 text-xs text-stone-500">Comisiones cobradas, descontando reembolsos.</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-stone-500">Ganancias por transferir a tu cuenta</p>
          <p className="mt-1 font-display text-3xl font-semibold text-sol-700">RD${gananciasPorTransferir.toFixed(2)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-stone-500">Por transferir a negocios</p>
          <p className="mt-1 font-display text-3xl font-semibold text-stone-800">RD${porTransferirNegocios.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-4 font-display text-xl font-semibold">Comisión y delivery</h2>
          {settings ? (
            <PlatformSettingsForm
              commissionRate={settings.commission_rate}
              deliveryFee={settings.delivery_fee}
              result={configResult}
            />
          ) : (
            <p className="text-sm text-red-600">No se pudo cargar la configuración.</p>
          )}
        </div>
        <div className="card p-6">
          <h2 className="font-display text-xl font-semibold">Tu cuenta de ganancias</h2>
          <p className="mb-4 mt-1 text-sm text-stone-500">
            A esta cuenta va la parte de la plataforma de cada cobro, en el mismo momento en que el cliente paga.
          </p>
          <BankAccountForm
            action={saveGananciasAccountAction}
            initial={gananciasCuenta}
            submitLabel="Guardar cuenta de ganancias"
          />
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold">Transferencias por hacer</h2>
        <p className="mb-3 mt-1 text-sm text-stone-500">
          Se crean solas en el momento de cada cobro. Mientras AZUL o tu banco no permitan enviarlas automáticamente,
          transfiere desde tu banco y registra la referencia.
        </p>
        {payouts.length === 0 ? (
          <p className="card p-5 text-sm text-stone-500">No hay transferencias pendientes.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {payouts.map((p) => {
              const cuenta = cuentaDe(p);
              return (
                <li
                  key={p.id}
                  className="card flex flex-col gap-3 p-4 text-sm lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {p.destino === "tienda" ? storeName.get(p.store_id ?? "") ?? "Negocio" : "Tu cuenta de ganancias"}
                      <span className="ml-2 font-display text-lg font-semibold text-monte-800">
                        RD${p.monto.toFixed(2)}
                      </span>
                    </p>
                    <p className="text-xs text-stone-500">
                      Pedido {orderCode.get(p.order_id) ?? "—"} · {formatFecha(p.created_at)} ·{" "}
                      {ESTADO_PAYOUT[p.estado] ?? p.estado}
                      {p.error && ` · ${p.error}`}
                    </p>
                    {cuenta ? (
                      <p className="mt-1 text-xs text-stone-600">
                        {cuenta.banco} · {cuenta.tipo_cuenta} {cuenta.numero_cuenta} · {cuenta.titular} ·{" "}
                        {cuenta.documento}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs font-medium text-sol-700">
                        {p.destino === "tienda"
                          ? "El negocio todavía no registró su cuenta bancaria."
                          : "Registra arriba tu cuenta de ganancias."}
                      </p>
                    )}
                  </div>
                  {cuenta && <PayoutCompleteForm id={p.id} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-2 font-display text-xl font-semibold">Reembolsos pendientes</h2>
        {!refunds || refunds.length === 0 ? (
          <p className="text-sm text-stone-500">Nada pendiente.</p>
        ) : (
          <>
            <p className="mb-2 text-xs text-stone-500">
              Haz el reembolso desde el portal de AZUL con la referencia y luego márcalo aquí.
            </p>
            <ul className="flex flex-col gap-2">
              {refunds.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-arena-50 p-3 text-sm"
                >
                  <span>
                    Pedido {r.codigo} (AZUL #{r.numero}) · RD${r.subtotal.toFixed(2)} · ref. {r.pago_referencia ?? "—"}
                    {r.pagado_at && <span className="text-stone-500"> · {formatFecha(r.pagado_at)}</span>}
                  </span>
                  <AdminActionButton
                    action={markRefundedAction}
                    fields={{ id: r.id }}
                    label="Marcar reembolsado"
                    confirmMessage={`¿Ya reembolsaste RD$${r.subtotal.toFixed(2)} del pedido ${r.codigo}?`}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
