"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { createClient } from "@/lib/supabase/client";
import { ANDROID_CHANNEL_ID } from "@/lib/push/messages";
import { rememberPushToken } from "@/lib/push/client";

/**
 * Apps Android e iOS: con la sesión iniciada pide permiso para avisar, registra
 * el token del teléfono en push_tokens y, al tocar un aviso, abre su pantalla.
 *
 * Solo corre con NEXT_PUBLIC_PUSH_ENABLED=true: en Android, registrar sin el
 * google-services.json de Firebase cierra la app, así que se activa cuando las
 * apps publicadas ya lo incluyen.
 */
export default function PushRegistration() {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_PUSH_ENABLED !== "true") return;
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("PushNotifications")) return;

    const supabase = createClient();
    const platform = Capacitor.getPlatform() as "android" | "ios";
    let registered = false;

    const listeners = [
      PushNotifications.addListener("registration", async ({ value }) => {
        const { error } = await supabase.rpc("register_push_token", { p_token: value, p_platform: platform });
        if (error) console.error("[push] register_push_token", error);
        else rememberPushToken(value);
      }),
      PushNotifications.addListener("registrationError", (error) => console.error("[push] registro", error)),
      PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
        const url = (notification.data as { url?: unknown } | undefined)?.url;
        if (typeof url === "string" && url.startsWith("/") && !url.startsWith("//")) router.push(url);
      }),
    ];

    async function register() {
      if (registered) return;
      registered = true;
      if (platform === "android") {
        await PushNotifications.createChannel({
          id: ANDROID_CHANNEL_ID,
          name: "Pedidos",
          description: "Pedidos nuevos, cambios de estado y solicitudes",
          importance: 4,
          sound: "default",
        });
      }
      let { receive } = await PushNotifications.checkPermissions();
      if (receive === "prompt" || receive === "prompt-with-rationale") {
        ({ receive } = await PushNotifications.requestPermissions());
      }
      if (receive === "granted") await PushNotifications.register();
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) register().catch((error) => console.error("[push]", error));
      else registered = false;
    });

    return () => {
      data.subscription.unsubscribe();
      listeners.forEach((l) => l.then((handle) => handle.remove()));
    };
  }, [router]);

  return null;
}
