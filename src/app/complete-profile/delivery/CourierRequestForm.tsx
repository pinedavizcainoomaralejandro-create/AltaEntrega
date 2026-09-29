"use client";

import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import { createCourierProfileAction, type ProfileFormState } from "../actions";
import AuthShell from "@/components/brand/AuthShell";

const initialState: ProfileFormState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary w-full"
    >
      {pending ? "Enviando..." : "Enviar para aprobación"}
    </button>
  );
}

export type CourierRequestInitial = { vehiculo: string; documento_identidad: string; matricula: string } | null;

export default function CourierRequestForm({ initial }: { initial: CourierRequestInitial }) {
  const [state, formAction] = useActionState(createCourierProfileAction, initialState);

  return (
    <AuthShell
      title={initial ? "Corrige tus datos de repartidor" : "Únete como repartidor"}
      subtitle="Verificamos tu identidad con tu cédula y la matrícula de tu vehículo. Cada documento y matrícula solo puede usarse en una cuenta."
    >
      {initial && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Tu solicitud fue rechazada. Revisa los datos y envíala de nuevo.
        </p>
      )}

      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <label htmlFor="vehiculo" className="label">Vehículo</label>
          <input id="vehiculo" name="vehiculo" required maxLength={60} defaultValue={state.values?.vehiculo ?? initial?.vehiculo} placeholder="Motocicleta, bicicleta, carro..." className="input" />
        </div>

        <div>
          <label htmlFor="documento_identidad" className="label">Cédula</label>
          <input
            id="documento_identidad"
            name="documento_identidad"
            required
            defaultValue={state.values?.documento_identidad ?? initial?.documento_identidad}
            placeholder="000-0000000-0"
            className="input"
          />
        </div>

        <div>
          <label htmlFor="matricula" className="label">Matrícula del vehículo</label>
          <input
            id="matricula"
            name="matricula"
            required
            defaultValue={state.values?.matricula ?? initial?.matricula}
            placeholder="Matrícula/placa"
            className="input"
          />
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <SubmitButton />
      </form>
    </AuthShell>
  );
}
