import { describe, expect, it } from "vitest";
import { apnsPayload, fcmMessage, parsePushRequest } from "@/lib/push/messages";

const valido = {
  tokens: [
    { token: "abc", platform: "android" },
    { token: "def", platform: "ios" },
  ],
  title: "Nuevo pedido",
  body: "Pedido AE-1 por RD$100.00.",
  url: "/dashboard/tienda/pedidos",
};

describe("parsePushRequest", () => {
  it("acepta lo que envía private.send_push", () => {
    expect(parsePushRequest(valido)).toEqual(valido);
  });

  it("rechaza plataformas, tokens o campos inválidos", () => {
    expect(parsePushRequest(null)).toBeNull();
    expect(parsePushRequest({ ...valido, tokens: [] })).toBeNull();
    expect(parsePushRequest({ ...valido, tokens: [{ token: "abc", platform: "web" }] })).toBeNull();
    expect(parsePushRequest({ ...valido, tokens: [{ token: "", platform: "ios" }] })).toBeNull();
    expect(parsePushRequest({ ...valido, title: 5 })).toBeNull();
  });

  it("solo deja abrir rutas internas", () => {
    expect(parsePushRequest({ ...valido, url: "https://evil.com" })?.url).toBe("/");
    expect(parsePushRequest({ ...valido, url: "//evil.com" })?.url).toBe("/");
  });
});

describe("mensajes", () => {
  const content = { title: "Hola", body: "Mundo", url: "/pedidos/1" };

  it("FCM usa el canal de pedidos y manda la URL como dato", () => {
    expect(fcmMessage("tok", content)).toEqual({
      message: {
        token: "tok",
        notification: { title: "Hola", body: "Mundo" },
        data: { url: "/pedidos/1" },
        android: { priority: "HIGH", notification: { channel_id: "pedidos", sound: "default" } },
      },
    });
  });

  it("APNs pone la URL fuera de aps", () => {
    expect(apnsPayload(content)).toEqual({
      aps: { alert: { title: "Hola", body: "Mundo" }, sound: "default" },
      url: "/pedidos/1",
    });
  });
});
