import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

const PUBLIC_PATHS = ["/", "/login", "/register", "/carrito", "/forgot-password", "/privacidad"];

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/tiendas/") ||
    pathname.startsWith("/auth/") ||
    // AZUL devuelve al cliente aquí; la ruta verifica la firma por su cuenta.
    pathname.startsWith("/api/pagos/") ||
    // La llama la base de datos para enviar avisos; verifica su secreto.
    pathname.startsWith("/api/push/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  );
}

// Páginas del catálogo que no dependen del rol: solo se refresca la sesión,
// sin consultar perfil ni tienda/repartidor en cada request.
function isCatalogPath(pathname: string) {
  return (
    pathname.startsWith("/tiendas/") ||
    pathname === "/carrito" ||
    pathname === "/privacidad" ||
    pathname.startsWith("/auth/") ||
    pathname === "/forgot-password"
  );
}

/**
 * A dónde debe ir cada usuario según su rol y su estado de aprobación.
 * "rejected" indica una tienda/repartidor rechazado, que puede volver a
 * /complete-profile para corregir sus datos y reenviarlos.
 */
async function resolveHomePath(
  supabase: ReturnType<typeof createServerClient<Database>>,
  userId: string,
  rol: string
): Promise<{ home: string; rejected: boolean }> {
  if (rol === "cliente") return { home: "/", rejected: false };
  if (rol === "admin") return { home: "/admin", rejected: false };

  if (rol === "tienda") {
    const { data: store } = await supabase
      .from("stores")
      .select("estado")
      .eq("user_id", userId)
      .maybeSingle();

    if (!store) return { home: "/complete-profile/tienda", rejected: false };
    if (store.estado !== "aprobado") return { home: "/pending-approval", rejected: store.estado === "rechazado" };
    return { home: "/dashboard/tienda", rejected: false };
  }

  if (rol === "courier") {
    const { data: courier } = await supabase
      .from("couriers")
      .select("estado")
      .eq("user_id", userId)
      .maybeSingle();

    if (!courier) return { home: "/complete-profile/delivery", rejected: false };
    if (courier.estado !== "aprobado") {
      return { home: "/pending-approval", rejected: courier.estado === "rechazado" };
    }
    return { home: "/dashboard/delivery", rejected: false };
  }

  return { home: "/login", rejected: false };
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Sin sesión: solo puede ver páginas públicas.
  if (!user) {
    if (isPublicPath(pathname)) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (isCatalogPath(pathname)) return supabaseResponse;

  const { data: profile } = await supabase
    .from("users")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  // Sesión de auth sin fila en public.users (registro incompleto): fuera.
  if (!profile) {
    if (pathname === "/register" || pathname.startsWith("/auth/")) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/register";
    return NextResponse.redirect(url);
  }

  const rol = profile.rol;
  const { home, rejected } = await resolveHomePath(supabase, user.id, rol);

  // Ya autenticado: fuera de login/register, mándalo a su home. "/" es el
  // catálogo público y el home del cliente; solo sacamos de ahí a quien tiene
  // un panel propio (tienda/repartidor aprobados y admin). Una cuenta pendiente
  // o sin perfil puede ver el catálogo, así el botón "Inicio" nunca la deja
  // encerrada en su pantalla de solicitud.
  const hasPanel = home.startsWith("/dashboard/") || home === "/admin";
  if (pathname === "/login" || pathname === "/register" || (pathname === "/" && hasPanel)) {
    const url = request.nextUrl.clone();
    url.pathname = home;
    return NextResponse.redirect(url);
  }

  const needsRedirect =
    (pathname.startsWith("/dashboard/tienda") && home !== pathname && !home.startsWith("/dashboard/tienda")) ||
    (pathname.startsWith("/dashboard/delivery") && home !== pathname && !home.startsWith("/dashboard/delivery")) ||
    (pathname.startsWith("/admin") && rol !== "admin") ||
    (pathname.startsWith("/complete-profile/tienda") &&
      (rol !== "tienda" || (home !== "/complete-profile/tienda" && !rejected))) ||
    (pathname.startsWith("/complete-profile/delivery") &&
      (rol !== "courier" || (home !== "/complete-profile/delivery" && !rejected))) ||
    (pathname === "/pending-approval" && home !== "/pending-approval");

  if (needsRedirect) {
    const url = request.nextUrl.clone();
    url.pathname = home;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
