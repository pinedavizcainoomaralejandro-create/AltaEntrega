/**
 * Mensajes push para Firebase (Android) y APNs (iOS). Funciones puras, sin
 * red, para poder probarlas; el envío está en src/lib/push/send.ts.
 */

export type PushPlatform = "android" | "ios";
export type PushTarget = { token: string; platform: PushPlatform };
export type PushContent = { title: string; body: string; url: string };

/** Canal de Android de los avisos (lo crea la app en PushRegistration). */
export const ANDROID_CHANNEL_ID = "pedidos";

/** Lo que manda la base de datos (private.send_push) a /api/push/send. */
export function parsePushRequest(input: unknown): (PushContent & { tokens: PushTarget[] }) | null {
  if (!input || typeof input !== "object") return null;
  const { tokens, title, body, url } = input as Record<string, unknown>;
  if (typeof title !== "string" || typeof body !== "string" || typeof url !== "string") return null;
  if (!Array.isArray(tokens) || tokens.length === 0 || tokens.length > 500) return null;

  const targets: PushTarget[] = [];
  for (const t of tokens) {
    const { token, platform } = (t ?? {}) as Record<string, unknown>;
    if (typeof token !== "string" || !token) return null;
    if (platform !== "android" && platform !== "ios") return null;
    targets.push({ token, platform });
  }
  // Solo rutas internas: la app navega a esta URL al tocar el aviso.
  const safeUrl = url.startsWith("/") && !url.startsWith("//") ? url : "/";
  return { tokens: targets, title: title.slice(0, 120), body: body.slice(0, 500), url: safeUrl };
}

/** Cuerpo de messages:send de la API HTTP v1 de Firebase Cloud Messaging. */
export function fcmMessage(token: string, content: PushContent) {
  return {
    message: {
      token,
      notification: { title: content.title, body: content.body },
      data: { url: content.url },
      android: { priority: "HIGH", notification: { channel_id: ANDROID_CHANNEL_ID, sound: "default" } },
    },
  };
}

/** Payload de APNs. "url" va fuera de "aps" y llega a la app como dato. */
export function apnsPayload(content: PushContent) {
  return {
    aps: { alert: { title: content.title, body: content.body }, sound: "default" },
    url: content.url,
  };
}

export function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}
