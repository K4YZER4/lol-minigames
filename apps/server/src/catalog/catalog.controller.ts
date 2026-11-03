import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Query,
  Res,
} from "@nestjs/common";
import { MODE_IDS, type ModeId } from "@lolgames/protocol";
import { ContentService } from "../content/content.service";
import { RoomService } from "../rooms/room.service";

/**
 * Lo mínimo que usamos de la respuesta HTTP. Evita depender de los tipos de
 * Express y funciona igual con cualquier adaptador.
 */
type ImageResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: Buffer): void;
};
type AudioResponse = ImageResponse;

@Controller("api")
export class CatalogController {
  constructor(
    @Inject(ContentService) private readonly content: ContentService,
    @Inject(RoomService) private readonly rooms: RoomService,
  ) {}

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

  @Get("dev/test-room")
  async devTestRoom(@Query("mode") mode = "pictionary", @Query("players") players = "3") {
    if (process.env.NODE_ENV === "production") {
      throw new NotFoundException();
    }
    const selected = MODE_IDS.includes(mode as ModeId) ? (mode as ModeId) : "pictionary";
    const count = Math.max(3, Math.min(12, Number.parseInt(players, 10) || 3));
    const result = await this.rooms.createDevTestRoom(selected, count);
    const query = new URLSearchParams({
      devToken: result.token,
      devPlayerId: result.playerId,
      devNickname: result.nickname,
    }).toString();
    const hostPath = `/room/${result.roomCode}?${query}`;
    return {
      ok: true,
      mode: selected,
      players: count,
      roomCode: result.roomCode,
      hostPath,
      hostUrl: `http://localhost:3000${hostPath}`,
      note: "Abre hostUrl (o hostPath en este mismo origen) para entrar como anfitrión. Los demás jugadores fake ya están listos.",
    };
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

  /** Audio proxy: el id opaco no contiene el campeón ni el nombre del archivo. */
  @Get("audio-clues/:clueId")
  audioClue(@Param("clueId") clueId: string, @Res() res: AudioResponse): void {
    const audio = this.content.audioClip(clueId);
    if (!audio) {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.setHeader("Content-Type", audio.contentType);
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    res.setHeader("Content-Length", String(audio.body.length));
    res.end(audio.body);
  }
}
