"use client";

import { useActionState } from "react";
import { completePayoutAction } from "@/app/admin/actions";

/** Registrar la referencia de una transferencia hecha desde el banco. */
export default function PayoutCompleteForm({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(completePayoutAction, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={id} />
      <div className="flex gap-2">
        <input name="referencia" required placeholder="Ref. de la transferencia" className="input py-1.5 text-sm" />
        <button type="submit" disabled={pending} className="btn-primary btn-sm whitespace-nowrap">
          {pending ? "Guardando..." : "Marcar transferida"}
        </button>
      </div>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
