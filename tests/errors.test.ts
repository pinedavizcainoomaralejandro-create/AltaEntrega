import { beforeEach, describe, expect, it, vi } from "vitest";
import { friendlyAuthError, friendlyDbError } from "@/lib/errors";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("friendlyDbError", () => {
  it("muestra tal cual los mensajes de las funciones SQL", () => {
    expect(friendlyDbError({ code: "P0001", message: "Este pedido ya fue tomado" })).toBe("Este pedido ya fue tomado");
  });

  it("traduce errores técnicos y usa el mensaje por defecto", () => {
    expect(friendlyDbError({ code: "42501", message: "permission denied" })).toMatch(/permiso/);
    expect(friendlyDbError({ code: "XX000", message: "deadlock detected" }, "Falló")).toBe("Falló");
    expect(friendlyDbError({ message: "TypeError: Failed to fetch" })).toMatch(/conexión/);
  });
});

describe("friendlyAuthError", () => {
  it("traduce los códigos de Supabase Auth", () => {
    expect(friendlyAuthError({ code: "user_already_exists", message: "User already registered" })).toMatch(
      /Ya existe una cuenta/
    );
    expect(friendlyAuthError({ code: "over_email_send_rate_limit", message: "" })).toMatch(/Demasiados intentos/);
  });
});
