import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Integración con la Página de Pagos de AZUL (Banco Popular Dominicano).
 *
 * Flujo: el navegador del cliente envía un formulario firmado a AZUL; el
 * cliente paga en la página de AZUL; AZUL lo devuelve a ApprovedUrl,
 * DeclinedUrl o CancelUrl con el resultado firmado, que verificamos aquí.
 *
 * IMPORTANTE: los nombres de campos, el orden de concatenación del AuthHash,
 * la codificación y las URLs siguen la guía de integración de la Página de
 * Pagos de AZUL. AZUL entrega la versión vigente de esa guía y las
 * credenciales de pruebas al afiliar el comercio: antes de pasar a
 * producción, compara cada punto marcado con "VERIFICAR" contra esa guía y
 * haz un pago de prueba completo en el ambiente de pruebas.
 *
 * Modos (variable AZUL_MODE):
 *   - "simulado":   sin AZUL; la app muestra un pago simulado. Solo desarrollo.
 *   - "pruebas":    ambiente de pruebas de AZUL, con credenciales de pruebas.
 *   - "produccion": cobros reales.
 */

export type PaymentMode = "simulado" | "pruebas" | "produccion";

// VERIFICAR: URLs de la Página de Pagos según la guía de AZUL.
const AZUL_URLS: Record<Exclude<PaymentMode, "simulado">, string> = {
  pruebas: "https://pruebas.azul.com.do/PaymentPage/",
  produccion: "https://pagos.azul.com.do/PaymentPage/Default.aspx",
};

export const AZUL_FORM_ORIGINS = ["https://pruebas.azul.com.do", "https://pagos.azul.com.do"];

export function getPaymentMode(): PaymentMode {
  const mode = process.env.AZUL_MODE ?? "simulado";
  if (mode !== "simulado" && mode !== "pruebas" && mode !== "produccion") {
    throw new Error(`AZUL_MODE inválido: "${mode}". Usa simulado, pruebas o produccion.`);
  }
  if (mode === "simulado" && process.env.NODE_ENV === "production" && process.env.ALLOW_SIMULATED_PAYMENTS !== "true") {
    throw new Error("El pago simulado está deshabilitado en producción. Configura AZUL_MODE=pruebas o produccion.");
  }
  return mode;
}

function azulConfig() {
  const merchantId = process.env.AZUL_MERCHANT_ID;
  const merchantName = process.env.AZUL_MERCHANT_NAME;
  const merchantType = process.env.AZUL_MERCHANT_TYPE;
  const authKey = process.env.AZUL_AUTH_KEY;
  if (!merchantId || !merchantName || !merchantType || !authKey) {
    throw new Error("Faltan credenciales de AZUL (AZUL_MERCHANT_ID, AZUL_MERCHANT_NAME, AZUL_MERCHANT_TYPE, AZUL_AUTH_KEY).");
  }
  return { merchantId, merchantName, merchantType, authKey };
}

// VERIFICAR: AZUL firma con HMAC-SHA512, usando el AuthKey como llave, sobre
// la concatenación de los valores (sin separadores) más el AuthKey al final,
// codificada en UTF-16LE, y el resultado en hexadecimal.
function hmac(values: string[], authKey: string) {
  return createHmac("sha512", Buffer.from(authKey, "utf16le"))
    .update(Buffer.from(values.join("") + authKey, "utf16le"))
    .digest("hex");
}

function safeEqualHex(a: string, b: string) {
  const bufA = Buffer.from(a.toLowerCase());
  const bufB = Buffer.from(b.toLowerCase());
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/** Monto en centavos sin separadores, como lo espera AZUL: 1,050.00 -> "105000". */
export function toCentavos(amount: number) {
  return String(Math.round(amount * 100));
}

export interface AzulPaymentForm {
  action: string;
  fields: Record<string, string>;
}

/** Campos firmados del formulario que el navegador envía a AZUL. */
export function buildAzulPaymentForm(params: {
  mode: Exclude<PaymentMode, "simulado">;
  orderNumber: string;
  total: number;
  siteUrl: string;
  orderId: string;
}): AzulPaymentForm {
  const { merchantId, merchantName, merchantType, authKey } = azulConfig();
  const returnUrl = `${params.siteUrl}/api/pagos/azul?pedido=${params.orderId}`;

  // VERIFICAR: nombres y orden de campos del formulario y del AuthHash.
  const fields: Record<string, string> = {
    MerchantId: merchantId,
    MerchantName: merchantName,
    MerchantType: merchantType,
    CurrencyCode: "$",
    OrderNumber: params.orderNumber,
    Amount: toCentavos(params.total),
    ITBIS: "000",
    ApprovedUrl: `${returnUrl}&resultado=aprobado`,
    DeclinedUrl: `${returnUrl}&resultado=rechazado`,
    CancelUrl: `${returnUrl}&resultado=cancelado`,
    UseCustomField1: "0",
    CustomField1Label: "",
    CustomField1Value: "",
    UseCustomField2: "0",
    CustomField2Label: "",
    CustomField2Value: "",
  };

  const hashOrder = [
    "MerchantId",
    "MerchantName",
    "MerchantType",
    "CurrencyCode",
    "OrderNumber",
    "Amount",
    "ITBIS",
    "ApprovedUrl",
    "DeclinedUrl",
    "CancelUrl",
    "UseCustomField1",
    "CustomField1Label",
    "CustomField1Value",
    "UseCustomField2",
    "CustomField2Label",
    "CustomField2Value",
  ];

  fields.AuthHash = hmac(
    hashOrder.map((k) => fields[k]),
    authKey
  );

  return { action: AZUL_URLS[params.mode], fields: { ...fields, ShowTransactionResult: "0", Locale: "ES" } };
}

export interface AzulResult {
  approved: boolean;
  orderNumber: string;
  amountCentavos: number;
  authorizationCode: string;
  rrn: string;
  message: string;
}

/**
 * Verifica la respuesta que AZUL manda al volver a nuestra URL. Devuelve null
 * si la firma no es válida (respuesta falsificada o alterada).
 */
export function verifyAzulResponse(query: URLSearchParams): AzulResult | null {
  const { authKey } = azulConfig();
  const get = (k: string) => query.get(k) ?? "";

  // VERIFICAR: campos y orden del AuthHash de la respuesta.
  const expected = hmac(
    [
      get("OrderNumber"),
      get("Amount"),
      get("AuthorizationCode"),
      get("DateTime"),
      get("ResponseCode"),
      get("IsoCode"),
      get("ResponseMessage"),
      get("ErrorDescription"),
      get("RRN"),
    ],
    authKey
  );

  if (!get("AuthHash") || !safeEqualHex(expected, get("AuthHash"))) return null;

  return {
    // VERIFICAR: aprobada = ResponseCode "ISO8583" con IsoCode "00".
    approved: get("ResponseCode") === "ISO8583" && get("IsoCode") === "00",
    orderNumber: get("OrderNumber"),
    amountCentavos: Number(get("Amount")),
    authorizationCode: get("AuthorizationCode"),
    rrn: get("RRN"),
    message: get("ResponseMessage") || get("ErrorDescription"),
  };
}
