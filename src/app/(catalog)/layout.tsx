import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CartProvider } from "@/lib/cart/CartContext";
import CartHeaderLink from "@/components/catalog/CartHeaderLink";
import { signOutAction } from "@/app/(auth)/actions";

export default async function CatalogLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let nombre: string | null = null;
  if (user) {
    const { data: profile } = await supabase.from("users").select("nombre").eq("id", user.id).maybeSingle();
    nombre = profile?.nombre ?? null;
  }

  return (
    <CartProvider>
      <div className="min-h-screen">
        <header className="border-b border-neutral-200">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-semibold">
              AltaEntrega
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <CartHeaderLink />
              {user ? (
                <>
                  <Link href="/pedidos" className="underline">
                    Mis pedidos
                  </Link>
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
