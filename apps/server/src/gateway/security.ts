import type { IncomingHttpHeaders } from "node:http";

/** Only trust forwarded headers when the app is reachable exclusively through the configured proxy. */
export function clientIp(remote: string, forwarded: IncomingHttpHeaders["x-forwarded-for"], hops: number): string {
  if (hops === 0 || typeof forwarded !== "string") return remote;
  const chain = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
  return chain[chain.length - hops] ?? remote;
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

export function originAllowed(origin: string | undefined, origins: string[], production: boolean): boolean {
  return origin ? origins.includes(origin) : !production;
}
