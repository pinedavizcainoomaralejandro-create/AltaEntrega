import { describe, expect, it } from "vitest";
import { formatFecha } from "@/lib/format";

describe("formatFecha", () => {
  it("muestra la hora de República Dominicana sin importar la zona del servidor", () => {
    // 02:30 UTC del 29 = 10:30 p. m. del 28 en RD (UTC-4).
    expect(formatFecha("2026-09-29T02:30:00Z")).toMatch(/^28\/9\/2026, 10:30:00/);
  });
});
