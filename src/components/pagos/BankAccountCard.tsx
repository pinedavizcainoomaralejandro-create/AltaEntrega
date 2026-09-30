type Cuenta = { banco: string; tipo_cuenta: string; numero_cuenta: string; titular: string; documento: string };

/** Datos de una cuenta para transferir, fáciles de copiar. */
export default function BankAccountCard({ cuenta, monto, titulo }: { cuenta: Cuenta; monto: number; titulo: string }) {
  const filas: [string, string][] = [
    ["Banco", cuenta.banco],
    ["Tipo de cuenta", cuenta.tipo_cuenta === "corriente" ? "Corriente" : "Ahorros"],
    ["Número de cuenta", cuenta.numero_cuenta],
    ["A nombre de", cuenta.titular],
    ["Cédula / RNC", cuenta.documento],
  ];
  return (
    <div className="rounded-2xl border border-monte-200 bg-monte-50 p-4 text-sm">
      <p className="mb-3 font-semibold text-monte-900">{titulo}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        {filas.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-monte-700">{k}</dt>
            <dd className="select-all font-medium text-stone-900">{v}</dd>
          </div>
        ))}
        <dt className="text-monte-700">Monto</dt>
        <dd className="select-all font-display text-lg font-semibold text-stone-900">RD${monto.toFixed(2)}</dd>
      </dl>
    </div>
  );
}
