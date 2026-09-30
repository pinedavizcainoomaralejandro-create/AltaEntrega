"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart/CartContext";

const MESSAGES: Record<string, { text: string; tone: "ok" | "warn" | "error" }> = {
  aprobado: { text: "¡Pago aprobado! Tu pedido fue enviado a la tienda.", tone: "ok" },
  comprobante: {
    text: "¡Listo! Enviamos tu comprobante al negocio. Cuando confirme tu transferencia, empieza a preparar tu pedido.",
    tone: "ok",
  },
  rechazado: { text: "El pago fue rechazado y el pedido se canceló. Tu carrito sigue guardado para intentarlo de nuevo.", tone: "error" },
  cancelado: {
    text: "Cancelaste el pago. Tu pedido sigue reservado 30 minutos: puedes completar el pago o cancelarlo abajo.",
    tone: "warn",
  },
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

/**
 * Mensaje al volver del pago. Con el pago aprobado vacía el carrito una sola
 * vez: después quita ?pago= de la URL, para que volver a esta página (historial,
 * recarga o marcador) no borre un carrito nuevo.
 */
export default function PaymentResultBanner({ pago }: { pago: string | undefined }) {
  const { clear, hydrated } = useCart();

  useEffect(() => {
    if (!pago || !hydrated) return;
    if (pago === "aprobado" || pago === "comprobante") clear();
    const url = new URL(window.location.href);
    url.searchParams.delete("pago");
    window.history.replaceState(window.history.state, "", url);
  }, [pago, hydrated, clear]);

  const message = pago ? MESSAGES[pago] : undefined;
  if (!message) return null;

  return <p className={`mb-4 rounded-md p-3 text-sm ${TONES[message.tone]}`}>{message.text}</p>;
}
