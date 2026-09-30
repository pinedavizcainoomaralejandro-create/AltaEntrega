"use client";

import { useActionState, useState } from "react";
import { reviewSubscriptionPaymentAction, type ApprovalState } from "@/app/admin/actions";

const initialState: ApprovalState = { error: null };

export default function SubscriptionReviewButtons({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(reviewSubscriptionPaymentAction, initialState);
  const [rechazando, setRechazando] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      {rechazando ? (
        <div className="flex gap-2">
          <input name="motivo" required placeholder="Motivo del rechazo" className="input py-1.5 text-sm" />
          <button type="submit" name="decision" value="rechazar" disabled={pending} className="btn-danger btn-sm">
            Rechazar
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="submit" name="decision" value="aprobar" disabled={pending} className="btn-primary btn-sm">
            {pending ? "Guardando..." : "Aprobar pago"}
          </button>
          <button type="button" onClick={() => setRechazando(true)} className="btn-secondary btn-sm">
            Rechazar
          </button>
        </div>
      )}
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
