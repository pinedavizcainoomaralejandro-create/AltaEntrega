"use client";

import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import { updatePasswordAction, type ResetPasswordState } from "../actions";
import AuthShell from "@/components/brand/AuthShell";
import PasswordInput from "@/components/PasswordInput";

const initialState: ResetPasswordState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary w-full"
    >
      {pending ? "Guardando..." : "Guardar nueva contraseña"}
    </button>
  );
}

export default function ResetPasswordPage() {
  const [state, formAction] = useActionState(updatePasswordAction, initialState);

  return (
    <AuthShell title="Crea una nueva contraseña" subtitle="Elige una contraseña segura para tu cuenta.">

      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <label htmlFor="password" className="label">
            Nueva contraseña
          </label>
          <PasswordInput
            id="password"
            name="password"
            required
            minLength={8}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="label">
            Confirmar contraseña
          </label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            required
            minLength={8}
            className="input"
          />
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <SubmitButton />
      </form>
    </AuthShell>
  );
}
