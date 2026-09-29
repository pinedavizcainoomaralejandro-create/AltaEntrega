"use client";

import { useActionState } from "react";
import type { ApprovalState } from "@/app/admin/actions";

const initialState: ApprovalState = { error: null };

/** Botón de una acción de admin con campos ocultos, confirmación y error. */
export default function AdminActionButton({
  action,
  fields,
  label,
  confirmMessage,
}: {
  action: (state: ApprovalState, formData: FormData) => Promise<ApprovalState>;
  fields: Record<string, string>;
  label: string;
  confirmMessage: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
      className="text-right"
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" disabled={pending} className="text-xs font-medium underline disabled:opacity-50">
        {pending ? "Guardando..." : label}
      </button>
      {state.error && <p className="mt-1 max-w-[14rem] text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
