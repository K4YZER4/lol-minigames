import type { NextConfig } from "next";

/**
 * `next dev` y `next build` no pueden compartir el mismo directorio de salida:
 * si se compila mientras el dev server está vivo, los chunks se mezclan y el
 * navegador falla con "Cannot read properties of undefined (reading 'call')".
 * En desarrollo usamos `.next`; en producción, `.next-build`.
 */
const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  distDir: isProduction ? ".next-build" : ".next",
  // Permite abrir el servidor de desarrollo desde túneles temporales.
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok-free.app", "*.trycloudflare.com"],
};

export default nextConfig;
