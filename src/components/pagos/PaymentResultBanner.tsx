"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart/CartContext";

const MESSAGES: Record<string, { text: string; tone: "ok" | "warn" | "error" }> = {
  aprobado: { text: "¡Pago aprobado! Tu pedido fue enviado a la tienda.", tone: "ok" },
  rechazado: { text: "El pago fue rechazado y el pedido se canceló. Tu carrito sigue guardado para intentarlo de nuevo.", tone: "error" },
  cancelado: { text: "Cancelaste el pago y el pedido se canceló. Tu carrito sigue guardado.", tone: "warn" },
  reembolso: {
    text: "Tu pago llegó después de que el pedido expirara. Te devolveremos el dinero; contacta a soporte si tienes dudas.",
    tone: "warn",
  },
  error: {
    text: "No pudimos confirmar el resultado del pago. Si se te cobró, contacta a soporte con el número de tu pedido.",
    tone: "error",
  },
};

const TONES = {
  ok: "bg-green-50 text-green-800",
  warn: "bg-amber-50 text-amber-800",
  error: "bg-red-50 text-red-700",
};

/** Mensaje al volver del pago. Con el pago aprobado, vacía el carrito. */
export default function PaymentResultBanner({ pago }: { pago: string | undefined }) {
  const { clear, hydrated } = useCart();

  useEffect(() => {
    if (pago === "aprobado" && hydrated) clear();
  }, [pago, hydrated, clear]);

  const message = pago ? MESSAGES[pago] : undefined;
  if (!message) return null;

  return <p className={`mb-4 rounded-md p-3 text-sm ${TONES[message.tone]}`}>{message.text}</p>;
}
