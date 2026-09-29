import { describe, expect, it } from "vitest";
import {
  EMAIL_RE,
  escapeLike,
  isValidMatricula,
  normalizeCedula,
  normalizeMatricula,
  normalizeTelefono,
  quotePostgrestValue,
  safeNextPath,
  validatePassword,
} from "@/lib/validation";

describe("normalizeTelefono", () => {
  it("acepta números dominicanos con o sin formato y con +1", () => {
    expect(normalizeTelefono("809-555-1234")).toBe("8095551234");
    expect(normalizeTelefono("+1 (829) 555 1234")).toBe("8295551234");
    expect(normalizeTelefono("8495551234")).toBe("8495551234");
  });

  it("rechaza otros códigos de área y números incompletos", () => {
    expect(normalizeTelefono("305-555-1234")).toBeNull();
    expect(normalizeTelefono("555-1234")).toBeNull();
  });
});

describe("validatePassword", () => {
  it("exige 8 caracteres, letras y números", () => {
    expect(validatePassword("abc12")).toMatch(/8 caracteres/);
    expect(validatePassword("abcdefgh")).toMatch(/letras y números/);
    expect(validatePassword("12345678")).toMatch(/letras y números/);
    expect(validatePassword("abcdefg1")).toBeNull();
  });

  it("rechaza más de 72 caracteres", () => {
    expect(validatePassword("a1".repeat(37))).toMatch(/72/);
  });
});

describe("EMAIL_RE", () => {
  it("valida el formato básico", () => {
    expect(EMAIL_RE.test("ana@correo.com")).toBe(true);
    expect(EMAIL_RE.test("ana@correo")).toBe(false);
    expect(EMAIL_RE.test("ana maria@correo.com")).toBe(false);
  });
});

describe("cédula y matrícula", () => {
  it("normaliza la cédula a dígitos", () => {
    expect(normalizeCedula("001-1234567-8")).toBe("00112345678");
  });

  it("normaliza y valida la matrícula", () => {
    expect(normalizeMatricula(" k 123456 ")).toBe("K123456");
    expect(isValidMatricula("K123456")).toBe(true);
    expect(isValidMatricula("K1")).toBe(false);
    expect(isValidMatricula("K12<script>")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("solo permite rutas internas", () => {
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
    expect(safeNextPath(null)).toBe("/");
    for (const evil of ["@evil.com", "//evil.com", "/\\evil.com", "https://evil.com"]) {
      expect(safeNextPath(evil)).toBe("/");
    }
  });
});

describe("búsqueda", () => {
  it("escapa comodines de ilike", () => {
    expect(escapeLike("100%_off")).toBe("100\\%\\_off");
  });

  it("pone entre comillas los valores para .or()", () => {
    expect(quotePostgrestValue('%ropa, "niños"%')).toBe('"%ropa, \\"niños\\"%"');
  });
});
