import { requireOwnStore } from "@/lib/supabase/current-store";
import BankAccountForm from "@/components/pagos/BankAccountForm";
import { enmascararCuenta } from "@/lib/bankAccount";
import { formatFecha } from "@/lib/format";
import { saveStoreBankAccountAction } from "./actions";

const ESTADO: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: "Por transferir", clase: "bg-sol-100 text-sol-800" },
  enviado: { texto: "Enviada", clase: "bg-monte-50 text-monte-700" },
  completado: { texto: "Transferida", clase: "bg-monte-100 text-monte-800" },
  fallido: { texto: "Falló, se reintentará", clase: "bg-red-50 text-red-700" },
  cancelado: { texto: "Cancelada (pedido cancelado)", clase: "bg-stone-100 text-stone-500" },
};

export default async function CobrosPage() {
  const { supabase, store } = await requireOwnStore();

  const [{ data: cuenta }, { data: movimientos }, { data: transferencias }] = await Promise.all([
    supabase.from("store_payout_accounts").select("banco, tipo_cuenta, numero_cuenta, titular, documento").eq("store_id", store.id).maybeSingle(),
    supabase.from("ledger_entries").select("monto").eq("store_id", store.id),
    supabase
      .from("payouts")
      .select("id, monto, estado, referencia, created_at, completado_at")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const saldo = (movimientos ?? []).reduce((sum, m) => sum + m.monto, 0);
  const transferido = (transferencias ?? []).filter((t) => t.estado === "completado").reduce((s, t) => s + t.monto, 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card relative overflow-hidden p-6">
          <span className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-monte-50" aria-hidden />
          <p className="relative text-sm font-medium text-stone-500">Por recibir</p>
          <p className="relative mt-1 font-display text-4xl font-semibold text-monte-800">RD${saldo.toFixed(2)}</p>
          <p className="relative mt-2 text-xs text-stone-500">
            Cada venta se te acredita en el momento en que el cliente paga, por el precio que publicaste.
          </p>
        </div>
        <div className="card relative overflow-hidden p-6">
          <span className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-sol-50" aria-hidden />
          <p className="relative text-sm font-medium text-stone-500">Ya transferido (últimas 30)</p>
          <p className="relative mt-1 font-display text-4xl font-semibold text-stone-800">RD${transferido.toFixed(2)}</p>
        </div>
      </div>

      <section className="card p-6">
        <h2 className="font-display text-xl font-semibold">Cuenta para recibir tus pagos</h2>
        <p className="mb-5 mt-1 text-sm text-stone-500">
          {cuenta
            ? `Transferimos a ${cuenta.banco}, cuenta de ${cuenta.tipo_cuenta} ${enmascararCuenta(cuenta.numero_cuenta)} a nombre de ${cuenta.titular}.`
            : "Registra tu cuenta para que podamos transferirte cada venta. Mientras no la tengas, tus pagos quedan guardados."}
        </p>
        {!cuenta && (
          <p className="mb-5 rounded-xl bg-sol-50 p-3 text-sm text-sol-800">
            Falta tu cuenta bancaria: sin ella no podemos enviarte el dinero de tus ventas.
          </p>
        )}
        <BankAccountForm action={saveStoreBankAccountAction} initial={cuenta} />
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Transferencias</h2>
        {!transferencias || transferencias.length === 0 ? (
          <p className="text-sm text-stone-500">Todavía no hay ventas cobradas.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {transferencias.map((t) => (
              <li key={t.id} className="card flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <span className="text-stone-500">{formatFecha(t.created_at)}</span>
                <span className="font-display text-lg font-semibold">RD${t.monto.toFixed(2)}</span>
                <span className={`badge ${ESTADO[t.estado]?.clase ?? ""}`}>{ESTADO[t.estado]?.texto ?? t.estado}</span>
                {t.referencia && <span className="w-full text-xs text-stone-400">Ref. {t.referencia}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
