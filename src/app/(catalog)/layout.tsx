import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CartProvider } from "@/lib/cart/CartContext";
import CartHeaderLink from "@/components/catalog/CartHeaderLink";
import Logo from "@/components/brand/Logo";
import { LogoutIcon, ReceiptIcon, UserIcon } from "@/components/ui/icons";
import { signOutAction } from "@/app/(auth)/actions";

export default async function CatalogLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let nombre: string | null = null;
  let rol: string | null = null;
  if (user) {
    const { data: profile } = await supabase.from("users").select("nombre, rol").eq("id", user.id).maybeSingle();
    nombre = profile?.nombre ?? null;
    rol = profile?.rol ?? null;
  }

  // Solo los clientes (o visitantes, que inician sesión al pagar) compran.
  const canBuy = !user || rol === "cliente";
  // Tienda/repartidor: el proxy lleva /pending-approval a su pantalla real
  // (solicitud, perfil por completar o panel).
  const cuentaHref = rol === "admin" ? "/admin" : "/pending-approval";

  return (
    <CartProvider canBuy={canBuy}>
      <div className="flex min-h-safe-screen flex-col">
        <header className="sticky top-[env(safe-area-inset-top)] z-40 border-b border-stone-200/70 bg-arena-50/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Logo />
            <nav className="flex items-center gap-1 text-sm font-medium sm:gap-2">
              <Link href="/" className="hidden rounded-xl px-2.5 py-2 text-stone-700 transition hover:bg-arena-200 sm:inline">
                Inicio
              </Link>
              {canBuy && <CartHeaderLink />}
              {user ? (
                <>
                  <Link
                    href={canBuy ? "/pedidos" : cuentaHref}
                    className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-stone-700 transition hover:bg-arena-200"
                  >
                    {canBuy ? <ReceiptIcon /> : <UserIcon />}
                    <span className="hidden sm:inline">{canBuy ? "Mis pedidos" : "Mi cuenta"}</span>
                  </Link>
                  {nombre && (
                    <span className="hidden items-center gap-2 pl-2 text-stone-500 md:inline-flex">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-monte-100 font-semibold text-monte-800">
                        {nombre.charAt(0).toUpperCase()}
                      </span>
                      {nombre.split(" ")[0]}
                    </span>
                  )}
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-xl px-2.5 py-2 text-stone-500 transition hover:bg-arena-200 hover:text-stone-800"
                      aria-label="Cerrar sesión"
                      title="Cerrar sesión"
                    >
                      <LogoutIcon />
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="rounded-xl px-3 py-2 text-stone-700 transition hover:bg-arena-200">
                    Ingresar
                  </Link>
                  <Link href="/register" className="btn-primary btn-sm hidden whitespace-nowrap py-2 sm:inline-flex">
                    Crear cuenta
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
        <footer className="mt-16 border-t border-stone-200 bg-monte-950 text-monte-100">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <Logo tone="light" />
              <p className="mt-3 max-w-sm text-sm text-monte-200">
                Restaurantes, empanadas, café, pan, dulces y ropa de Villa Altagracia, con pago seguro y delivery local.
              </p>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <Link href="/register" className="hover:text-white">
                ¿Tienes un negocio? Vende aquí
              </Link>
              <Link href="/register" className="hover:text-white">
                Trabaja como repartidor
              </Link>
            </div>
          </div>
          <p className="border-t border-white/10 py-4 text-center text-xs text-monte-300">
            © {new Date().getFullYear()} AltaEntrega · Hecho en Villa Altagracia, República Dominicana
          </p>
        </footer>
      </div>
    </CartProvider>
  );
}
