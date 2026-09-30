"use client";

import { useActionState, useState } from "react";
import { submitSubscriptionPaymentAction, type SubscriptionPaymentState } from "@/app/suscripcion/actions";

const initialState: SubscriptionPaymentState = { error: null };
const rd = (n: number) => `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function SubscriptionPaymentForm({
  mensual,
  anual,
  descuento,
}: {
  mensual: number;
  anual: number;
  descuento: number;
}) {
  const [state, formAction, pending] = useActionState(submitSubscriptionPaymentAction, initialState);
  const [plan, setPlan] = useState<"mensual" | "anual">("anual");

  if (state.enviado) {
    return (
      <p className="rounded-xl bg-monte-50 p-4 text-sm text-monte-800">
        ¡Recibimos tu comprobante! Lo confirmaremos pronto y tu suscripción se extenderá automáticamente.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="label">Elige tu plan</legend>
        {(
          [
            ["mensual", "Mensual", mensual, "Se renueva cada mes"],
            ["anual", "Anual", anual, `Ahorras ${rd(mensual * 12 - anual)} (${Math.round(descuento * 100)}% de descuento)`],
          ] as const
        ).map(([value, nombre, monto, nota]) => (
          <label
            key={value}
            className="relative flex cursor-pointer flex-col gap-1 rounded-2xl border border-stone-300 bg-white p-4 transition hover:border-monte-400 has-[:checked]:border-monte-600 has-[:checked]:ring-4 has-[:checked]:ring-monte-500/15"
          >
            <input
              type="radio"
              name="plan"
              value={value}
              checked={plan === value}
              onChange={() => setPlan(value)}
              className="sr-only"
            />
            {value === "anual" && (
              <span className="badge absolute right-3 top-3 bg-sol-400 text-monte-950">-{Math.round(descuento * 100)}%</span>
            )}
            <span className="text-sm font-semibold text-stone-700">{nombre}</span>
            <span className="font-display text-3xl font-semibold text-monte-800">{rd(monto)}</span>
            <span className="text-xs text-stone-500">{nota}</span>
          </label>
        ))}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="referencia" className="label">Referencia de la transferencia</label>
          <input id="referencia" name="referencia" required maxLength={100} className="input" />
        </div>
        <div>
          <label htmlFor="comprobante" className="label">Comprobante (foto o PDF)</label>
          <input
            id="comprobante"
            name="comprobante"
            type="file"
            required
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-monte-50 file:px-3 file:py-2 file:font-semibold file:text-monte-700"
          />
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-accent w-full py-3 text-base sm:w-auto">
        {pending ? "Enviando..." : `Ya transferí ${rd(plan === "anual" ? anual : mensual)}, enviar comprobante`}
      </button>
    </form>
  );
}
