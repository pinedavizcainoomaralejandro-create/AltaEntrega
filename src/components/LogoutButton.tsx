"use client";

import { signOutAction } from "@/app/(auth)/actions";
import { unregisterPushToken } from "@/lib/push/client";

/** Cierra la sesión; en las apps, antes deja de enviar avisos a este teléfono. */
export default function LogoutButton(props: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type">) {
  async function logout() {
    await unregisterPushToken();
    await signOutAction();
  }

  return (
    <form action={logout}>
      <button type="submit" {...props} />
    </form>
  );
}
