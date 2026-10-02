"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { signOutAction } from "@/app/(auth)/actions";
import { CONTACTO_EMAIL } from "@/lib/contacto";
import {
  ChevronDownIcon,
  HelpIcon,
  KeyIcon,
  LogoutIcon,
  PencilIcon,
  ReceiptIcon,
  ShieldIcon,
  TrashIcon,
  UserIcon,
} from "@/components/ui/icons";

const ROL_LABEL: Record<string, string> = {
  cliente: "Cliente",
  tienda: "Negocio",
  courier: "Repartidor",
  admin: "Administrador",
};

const itemClass =
  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-stone-700 transition hover:bg-arena-100 focus:bg-arena-100 focus:outline-none";

/** Avatar del encabezado con el menú de la cuenta (perfil, credenciales, sesión...). */
export default function UserMenu({
  nombre,
  email,
  rol,
}: {
  nombre: string | null;
  email: string;
  rol: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  // Se cierra al tocar fuera o con Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);
  const inicial = (nombre ?? email).charAt(0).toUpperCase();
  // Tienda/repartidor: el proxy lleva /pending-approval a su pantalla real
  // (solicitud, perfil por completar o panel).
  const panelHref = rol === "admin" ? "/admin" : "/pending-approval";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Menú de mi cuenta"
        className="inline-flex items-center gap-1.5 rounded-xl px-1.5 py-1 text-sm font-medium text-stone-600 transition hover:bg-arena-200"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-monte-100 font-semibold text-monte-800">
          {inicial}
        </span>
        {nombre && <span className="hidden md:inline">{nombre.split(" ")[0]}</span>}
        <ChevronDownIcon className={`h-4 w-4 text-stone-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-stone-200 bg-white p-2 text-left shadow-xl"
        >
          <div className="flex items-center gap-3 px-3 py-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-monte-100 font-display text-lg font-semibold text-monte-800">
              {inicial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-stone-900">{nombre ?? email}</p>
              <p className="truncate text-xs text-stone-500">
                {email} · {ROL_LABEL[rol] ?? rol}
              </p>
            </div>
          </div>

          <hr className="my-1.5 border-stone-100" />

          {rol === "cliente" ? (
            <Link href="/pedidos" role="menuitem" onClick={close} className={itemClass}>
              <ReceiptIcon className="h-5 w-5 text-monte-700" />
              Mis pedidos
            </Link>
          ) : (
            <Link href={panelHref} role="menuitem" onClick={close} className={itemClass}>
              <UserIcon className="h-5 w-5 text-monte-700" />
              Mi panel
            </Link>
          )}
          <Link href="/cuenta" role="menuitem" onClick={close} className={itemClass}>
            <UserIcon className="h-5 w-5 text-monte-700" />
            Mi cuenta
          </Link>
          <Link href="/cuenta/perfil" role="menuitem" onClick={close} className={itemClass}>
            <PencilIcon className="h-5 w-5 text-monte-700" />
            Editar perfil
          </Link>
          <Link href="/cuenta/credenciales" role="menuitem" onClick={close} className={itemClass}>
            <KeyIcon className="h-5 w-5 text-monte-700" />
            Email y contraseña
          </Link>
          <Link href="/privacidad" role="menuitem" onClick={close} className={itemClass}>
            <ShieldIcon className="h-5 w-5 text-monte-700" />
            Privacidad
          </Link>
          <a
            href={`mailto:${CONTACTO_EMAIL}?subject=${encodeURIComponent("Ayuda con AltaEntrega")}`}
            role="menuitem"
            onClick={close}
            className={itemClass}
          >
            <HelpIcon className="h-5 w-5 text-monte-700" />
            Ayuda y soporte
          </a>

          <hr className="my-1.5 border-stone-100" />

          <form action={signOutAction}>
            <button type="submit" role="menuitem" className={itemClass}>
              <LogoutIcon className="h-5 w-5 text-stone-500" />
              Cerrar sesión
            </button>
          </form>
          <Link
            href="/cuenta/eliminar"
            role="menuitem"
            onClick={close}
            className={`${itemClass} text-red-600 hover:bg-red-50 focus:bg-red-50`}
          >
            <TrashIcon className="h-5 w-5" />
            Eliminar mi cuenta
          </Link>
        </div>
      )}
    </div>
  );
}
