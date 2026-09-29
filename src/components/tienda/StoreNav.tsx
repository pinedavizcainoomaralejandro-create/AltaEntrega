"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/tienda/pedidos", label: "Pedidos" },
  { href: "/dashboard/tienda/productos", label: "Productos" },
  { href: "/dashboard/tienda/cobros", label: "Cobros" },
  { href: "/dashboard/tienda/perfil", label: "Perfil de la tienda" },
];

/** Pestañas del panel de tienda, con la sección actual marcada. */
export default function StoreNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-8 flex gap-1 overflow-x-auto rounded-2xl bg-arena-200 p-1 text-sm font-medium">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`whitespace-nowrap rounded-xl px-4 py-2 transition ${
              active ? "bg-white text-monte-800 shadow-sm" : "text-stone-600 hover:text-stone-900"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
