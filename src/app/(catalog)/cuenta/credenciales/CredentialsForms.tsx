"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { changeEmailAction, changePasswordAction, type AccountFormState } from "../actions";
import PasswordInput from "@/components/PasswordInput";

const initialState: AccountFormState = { error: null, message: null };

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending ? pendingLabel : label}
    </button>
  );
}

function Feedback({ state }: { state: AccountFormState }) {
  if (state.error) return <p className="text-sm text-red-600">{state.error}</p>;
  if (state.message) return <p className="text-sm text-monte-700">{state.message}</p>;
  return null;
}

export function EmailForm() {
  const [state, formAction] = useActionState(changeEmailAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="label">
          Nuevo email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={state.values?.email}
          className="input"
        />
      </div>
      <Feedback state={state} />
      <SubmitButton label="Cambiar email" pendingLabel="Enviando enlace..." />
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="currentPassword" className="label">
          Contraseña actual
        </label>
        <PasswordInput id="currentPassword" name="currentPassword" required autoComplete="current-password" className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Nueva contraseña
        </label>
        <PasswordInput id="password" name="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="label">
          Confirmar nueva contraseña
        </label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          required
          minLength={8}
          autoComplete="new-password"
          className="input"
        />
      </div>
      <Feedback state={state} />
      <SubmitButton label="Cambiar contraseña" pendingLabel="Guardando..." />
    </form>
  );
}
