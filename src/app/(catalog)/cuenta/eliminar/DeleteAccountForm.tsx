"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteAccountAction, type DeleteAccountState } from "./actions";

const initialState: DeleteAccountState = { error: null };

function SubmitButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={!enabled || pending} className="btn-danger w-full">
      {pending ? "Eliminando..." : "Eliminar mi cuenta para siempre"}
    </button>
  );
}

export default function DeleteAccountForm() {
  const [state, formAction] = useActionState(deleteAccountAction, initialState);
  const [confirmacion, setConfirmacion] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="confirmacion" className="label">
          Escribe <strong>ELIMINAR</strong> para confirmar
        </label>
        <input
          id="confirmacion"
          name="confirmacion"
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          className="input"
        />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <SubmitButton enabled={confirmacion.trim().toUpperCase() === "ELIMINAR"} />
    </form>
  );
}
