"use client";

import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import Link from "next/link";
import { signUpAction, type AuthFormState } from "../actions";
import AuthShell from "@/components/brand/AuthShell";
import PasswordInput from "@/components/PasswordInput";

const initialState: AuthFormState = { error: null };

const ROLES = [
  { value: "cliente", label: "Cliente" },
  { value: "tienda", label: "Negocio" },
  { value: "courier", label: "Delivery" },
] as const;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary w-full"
    >
      {pending ? "Creando cuenta..." : "Crear cuenta"}
    </button>
  );
}

export default function RegisterPage() {
  const [state, formAction] = useActionState(signUpAction, initialState);

  return (
    <AuthShell
      title="Crea tu cuenta"
      subtitle="Pide comida y compras en los negocios de tu pueblo, vende en tu negocio o reparte pedidos. Negocios y repartidores pasan por una aprobación rápida."
    >

      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <label className="label">Quiero registrarme como</label>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((r) => (
              <label
                key={r.value}
                className="flex cursor-pointer items-center justify-center rounded-xl border border-stone-300 bg-white p-2.5 text-sm font-medium transition hover:border-monte-400 has-[:checked]:border-monte-700 has-[:checked]:bg-monte-700 has-[:checked]:text-white"
              >
                <input
                  type="radio"
                  name="rol"
                  value={r.value}
                  defaultChecked={r.value === (state.values?.rol ?? "cliente")}
                  className="sr-only"
                />
                {r.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="nombre" className="label">Nombre</label>
          <input id="nombre" name="nombre" defaultValue={state.values?.nombre} required minLength={2} maxLength={80} autoComplete="name" className="input" />
        </div>

        <div>
          <label htmlFor="telefono" className="label">
            Teléfono <span className="font-normal text-stone-500">(opcional)</span>
          </label>
          <input
            id="telefono"
            name="telefono" defaultValue={state.values?.telefono}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="809-555-1234"
            className="input"
          />
        </div>

        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" defaultValue={state.values?.email} type="email" required autoComplete="email" className="input" />
        </div>

        <div>
          <label htmlFor="password" className="label">Contraseña</label>
          <PasswordInput
            id="password"
            name="password"
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            className="input"
          />
          <p className="mt-1 text-xs text-stone-500">Mínimo 8 caracteres, con letras y números.</p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="label">Confirmar contraseña</label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            className="input"
          />
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <SubmitButton />
      </form>

      <p className="text-center text-sm text-stone-500">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="link">
          Inicia sesión
        </Link>
      </p>
    </AuthShell>
  );
}
