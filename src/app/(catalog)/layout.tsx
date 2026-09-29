import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CartProvider } from "@/lib/cart/CartContext";
import CartHeaderLink from "@/components/catalog/CartHeaderLink";
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
      <div className="min-h-screen">
        <header className="border-b border-neutral-200">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-semibold">
              AltaEntrega
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/" className="underline">
                Inicio
              </Link>
              {canBuy && <CartHeaderLink />}
              {user ? (
                <>
                  {canBuy ? (
                    <Link href="/pedidos" className="underline">
                      Mis pedidos
                    </Link>
                  ) : (
                    <Link href={cuentaHref} className="underline">
                      Mi cuenta
                    </Link>
                  )}
                  {nombre && <span className="text-neutral-500">Hola, {nombre}</span>}
                  <form action={signOutAction}>
                    <button type="submit" className="underline">
                      Cerrar sesión
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="underline">
                    Ingresar
                  </Link>
                  <Link href="/register" className="underline">
                    Crear cuenta
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </div>
    </CartProvider>
  );
}
