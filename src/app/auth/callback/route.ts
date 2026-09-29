import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUserProfile } from "@/lib/supabase/profile";

// Supabase redirige aquí tras confirmar el correo o al recuperar contraseña
// (magic link / verificación de email / password recovery).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Solo rutas internas: "next" viene de la URL y un valor como "@evil.com" o
  // "//evil.com" convertiría este endpoint en una redirección abierta.
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\") ? rawNext : "/";

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      return NextResponse.redirect(`${origin}/login?link_error=1`);
    }
    await ensureUserProfile(supabase, data.user);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
