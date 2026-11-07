import { describe, expect, it } from "vitest";
import {
  allowedOrigins,
  clientIp,
  isCloudflareIp,
  normalizeIp,
  originAllowed,
  proxyHops,
  resolveClientIp,
  resolveProxyHops,
} from "./security";

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

  it("usa 2 saltos en producción y 0 en local por defecto", () => {
    expect(resolveProxyHops(undefined, true)).toBe(2);
    expect(resolveProxyHops(undefined, false)).toBe(0);
    expect(resolveProxyHops("", true)).toBe(2);
    expect(resolveProxyHops("1", true)).toBe(1);
    expect(resolveProxyHops("0", true)).toBe(0);
    expect(() => resolveProxyHops("-1", true)).toThrow("TRUST_PROXY_HOPS");
  });
});

describe("IP de Cloudflare", () => {
  it("reconoce rangos oficiales IPv4 e IPv6", () => {
    expect(isCloudflareIp("173.245.48.5")).toBe(true);
    expect(isCloudflareIp("104.16.0.1")).toBe(true);
    expect(isCloudflareIp("2606:4700::1")).toBe(true);
    expect(isCloudflareIp("::ffff:173.245.48.5")).toBe(true);
  });

  it("rechaza IPs ajenas o inválidas", () => {
    expect(isCloudflareIp("8.8.8.8")).toBe(false);
    expect(isCloudflareIp("2606:4701::1")).toBe(false);
    expect(isCloudflareIp("no-es-una-ip")).toBe(false);
    expect(isCloudflareIp(undefined)).toBe(false);
  });

  it("normaliza IPv4 mapeadas en IPv6", () => {
    expect(normalizeIp("::ffff:1.2.3.4")).toBe("1.2.3.4");
    expect(normalizeIp("[2606:4700::1]")).toBe("2606:4700::1");
  });
});

describe("IP real del cliente con Cloudflare", () => {
  it("acepta CF-Connecting-IP si el salto inmediato es Cloudflare", () => {
    expect(resolveClientIp("10.0.0.1", {
      "x-forwarded-for": "1.2.3.4, 173.245.48.10",
      "cf-connecting-ip": "1.2.3.4",
    }, 2)).toBe("1.2.3.4");
    expect(resolveClientIp("10.0.0.1", {
      "x-forwarded-for": "1.2.3.4, 2606:4700::1",
      "cf-connecting-ip": "1.2.3.4",
    }, 2)).toBe("1.2.3.4");
  });

  it("ignora CF-Connecting-IP si el salto inmediato no es Cloudflare", () => {
    expect(resolveClientIp("10.0.0.1", {
      "x-forwarded-for": "6.6.6.6, 8.8.8.8",
      "cf-connecting-ip": "1.2.3.4",
    }, 1)).toBe("8.8.8.8");
  });

  it("ignora CF-Connecting-IP en conexiones directas al origen", () => {
    expect(resolveClientIp("203.0.113.9", {
      "cf-connecting-ip": "1.2.3.4",
    }, 2)).toBe("203.0.113.9");
  });

  it("ignora CF-Connecting-IP inválida y usa la cadena validada", () => {
    expect(resolveClientIp("10.0.0.1", {
      "x-forwarded-for": "1.2.3.4, 173.245.48.10",
      "cf-connecting-ip": "no-es-una-ip",
    }, 1)).toBe("173.245.48.10");
  });
});
