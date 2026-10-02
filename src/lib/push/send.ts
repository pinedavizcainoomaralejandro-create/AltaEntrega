import "server-only";
import { createSign, sign } from "node:crypto";
import { connect, type ClientHttp2Session } from "node:http2";
import { apnsPayload, base64url, fcmMessage, type PushContent, type PushTarget } from "./messages";

/**
 * Entrega de avisos push. Android usa Firebase Cloud Messaging (API HTTP v1)
 * y iOS usa APNs directamente, así la app de iOS no necesita el SDK de
 * Firebase. Cada plataforma se activa con sus variables de entorno; sin ellas
 * sus avisos se omiten.
 *
 * Android: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *   (de la cuenta de servicio de Firebase; no el JSON entero, para no pasar
 *   el límite de 4 KB de variables de las funciones de Netlify).
 * iOS: APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY (la clave .p8),
 *   APNS_BUNDLE_ID (por defecto com.altaentrega.app) y APNS_ENV
 *   ("sandbox" para builds de desarrollo; por defecto "production").
 */

export type SendResult = { sent: number; failed: number; invalidTokens: string[] };

/** Las claves pegadas en Netlify suelen llegar con "\n" literales. */
function pem(raw: string) {
  return raw.replace(/\\n/g, "\n");
}

// ── Firebase ──────────────────────────────────────────────────

let googleToken: { value: string; expires: number } | null = null;

async function googleAccessToken() {
  if (googleToken && googleToken.expires > Date.now() + 60_000) return googleToken.value;

  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(
    JSON.stringify({
      iss: process.env.FIREBASE_CLIENT_EMAIL,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  )}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(pem(process.env.FIREBASE_PRIVATE_KEY!));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${base64url(signature)}`,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Google OAuth ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  googleToken = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function sendAndroid(tokens: string[], content: PushContent, result: SendResult) {
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.info(`[push] Sin configuración de Firebase, se omiten ${tokens.length} avisos de Android`);
    return;
  }
  const accessToken = await googleAccessToken();
  const endpoint = `https://fcm.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/messages:send`;

  await Promise.all(
    tokens.map(async (token) => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(fcmMessage(token, content)),
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          result.sent++;
          return;
        }
        result.failed++;
        const text = await res.text();
        // 404 / UNREGISTERED: la app se desinstaló o el token cambió.
        if (res.status === 404 || text.includes("UNREGISTERED")) result.invalidTokens.push(token);
        else console.error("[push] FCM", res.status, text);
      } catch (error) {
        result.failed++;
        console.error("[push] FCM", error);
      }
    })
  );
}

// ── APNs ──────────────────────────────────────────────────────

let apnsJwt: { value: string; created: number } | null = null;

// Apple pide renovar el token entre 20 y 60 minutos.
function apnsToken() {
  if (apnsJwt && Date.now() - apnsJwt.created < 40 * 60_000) return apnsJwt.value;
  const unsigned = `${base64url(JSON.stringify({ alg: "ES256", kid: process.env.APNS_KEY_ID }))}.${base64url(
    JSON.stringify({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) })
  )}`;
  const signature = sign("sha256", Buffer.from(unsigned), {
    key: pem(process.env.APNS_PRIVATE_KEY!),
    dsaEncoding: "ieee-p1363",
  });
  apnsJwt = { value: `${unsigned}.${base64url(signature)}`, created: Date.now() };
  return apnsJwt.value;
}

function apnsRequest(session: ClientHttp2Session, token: string, body: string) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = session.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${apnsToken()}`,
      "apns-topic": process.env.APNS_BUNDLE_ID ?? "com.altaentrega.app",
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });
    let status = 0;
    let data = "";
    req.setTimeout(8000, () => req.close());
    req.on("response", (headers) => (status = Number(headers[":status"])));
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve({ status, body: data }));
    req.on("error", reject);
    req.end(body);
  });
}

async function sendIos(tokens: string[], content: PushContent, result: SendResult) {
  if (!process.env.APNS_KEY_ID || !process.env.APNS_TEAM_ID || !process.env.APNS_PRIVATE_KEY) {
    console.info(`[push] Sin configuración de APNs, se omiten ${tokens.length} avisos de iOS`);
    return;
  }
  const host = process.env.APNS_ENV === "sandbox" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  const session = connect(host);
  session.on("error", (error) => console.error("[push] APNs", error));
  const body = JSON.stringify(apnsPayload(content));

  try {
    await Promise.all(
      tokens.map(async (token) => {
        try {
          const res = await apnsRequest(session, token, body);
          if (res.status === 200) {
            result.sent++;
            return;
          }
          result.failed++;
          // 410: la app se desinstaló. BadDeviceToken: token de otro entorno o inválido.
          if (res.status === 410 || res.body.includes("BadDeviceToken")) result.invalidTokens.push(token);
          else console.error("[push] APNs", res.status, res.body);
        } catch (error) {
          result.failed++;
          console.error("[push] APNs", error);
        }
      })
    );
  } finally {
    session.close();
  }
}

export async function sendPush(targets: PushTarget[], content: PushContent): Promise<SendResult> {
  const result: SendResult = { sent: 0, failed: 0, invalidTokens: [] };
  const android = targets.filter((t) => t.platform === "android").map((t) => t.token);
  const ios = targets.filter((t) => t.platform === "ios").map((t) => t.token);

  await Promise.all([
    android.length ? sendAndroid(android, content, result).catch((e) => console.error("[push] Android", e)) : null,
    ios.length ? sendIos(ios, content, result).catch((e) => console.error("[push] iOS", e)) : null,
  ]);
  return result;
}
