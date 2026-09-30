import { savePlatformSettingsAction } from "@/app/admin/actions";

const MESSAGES: Record<string, { text: string; ok: boolean }> = {
  ok: { text: "Configuración guardada.", ok: true },
  comision_invalida: { text: "La comisión debe estar entre 0% y 50%.", ok: false },
  delivery_invalido: { text: "La tarifa de delivery debe estar entre RD$0 y RD$10,000.", ok: false },
  precio_invalido: { text: "Los precios de suscripción no son válidos.", ok: false },
  descuento_invalido: { text: "El descuento anual debe estar entre 0% y 90%.", ok: false },
  dias_invalidos: { text: "Revisa los días de prueba (0-365), de gracia (0-60) y las horas para transferir (1-168).", ok: false },
  error: { text: "No se pudo guardar la configuración.", ok: false },
};

export type PlatformSettings = {
  fase: string;
  commission_rate: number;
  delivery_fee: number;
  precio_negocio_mensual: number;
  precio_delivery_mensual: number;
  descuento_anual: number;
  dias_prueba: number;
  dias_gracia: number;
  horas_para_transferir: number;
};

function Campo({
  name,
  label,
  defaultValue,
  step = "1",
  min = "0",
  max,
}: {
  name: string;
  label: string;
  defaultValue: number;
  step?: string;
  min?: string;
  max?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <input id={name} name={name} type="number" step={step} min={min} max={max} required defaultValue={defaultValue} className="input" />
    </div>
  );
}

/**
 * Componente de servidor a propósito: sin "use client", su contenido no se
 * publica en los archivos JavaScript que descarga cualquier visitante.
 */
export default function PlatformSettingsForm({ settings, result }: { settings: PlatformSettings; result?: string }) {
  const message = result ? MESSAGES[result] : undefined;
  const pct = (n: number) => Math.round(n * 10_000) / 100;

  return (
    <form action={savePlatformSettingsAction} className="flex flex-col gap-6">
      <fieldset>
        <legend className="label">Fase de cobro</legend>
        <div className="grid gap-3 md:grid-cols-2">
          {(
            [
              ["suscripciones", "Fase 1 · Transferencias y suscripciones", "Clientes gratis y transfieren al negocio; negocios y repartidores pagan su suscripción."],
              ["azul", "Fase 2 · AZUL y comisión", "Clientes pagan con tarjeta; la plataforma cobra comisión y reparte al cobrar."],
            ] as const
          ).map(([value, titulo, texto]) => (
            <label
              key={value}
              className="flex cursor-pointer flex-col gap-1 rounded-2xl border border-stone-300 bg-white p-4 transition has-[:checked]:border-monte-600 has-[:checked]:ring-4 has-[:checked]:ring-monte-500/15"
            >
              <span className="flex items-center gap-2 font-semibold text-stone-800">
                <input type="radio" name="fase" value={value} defaultChecked={settings.fase === value} className="accent-monte-700" />
                {titulo}
              </span>
              <span className="text-xs text-stone-500">{texto}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-stone-500">
          Cambiar de fase afecta los pedidos nuevos; los que ya existen terminan con el método con que se crearon.
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo name="precio_negocio" label="Negocio, al mes (RD$)" defaultValue={settings.precio_negocio_mensual} step="0.01" />
        <Campo name="precio_delivery" label="Repartidor, al mes (RD$)" defaultValue={settings.precio_delivery_mensual} step="0.01" />
        <Campo name="descuento" label="Descuento anual (%)" defaultValue={pct(settings.descuento_anual)} step="0.1" max="89" />
        <Campo name="dias_prueba" label="Días de prueba gratis" defaultValue={settings.dias_prueba} max="365" />
        <Campo name="dias_gracia" label="Días de gracia al vencer" defaultValue={settings.dias_gracia} max="60" />
        <Campo name="horas_transferir" label="Horas para transferir un pedido" defaultValue={settings.horas_para_transferir} min="1" max="168" />
        <Campo name="delivery" label="Tarifa de delivery (RD$)" defaultValue={settings.delivery_fee} step="0.01" max="10000" />
        <Campo name="comision" label="Comisión en fase 2 (%)" defaultValue={pct(settings.commission_rate)} step="0.01" max="49.99" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary">
          Guardar configuración
        </button>
        {message && <p className={`text-sm ${message.ok ? "text-monte-700" : "text-red-600"}`}>{message.text}</p>}
      </div>
    </form>
  );
}
