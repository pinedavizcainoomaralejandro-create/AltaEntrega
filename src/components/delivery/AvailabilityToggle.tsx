"use client";

import { useState, useTransition } from "react";
import { toggleAvailabilityAction } from "@/app/dashboard/delivery/actions";

export default function AvailabilityToggle({
  courierId,
  initialDisponible,
}: {
  courierId: string;
  initialDisponible: boolean;
}) {
  const [disponible, setDisponible] = useState(initialDisponible);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const next = !disponible;
          setDisponible(next);
          setError(null);
          startTransition(async () => {
            try {
              const result = await toggleAvailabilityAction(courierId, next);
              if (result.error) {
                setDisponible(!next);
                setError(result.error);
              }
            } catch {
              // Sin conexión o sesión expirada: la acción ni siquiera respondió.
              setDisponible(!next);
              setError("No se pudo cambiar tu disponibilidad. Revisa tu conexión.");
            }
          });
        }}
        className={`rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
          disponible ? "bg-monte-600 text-white" : "bg-stone-200 text-stone-700"
        }`}
      >
        {disponible ? "● Disponible" : "○ No disponible"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
