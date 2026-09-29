"use client";

import { useState, type InputHTMLAttributes } from "react";

/** Campo de contraseña con botón "Mostrar"/"Ocultar" dentro del campo. */
export default function PasswordInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${className} pr-20`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-stone-600 underline"
      >
        {visible ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}
