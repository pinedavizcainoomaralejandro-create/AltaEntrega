"use server";

import { attachValues, type FormValues } from "@/lib/formValues";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureUserProfile } from "@/lib/supabase/profile";
import { friendlyAuthError } from "@/lib/errors";
import { EMAIL_RE, normalizeTelefono, safeNextPath, validatePassword } from "@/lib/validation";
import type { UserRole } from "@/types/database";

export type AuthFormState = { error: string | null } & FormValues;


// La URL de los enlaces de correo sale de la configuración, no del header
// Origin (que manda el navegador y un atacante puede cambiar). Sin
// NEXT_PUBLIC_SITE_URL se usa el origen de la petición, solo aceptable en desarrollo.
async function siteOrigin() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "http://localhost:3000";
}

async function signUpInner(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim().replace(/\s+/g, " ");
  const telefonoRaw = String(formData.get("telefono") ?? "").trim();
  const rol = String(formData.get("rol") ?? "") as UserRole;

  if (!["cliente", "tienda", "courier"].includes(rol)) {
    return { error: "Selecciona si te registras como Cliente, Tienda o Delivery." };
  }
  if (nombre.length < 2 || nombre.length > 80) {
    return { error: "Escribe tu nombre (entre 2 y 80 caracteres)." };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: "Escribe un email válido, por ejemplo nombre@correo.com." };
  }

  let telefono: string | null = null;
  if (telefonoRaw) {
    telefono = normalizeTelefono(telefonoRaw);
    if (!telefono) {
      return { error: "El teléfono debe ser dominicano de 10 dígitos (809, 829 u 849), por ejemplo 809-555-1234." };
    }
  }

  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };
  if (password !== confirmPassword) return { error: "Las contraseñas no coinciden." };

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Sin esto el enlace del correo usa el Site URL de Supabase, que puede
    // seguir apuntando a localhost.
    options: { data: { nombre, telefono, rol }, emailRedirectTo: `${await siteOrigin()}/auth/callback` },
  });

  if (error) return { error: friendlyAuthError(error) };
  if (!data.user) return { error: "No se pudo crear la cuenta. Inténtalo de nuevo." };

  if (data.session) {
    // Confirmación de email deshabilitada: ya hay sesión, creamos el perfil ahora.
    const profileError = await ensureUserProfile(supabase, data.user);
    if (profileError) {
      return {
        error:
          "Tu cuenta se creó, pero no pudimos guardar tu perfil. Inicia sesión de nuevo para terminar el registro.",
      };
    }
  } else {
    // Falta confirmar el correo; el perfil se crea en /auth/callback.
    redirect("/login?check_email=1");
  }

  redirect("/");
}

async function loginInner(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresa tu email y contraseña." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Confirma tu correo antes de iniciar sesión (revisa tu bandeja de entrada)." };
    }
    if (error.code === "invalid_credentials") return { error: "Email o contraseña incorrectos." };
    return { error: friendlyAuthError(error) };
  }

  // Si el enlace de confirmación expiró antes de completarse, la cuenta de Auth
  // existe pero puede faltar la fila en public.users: la creamos aquí como
  // respaldo, usando los datos guardados en el signUp original.
  if (data.user) await ensureUserProfile(supabase, data.user);

  // Vuelve a la página que pidió antes de iniciar sesión (solo rutas internas).
  // Si su rol no puede verla, el proxy lo lleva a su inicio.
  redirect(safeNextPath(String(formData.get("redirect") ?? "") || null));
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type ForgotPasswordState = { error: string | null; message: string | null } & FormValues;

async function requestPasswordResetInner(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Escribe un email válido.", message: null };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/reset-password`,
  });

  // Mismo mensaje exista o no la cuenta, para no revelar qué emails están registrados.
  return {
    error: null,
    message: "Si ese correo tiene una cuenta, te enviamos un enlace para restablecer tu contraseña.",
  };
}

export type ResetPasswordState = { error: string | null };

export async function updatePasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };
  if (password !== confirmPassword) return { error: "Las contraseñas no coinciden." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "El enlace expiró o no es válido. Solicita uno nuevo desde \"Olvidé mi contraseña\"." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: friendlyAuthError(error) };

  redirect("/");
}

export async function signUpAction(
  prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  return attachValues(await signUpInner(prevState, formData), formData, ["nombre", "telefono", "email", "rol"]);
}

export async function loginAction(
  prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  return attachValues(await loginInner(prevState, formData), formData, ["email"]);
}

export async function requestPasswordResetAction(
  prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  return attachValues(await requestPasswordResetInner(prevState, formData), formData, ["email"]);
}
