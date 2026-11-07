import type { IncomingHttpHeaders } from "node:http";
import { BlockList, isIP } from "node:net";

/**
 * Rangos oficiales de Cloudflare.
 * Fuente: https://www.cloudflare.com/ips-v4 y https://www.cloudflare.com/ips-v6
 * Solo se usan para decidir si el salto inmediato es Cloudflare.
 */
const CLOUDFLARE_RANGES: ReadonlyArray<readonly [string, number, "ipv4" | "ipv6"]> = [
  ["173.245.48.0", 20, "ipv4"],
  ["103.21.244.0", 22, "ipv4"],
  ["103.22.200.0", 22, "ipv4"],
  ["103.31.4.0", 22, "ipv4"],
  ["141.101.64.0", 18, "ipv4"],
  ["108.162.192.0", 18, "ipv4"],
  ["190.93.240.0", 20, "ipv4"],
  ["188.114.96.0", 20, "ipv4"],
  ["197.234.240.0", 22, "ipv4"],
  ["198.41.128.0", 17, "ipv4"],
  ["162.158.0.0", 15, "ipv4"],
  ["104.16.0.0", 13, "ipv4"],
  ["104.24.0.0", 14, "ipv4"],
  ["172.64.0.0", 13, "ipv4"],
  ["131.0.72.0", 22, "ipv4"],
  ["2400:cb00::", 32, "ipv6"],
  ["2606:4700::", 32, "ipv6"],
  ["2803:f800::", 32, "ipv6"],
  ["2405:b500::", 32, "ipv6"],
  ["2405:8100::", 32, "ipv6"],
  ["2a06:98c0::", 29, "ipv6"],
  ["2c0f:f248::", 32, "ipv6"],
];

const cloudflare = new BlockList();
for (const [network, prefix, type] of CLOUDFLARE_RANGES) {
  cloudflare.addSubnet(network, prefix, type);
}

/** Normaliza direcciones IPv4 mapeadas en IPv6 (::ffff:1.2.3.4). */
export function normalizeIp(value: string): string {
  const ip = value.trim().replace(/^\[|\]$/g, "");
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return mapped ? mapped[1] : ip;
}

/** true solo si la IP pertenece a un rango oficial de Cloudflare. */
export function isCloudflareIp(value: string | undefined | null): boolean {
  if (!value) return false;
  const ip = normalizeIp(value);
  const family = isIP(ip);
  if (family === 4) return cloudflare.check(ip, "ipv4");
  if (family === 6) return cloudflare.check(ip, "ipv6");
  return false;
}

/** Only trust forwarded headers when the app is reachable exclusively through the configured proxy. */
export function clientIp(remote: string, forwarded: IncomingHttpHeaders["x-forwarded-for"], hops: number): string {
  if (hops === 0 || typeof forwarded !== "string") return remote;
  const chain = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
  return chain[chain.length - hops] ?? remote;
}

/**
 * IP real del cliente.
 * CF-Connecting-IP solo se acepta cuando el salto inmediato (el último de
 * X-Forwarded-For) pertenece a Cloudflare. Si alguien llega directo al origen
 * y falsifica la cabecera, se usa la cadena X-Forwarded-For validada.
 */
export function resolveClientIp(remote: string, headers: IncomingHttpHeaders, hops: number): string {
  const forwarded = headers["x-forwarded-for"];
  const chain = typeof forwarded === "string"
    ? forwarded.split(",").map((part) => part.trim()).filter(Boolean)
    : [];
  const edgeIp = chain.length ? chain[chain.length - 1] : remote;
  const cfHeader = headers["cf-connecting-ip"];
  const cfIp = typeof cfHeader === "string" ? normalizeIp(cfHeader) : "";
  if (cfIp && isIP(cfIp) !== 0 && isCloudflareIp(edgeIp)) return cfIp;
  return clientIp(remote, forwarded, hops);
}

export function allowedOrigins(value: string | undefined, production: boolean): string[] {
  if (production && !value?.trim()) throw new Error("WEB_ORIGIN es obligatorio en producción");
  const origins = (value ?? "http://localhost:3000,http://127.0.0.1:3000")
    .split(",").map((origin) => origin.trim()).filter(Boolean);
  if (!origins.length || origins.some((origin) => {
    try {
      const url = new URL(origin);
      return !["http:", "https:"].includes(url.protocol) || url.origin !== origin;
    } catch {
      return true;
    }
  })) throw new Error("WEB_ORIGIN debe contener orígenes HTTP(S) exactos, separados por comas");
  return origins;
}

export function proxyHops(value: string | undefined): number {
  const hops = value === undefined ? 0 : Number(value);
  if (!Number.isSafeInteger(hops) || hops < 0 || hops > 5) {
    throw new Error("TRUST_PROXY_HOPS debe ser un entero entre 0 y 5");
  }
  return hops;
}

/**
 * En producción el servidor vive detrás de Render + Cloudflare (2 saltos).
 * En local no hay proxy, así que se usa 0 salvo configuración explícita.
 */
export function resolveProxyHops(value: string | undefined, production: boolean): number {
  if (value === undefined || value.trim() === "") return production ? 2 : 0;
  return proxyHops(value);
}

export function originAllowed(origin: string | undefined, origins: string[], production: boolean): boolean {
  return origin ? origins.includes(origin) : !production;
}
