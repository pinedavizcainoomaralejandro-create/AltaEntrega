import { savePlatformSettingsAction } from "@/app/admin/actions";

const MESSAGES: Record<string, { text: string; ok: boolean }> = {
  ok: { text: "Configuración guardada.", ok: true },
  comision_invalida: { text: "La comisión debe estar entre 0% y 50%.", ok: false },
  delivery_invalido: { text: "La tarifa de delivery debe estar entre RD$0 y RD$10,000.", ok: false },
  error: { text: "No se pudo guardar la configuración.", ok: false },
};

/**
 * Componente de servidor a propósito: sin "use client", su contenido no se
 * publica en los archivos JavaScript que descarga cualquier visitante.
 */
export default function PlatformSettingsForm({
  commissionRate,
  deliveryFee,
  result,
}: {
  commissionRate: number;
  deliveryFee: number;
  result?: string;
}) {
  const message = result ? MESSAGES[result] : undefined;

  return (
    <form action={savePlatformSettingsAction} className="flex flex-wrap items-end gap-4">
      <div>
        <label htmlFor="comision" className="label">
          Comisión sobre productos (%)
        </label>
        <input
          id="comision"
          name="comision"
          type="number"
          step="0.01"
          min="0"
          max="49.99"
          required
          defaultValue={Math.round(commissionRate * 10_000) / 100}
          className="w-32 input"
        />
      </div>
      <div>
        <label htmlFor="delivery" className="label">
          Tarifa de delivery (RD$)
        </label>
        <input
          id="delivery"
          name="delivery"
          type="number"
          step="0.01"
          min="0"
          max="10000"
          required
          defaultValue={deliveryFee}
          className="w-32 input"
        />
      </div>
      <button type="submit" className="btn-primary">
        Guardar
      </button>
      {message && <p className={`w-full text-sm ${message.ok ? "text-green-600" : "text-red-600"}`}>{message.text}</p>}
      <p className="w-full text-xs text-stone-500">
        La comisión se suma al precio de cada producto y el cliente solo ve el precio final. Los pedidos ya creados
        conservan sus montos.
      </p>
    </form>
  );
}
