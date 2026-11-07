import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { loadContent } from "@lolgames/content";
import { AppModule } from "./app.module";
import { allowedOrigins, resolveProxyHops } from "./gateway/security";

async function bootstrap() {
  const content = loadContent();
  const app = await NestFactory.create(AppModule);
  const origins = allowedOrigins(process.env.WEB_ORIGIN, process.env.NODE_ENV === "production");
  const hops = resolveProxyHops(process.env.TRUST_PROXY_HOPS, process.env.NODE_ENV === "production");
  if (hops) app.getHttpAdapter().getInstance().set("trust proxy", hops);
  app.enableCors({ origin: origins, credentials: false });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, "0.0.0.0");

  console.log(
    `[server] Data Dragon ${content.meta.version} · ${content.champions.length} campeones · ${content.clues.length} pistas`,
  );
  console.log(`[server] escuchando en http://localhost:${port}`);
}

bootstrap().catch((error) => {
  console.error("[server] no pudo arrancar:", error);
  process.exit(1);
});
