import Link from "next/link";

/**
 * Enlace "Inicio" presente en todas las pantallas. Apunta a "/" y el
 * middleware lleva a cada rol a su propio inicio: el catálogo para clientes,
 * visitantes y cuentas por aprobar, y su panel para tiendas, repartidores y
 * administradores aprobados.
 */
export default function HomeLink({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-1 text-sm font-medium underline ${className}`}>
      <span aria-hidden>←</span> Inicio
    </Link>
  );
}
