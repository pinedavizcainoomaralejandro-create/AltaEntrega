import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { buildAzulPaymentForm, toCentavos, verifyAzulResponse } from "@/lib/payments/azul";

const AUTH_KEY = "llave-de-prueba";

function sign(values: string[]) {
  return createHmac("sha512", Buffer.from(AUTH_KEY, "utf16le"))
    .update(Buffer.from(values.join("") + AUTH_KEY, "utf16le"))
    .digest("hex");
}

function azulResponse(overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    OrderNumber: "42",
    Amount: "17100",
    AuthorizationCode: "OK1234",
    DateTime: "20260929120000",
    ResponseCode: "ISO8583",
    IsoCode: "00",
    ResponseMessage: "APROBADA",
    ErrorDescription: "",
    RRN: "000123",
    ...overrides,
  };
  fields.AuthHash = sign([
    fields.OrderNumber,
    fields.Amount,
    fields.AuthorizationCode,
    fields.DateTime,
    fields.ResponseCode,
    fields.IsoCode,
    fields.ResponseMessage,
    fields.ErrorDescription,
    fields.RRN,
  ]);
  return new URLSearchParams(fields);
}

beforeEach(() => {
  process.env.AZUL_MERCHANT_ID = "39038540035";
  process.env.AZUL_MERCHANT_NAME = "AltaEntrega";
  process.env.AZUL_MERCHANT_TYPE = "ECommerce";
  process.env.AZUL_AUTH_KEY = AUTH_KEY;
});

describe("toCentavos", () => {
  it("convierte a centavos sin decimales", () => {
    expect(toCentavos(1050)).toBe("105000");
    expect(toCentavos(171)).toBe("17100");
    expect(toCentavos(10.5)).toBe("1050");
  });
});

describe("buildAzulPaymentForm", () => {
  it("firma el formulario y apunta al ambiente elegido", () => {
    const form = buildAzulPaymentForm({
      mode: "pruebas",
      orderNumber: "42",
      total: 171,
      siteUrl: "https://altaentrega.do",
      orderId: "00000000-0000-0000-0000-000000000001",
    });
    expect(form.action).toContain("pruebas.azul.com.do");
    expect(form.fields.Amount).toBe("17100");
    expect(form.fields.ApprovedUrl).toBe(
      "https://altaentrega.do/api/pagos/azul?pedido=00000000-0000-0000-0000-000000000001&resultado=aprobado"
    );
    expect(form.fields.AuthHash).toMatch(/^[0-9a-f]{128}$/);
    expect(JSON.stringify(form.fields)).not.toContain(AUTH_KEY);
  });
});

describe("verifyAzulResponse", () => {
  it("acepta una respuesta aprobada con firma válida", () => {
    expect(verifyAzulResponse(azulResponse())).toMatchObject({
      approved: true,
      orderNumber: "42",
      amountCentavos: 17100,
      authorizationCode: "OK1234",
      rrn: "000123",
    });
  });

  it("marca como no aprobada una respuesta rechazada", () => {
    expect(verifyAzulResponse(azulResponse({ IsoCode: "51", ResponseMessage: "DECLINADA" }))?.approved).toBe(false);
  });

  it("rechaza respuestas alteradas o sin firma", () => {
    const tampered = azulResponse();
    tampered.set("Amount", "100");
    expect(verifyAzulResponse(tampered)).toBeNull();

    const unsigned = azulResponse();
    unsigned.delete("AuthHash");
    expect(verifyAzulResponse(unsigned)).toBeNull();
  });
});
