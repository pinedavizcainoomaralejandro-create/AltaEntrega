"use client";

import { useActionState } from "react";
import { BANCOS_RD } from "@/lib/bankAccount";

type State = { error: string | null; saved?: boolean; values?: Record<string, string> };

/** Formulario de cuenta bancaria (negocio o cuenta de ganancias del fundador). */
export default function BankAccountForm({
  action,
  initial,
  submitLabel = "Guardar cuenta",
}: {
  action: (state: State, formData: FormData) => Promise<State>;
  initial: { banco: string; tipo_cuenta: string; numero_cuenta: string; titular: string; documento: string } | null;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const v = (k: keyof NonNullable<typeof initial>) => state.values?.[k] ?? initial?.[k] ?? "";

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="banco" className="label">Banco</label>
        <select id="banco" name="banco" required defaultValue={v("banco")} className="input">
          <option value="" disabled>
            Elige tu banco
          </option>
          {BANCOS_RD.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="tipo_cuenta" className="label">Tipo de cuenta</label>
        <select id="tipo_cuenta" name="tipo_cuenta" required defaultValue={v("tipo_cuenta") || "ahorros"} className="input">
          <option value="ahorros">Ahorros</option>
          <option value="corriente">Corriente</option>
        </select>
      </div>
      <div>
        <label htmlFor="numero_cuenta" className="label">Número de cuenta</label>
        <input id="numero_cuenta" name="numero_cuenta" required inputMode="numeric" defaultValue={v("numero_cuenta")} className="input" />
      </div>
      <div>
        <label htmlFor="documento" className="label">Cédula o RNC del titular</label>
        <input id="documento" name="documento" required inputMode="numeric" placeholder="001-1234567-8" defaultValue={v("documento")} className="input" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="titular" className="label">Nombre del titular</label>
        <input id="titular" name="titular" required maxLength={100} defaultValue={v("titular")} className="input" />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Guardando..." : submitLabel}
        </button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.saved && <p className="text-sm text-monte-700">Cuenta guardada.</p>}
      </div>
    </form>
  );
}
