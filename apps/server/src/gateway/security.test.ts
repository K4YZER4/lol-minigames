import { describe, expect, it } from "vitest";
import { allowedOrigins, clientIp, originAllowed, proxyHops } from "./security";

describe("configuración de origen y proxy", () => {
  it("requiere orígenes explícitos en producción y rechaza comodines/rutas", () => {
    expect(() => allowedOrigins(undefined, true)).toThrow("WEB_ORIGIN");
    expect(() => allowedOrigins("*", true)).toThrow("WEB_ORIGIN");
    expect(() => allowedOrigins("https://example.com/path", true)).toThrow("WEB_ORIGIN");
    expect(allowedOrigins("https://example.com, https://www.example.com", true)).toEqual([
      "https://example.com", "https://www.example.com",
    ]);
  });

  it("rechaza orígenes ajenos y conexiones sin Origin en producción", () => {
    expect(originAllowed("https://example.com", ["https://example.com"], true)).toBe(true);
    expect(originAllowed("https://evil.com", ["https://example.com"], true)).toBe(false);
    expect(originAllowed(undefined, ["https://example.com"], true)).toBe(false);
    expect(originAllowed(undefined, ["http://localhost:3000"], false)).toBe(true);
  });

  it("no acepta cabeceras de IP sin proxy confiado y selecciona desde la derecha", () => {
    expect(clientIp("10.0.0.1", "1.2.3.4, 10.0.0.2", 0)).toBe("10.0.0.1");
    expect(clientIp("10.0.0.1", "6.6.6.6, 1.2.3.4", 1)).toBe("1.2.3.4");
    expect(clientIp("10.0.0.1", "1.2.3.4", 2)).toBe("10.0.0.1");
    expect(() => proxyHops("-1")).toThrow("TRUST_PROXY_HOPS");
  });
});
