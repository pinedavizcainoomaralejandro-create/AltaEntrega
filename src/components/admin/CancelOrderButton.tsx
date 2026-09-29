"use client";

import { useActionState } from "react";
import type { ApprovalState } from "@/app/admin/actions";

const initialState: ApprovalState = { error: null };

export default function CancelOrderButton({
  id,
  action,
}: {
  id: string;
  action: (state: ApprovalState, formData: FormData) => Promise<ApprovalState>;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("¿Cancelar este pedido? El stock de sus productos se devolverá.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-xs text-red-600 underline">
        Cancelar
      </button>
      {state.error && <p className="mt-1 max-w-[12rem] text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
