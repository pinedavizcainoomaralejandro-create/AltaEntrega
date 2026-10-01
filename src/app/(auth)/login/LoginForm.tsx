"use client";

import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction, type AuthFormState } from "../actions";
import AuthShell from "@/components/brand/AuthShell";
import PasswordInput from "@/components/PasswordInput";
import AppDownloadBanner from "@/components/AppDownloadBanner";

const initialState: AuthFormState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary w-full"
    >
      {pending ? "Ingresando..." : "Ingresar"}
    </button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);
  const params = useSearchParams();
  const checkEmail = params.get("check_email") === "1";
  const linkError = params.get("link_error") === "1";
  const cuentaEliminada = params.get("cuenta_eliminada") === "1";
  const redirectTo = params.get("redirect") ?? "";

  return (
    <AuthShell title="Bienvenido de vuelta" subtitle="Entra para pedir en los negocios de Villa Altagracia o gestionar el tuyo.">

      {checkEmail && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Revisa tu correo para confirmar la cuenta antes de iniciar sesión.
        </p>
      )}

      {cuentaEliminada && (
        <p className="rounded-xl bg-monte-50 p-3 text-sm text-monte-800">
          Tu cuenta fue eliminada. Gracias por haber usado AltaEntrega.
        </p>
      )}

      {linkError && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          El enlace del correo expiró o ya se usó. Si ya confirmaste tu cuenta, inicia sesión; si no,
          regístrate de nuevo o solicita otro enlace.
        </p>
      )}

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="redirect" value={redirectTo} />
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" defaultValue={state.values?.email} type="email" required className="input" />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-stone-700">Contraseña</label>
            <Link href="/forgot-password" className="text-xs font-medium text-monte-700 hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <PasswordInput id="password" name="password" required className="input" />
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <SubmitButton />
      </form>

      <p className="text-center text-sm text-stone-500">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="link">
          Regístrate
        </Link>
      </p>

      <AppDownloadBanner />
    </AuthShell>
  );
}
