"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureUserProfile } from "@/lib/supabase/profile";
import { friendlyAuthError } from "@/lib/errors";
import type { UserRole } from "@/types/database";

export type AuthFormState = { error: string | null };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Teléfono dominicano: 10 dígitos que empiezan por 809/829/849, con o sin +1. Devuelve "8095551234" o null. */
function normalizeTelefono(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return /^(809|829|849)\d{7}$/.test(digits) ? digits : null;
}

/** Mínimo 8 caracteres con letras y números; máximo 72 (límite de bcrypt en Supabase Auth). */
function validatePassword(password: string) {
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (password.length > 72) return "La contraseña no puede tener más de 72 caracteres.";
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return "La contraseña debe incluir letras y números.";
  }
  return null;
}

export async function signUpAction(
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

  const supabase = createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre, telefono, rol } },
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

export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresa tu email y contraseña." };
  }

  const supabase = createClient();
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

  redirect("/");
}

export async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type ForgotPasswordState = { error: string | null; message: string | null };

export async function requestPasswordResetAction(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Escribe un email válido.", message: null };

  const supabase = createClient();
  const origin = headers().get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
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

  const supabase = createClient();
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
