import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUserProfile } from "@/lib/supabase/profile";
import { safeNextPath } from "@/lib/validation";

// Supabase redirige aquí tras confirmar el correo o al recuperar contraseña
// (magic link / verificación de email / password recovery).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      return NextResponse.redirect(`${origin}/login?link_error=1`);
    }
    await ensureUserProfile(supabase, data.user);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
