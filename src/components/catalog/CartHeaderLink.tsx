"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart/CartContext";
import { BagIcon } from "@/components/ui/icons";

export default function CartHeaderLink() {
  const { count } = useCart();
  return (
    <Link
      href="/carrito"
      className="relative inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-stone-700 transition hover:bg-arena-200"
      aria-label={count > 0 ? `Carrito, ${count} productos` : "Carrito"}
    >
      <BagIcon />
      <span className="hidden sm:inline">Carrito</span>
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-sol-500 px-1 text-[11px] font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
