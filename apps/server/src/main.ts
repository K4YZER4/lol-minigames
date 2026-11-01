import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { loadContent } from "@lolgames/content";
import { AppModule } from "./app.module";

async function bootstrap() {
  const content = loadContent();
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });

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
