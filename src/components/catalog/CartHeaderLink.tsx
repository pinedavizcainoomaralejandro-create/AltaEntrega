"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart/CartContext";

export default function CartHeaderLink() {
  const { count } = useCart();
  return (
    <Link href="/carrito" className="underline">
      Carrito{count > 0 ? ` (${count})` : ""}
    </Link>
  );
}
