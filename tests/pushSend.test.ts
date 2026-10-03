import { generateKeyPairSync, verify } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
const ec = generateKeyPairSync("ec", { namedCurve: "P-256" });
const rsaPem = rsa.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const ecPem = ec.privateKey.export({ type: "pkcs8", format: "pem" }).toString();

function decode(part: string) {
  return JSON.parse(Buffer.from(part, "base64url").toString());
}

// send.ts guarda en memoria el token de Google: cada prueba carga el módulo de cero.
async function loadSend() {
  vi.resetModules();
  return import("@/lib/push/send");
}

describe("googleAssertion", () => {
  it("firma con RS256 los datos que pide Google", async () => {
    const { googleAssertion } = await loadSend();
    const jwt = googleAssertion("push@altaentrega.iam.gserviceaccount.com", rsaPem, 1_000);
    const [header, claims, signature] = jwt.split(".");

    expect(decode(header)).toEqual({ alg: "RS256", typ: "JWT" });
    expect(decode(claims)).toEqual({
      iss: "push@altaentrega.iam.gserviceaccount.com",
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: 1_000,
      exp: 4_600,
    });
    expect(verify("RSA-SHA256", Buffer.from(`${header}.${claims}`), rsa.publicKey, Buffer.from(signature, "base64url"))).toBe(true);
  });

  it("acepta la clave con \\n literales, como queda al pegarla en Netlify", async () => {
    const { googleAssertion } = await loadSend();
    const pegada = rsaPem.replace(/\n/g, "\\n");
    const [header, claims, signature] = googleAssertion("a@b.com", pegada, 1).split(".");
    expect(verify("RSA-SHA256", Buffer.from(`${header}.${claims}`), rsa.publicKey, Buffer.from(signature, "base64url"))).toBe(true);
  });
});

describe("apnsProviderToken", () => {
  it("firma con ES256 en el formato que pide Apple", async () => {
    const { apnsProviderToken } = await loadSend();
    const [header, claims, signature] = apnsProviderToken("KEY123", "TEAM456", ecPem, 2_000).split(".");

    expect(decode(header)).toEqual({ alg: "ES256", kid: "KEY123" });
    expect(decode(claims)).toEqual({ iss: "TEAM456", iat: 2_000 });
    // ES256 de JWT: firma de 64 bytes (r||s), no DER.
    const raw = Buffer.from(signature, "base64url");
    expect(raw).toHaveLength(64);
    expect(
      verify("sha256", Buffer.from(`${header}.${claims}`), { key: ec.publicKey, dsaEncoding: "ieee-p1363" }, raw)
    ).toBe(true);
  });
});

describe("sendPush", () => {
  const content = { title: "Nuevo pedido", body: "Pedido AE-1", url: "/dashboard/tienda/pedidos" };
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it("sin configuración de Firebase no llama a nadie", async () => {
    const { sendPush } = await loadSend();
    const result = await sendPush([{ token: "a", platform: "android" }], content);
    expect(result).toEqual({ sent: 0, failed: 0, invalidTokens: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sin configuración de APNs omite los avisos de iOS", async () => {
    const { sendPush } = await loadSend();
    const result = await sendPush([{ token: "a", platform: "ios" }], content);
    expect(result).toEqual({ sent: 0, failed: 0, invalidTokens: [] });
  });

  it("Android: pide un token a Google una vez, envía a cada teléfono y separa los tokens muertos", async () => {
    vi.stubEnv("FIREBASE_PROJECT_ID", "altaentrega-test");
    vi.stubEnv("FIREBASE_CLIENT_EMAIL", "push@altaentrega.iam.gserviceaccount.com");
    vi.stubEnv("FIREBASE_PRIVATE_KEY", rsaPem);

    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url === "https://oauth2.googleapis.com/token") {
        return Response.json({ access_token: "ya29.token", expires_in: 3600 });
      }
      const { message } = JSON.parse(String(init.body));
      if (message.token === "vivo") return Response.json({ name: "ok" });
      if (message.token === "desinstalado") {
        return Response.json({ error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } }, { status: 404 });
      }
      return new Response("falla de Google", { status: 500 });
    });

    const { sendPush } = await loadSend();
    const result = await sendPush(
      [
        { token: "vivo", platform: "android" },
        { token: "desinstalado", platform: "android" },
        { token: "error", platform: "android" },
      ],
      content
    );

    expect(result).toEqual({ sent: 1, failed: 2, invalidTokens: ["desinstalado"] });

    const calls = fetchMock.mock.calls as [string, RequestInit][];
    expect(calls.filter(([url]) => url.includes("oauth2")).length).toBe(1);
    const fcm = calls.filter(([url]) => url.includes("fcm.googleapis.com"));
    expect(fcm).toHaveLength(3);
    expect(fcm[0][0]).toBe("https://fcm.googleapis.com/v1/projects/altaentrega-test/messages:send");
    expect((fcm[0][1].headers as Record<string, string>).Authorization).toBe("Bearer ya29.token");
  });

  it("si Google no da el token de acceso, no se cae: no envía nada", async () => {
    vi.stubEnv("FIREBASE_PROJECT_ID", "p");
    vi.stubEnv("FIREBASE_CLIENT_EMAIL", "a@b.com");
    vi.stubEnv("FIREBASE_PRIVATE_KEY", rsaPem);
    fetchMock.mockResolvedValue(new Response("invalid_grant", { status: 400 }));

    const { sendPush } = await loadSend();
    const result = await sendPush([{ token: "a", platform: "android" }], content);
    expect(result).toEqual({ sent: 0, failed: 0, invalidTokens: [] });
  });
});
