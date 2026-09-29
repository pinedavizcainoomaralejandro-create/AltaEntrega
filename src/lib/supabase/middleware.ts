import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

const PUBLIC_PATHS = ["/", "/login", "/register", "/carrito", "/forgot-password"];

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/tiendas/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  );
}

/** A dónde debe ir cada usuario según su rol y su estado de aprobación. */
async function resolveHomePath(
  supabase: ReturnType<typeof createServerClient<Database>>,
  userId: string,
  rol: string
) {
  if (rol === "cliente") return "/";
  if (rol === "admin") return "/admin";

  if (rol === "tienda") {
    const { data: store } = await supabase
      .from("stores")
      .select("estado")
      .eq("user_id", userId)
      .maybeSingle();

    if (!store) return "/complete-profile/tienda";
    if (store.estado !== "aprobado") return "/pending-approval";
    return "/dashboard/tienda";
  }

  if (rol === "courier") {
    const { data: courier } = await supabase
      .from("couriers")
      .select("estado")
      .eq("user_id", userId)
      .maybeSingle();

    if (!courier) return "/complete-profile/delivery";
    if (courier.estado !== "aprobado") return "/pending-approval";
    return "/dashboard/delivery";
  }

  return "/login";
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
  const home = await resolveHomePath(supabase, user.id, rol);

  // Ya autenticado: fuera de login/register, mándalo a su home. "/" es el
  // catálogo público y es el home del cliente, así que solo lo sacamos de ahí
  // si su rol no es cliente (tienda/courier/admin tienen su propio dashboard).
  if (pathname === "/login" || pathname === "/register" || (pathname === "/" && home !== "/")) {
    const url = request.nextUrl.clone();
    url.pathname = home;
    return NextResponse.redirect(url);
  }

  const needsRedirect =
    (pathname.startsWith("/dashboard/tienda") && home !== pathname && !home.startsWith("/dashboard/tienda")) ||
    (pathname.startsWith("/dashboard/delivery") && home !== pathname && !home.startsWith("/dashboard/delivery")) ||
    (pathname.startsWith("/admin") && rol !== "admin") ||
    (pathname.startsWith("/complete-profile/tienda") && (rol !== "tienda" || home !== "/complete-profile/tienda")) ||
    (pathname.startsWith("/complete-profile/delivery") && (rol !== "courier" || home !== "/complete-profile/delivery")) ||
    (pathname === "/pending-approval" && home !== "/pending-approval");

  if (needsRedirect) {
    const url = request.nextUrl.clone();
    url.pathname = home;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
