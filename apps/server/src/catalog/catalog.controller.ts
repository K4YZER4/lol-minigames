import { Controller, Get, Inject, Param, Res } from "@nestjs/common";
import { ContentService } from "../content/content.service";

/**
 * Lo mínimo que usamos de la respuesta HTTP. Evita depender de los tipos de
 * Express y funciona igual con cualquier adaptador.
 */
type ImageResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: Buffer): void;
};

@Controller("api")
export class CatalogController {
  constructor(@Inject(ContentService) private readonly content: ContentService) {}

  @Get("health")
  health() {
    return { ok: true, version: this.content.meta.version };
  }

  /**
   * Catálogo público: solo id, nombre e imagen.
   * Las pistas (clueId -> championId) se quedan en el servidor.
   */
  @Get("champions")
  champions() {
    return this.content.champions.map((champion) => ({
      id: champion.id,
      name: champion.name,
      imageUrl: champion.imageUrl,
    }));
  }

  @Get("avatars")
  avatars() {
    return this.content.avatars;
  }

  /**
   * Proxy de la imagen de una pista. La URL de Data Dragon contiene el nombre
   * del campeón, así que nunca se expone al cliente: solo el clueId.
   */
  @Get("clues/:clueId/image")
  async clueImage(
    @Param("clueId") clueId: string,
    @Res() res: ImageResponse,
  ): Promise<void> {
    try {
      const image = await this.content.clueImage(clueId);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=86400, immutable");
      res.setHeader("Content-Length", String(image.length));
      res.end(image);
    } catch {
      res.statusCode = 404;
      res.end();
    }
  }
}
