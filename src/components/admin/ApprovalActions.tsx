"use client";

import { useActionState } from "react";
import type { ApprovalState } from "@/app/admin/actions";

const initialState: ApprovalState = { error: null };

export default function ApprovalActions({
  id,
  action,
  confirmRejectMessage,
}: {
  id: string;
  action: (state: ApprovalState, formData: FormData) => Promise<ApprovalState>;
  confirmRejectMessage: string;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <form action={formAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="estado" value="aprobado" />
          <button type="submit" className="btn-primary btn-sm">
            Aprobar
          </button>
        </form>
        <form
          action={formAction}
          onSubmit={(e) => {
            if (!confirm(confirmRejectMessage)) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="estado" value="rechazado" />
          <button type="submit" className="btn-danger btn-sm">
            Rechazar
          </button>
        </form>
      </div>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </div>
  );
}
