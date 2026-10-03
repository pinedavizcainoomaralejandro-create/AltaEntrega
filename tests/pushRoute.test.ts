import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendPush = vi.fn();
const deleteIn = vi.fn();

vi.mock("@/lib/push/send", () => ({ sendPush }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ delete: () => ({ in: deleteIn }) }) }),
}));

const { POST } = await import("@/app/api/push/send/route");

const SECRET = "s".repeat(64);
const body = {
  tokens: [{ token: "abc", platform: "android" }],
  title: "Nuevo pedido",
  body: "Pedido AE-1",
  url: "/dashboard/tienda/pedidos",
};

function request(payload: unknown, secret?: string) {
  return new Request("https://altaentrega.netlify.app/api/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(secret ? { "x-push-secret": secret } : {}) },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

describe("POST /api/push/send", () => {
  beforeEach(() => {
    vi.stubEnv("PUSH_WEBHOOK_SECRET", SECRET);
    sendPush.mockResolvedValue({ sent: 1, failed: 0, invalidTokens: [] });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    sendPush.mockReset();
    deleteIn.mockReset();
  });

  it("rechaza sin secreto, con uno falso o si el servidor no tiene uno", async () => {
    expect((await POST(request(body))).status).toBe(401);
    expect((await POST(request(body, "falso"))).status).toBe(401);
    expect((await POST(request(body, "x".repeat(64)))).status).toBe(401);

    vi.stubEnv("PUSH_WEBHOOK_SECRET", "");
    expect((await POST(request(body, ""))).status).toBe(401);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("rechaza cuerpos inválidos", async () => {
    expect((await POST(request("no es json", SECRET))).status).toBe(400);
    expect((await POST(request({ ...body, tokens: [] }, SECRET))).status).toBe(400);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("envía el aviso y responde cuántos salieron", async () => {
    const res = await POST(request(body, SECRET));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 1, failed: 0 });
    expect(sendPush).toHaveBeenCalledWith(body.tokens, {
      title: "Nuevo pedido",
      body: "Pedido AE-1",
      url: "/dashboard/tienda/pedidos",
    });
    expect(deleteIn).not.toHaveBeenCalled();
  });

  it("borra los tokens de apps desinstaladas", async () => {
    sendPush.mockResolvedValue({ sent: 0, failed: 1, invalidTokens: ["abc"] });
    await POST(request(body, SECRET));
    expect(deleteIn).toHaveBeenCalledWith("token", ["abc"]);
  });
});
