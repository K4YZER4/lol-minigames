import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  loadContent,
  type ContentBundle,
  type ContentClue,
  type ContentPair,
  type PublicChampion,
} from "@lolgames/content";

const PUBLIC_BASE =
  process.env.PUBLIC_BASE_URL ??
  `http://localhost:${process.env.PORT ?? 3001}`;

const IMAGE_CACHE_LIMIT = 600;
const AUDIO_ROOT_CANDIDATES = [
  resolve(process.cwd(), "apps/web/public/audio/vo/es-mx"),
  resolve(__dirname, "../../../web/public/audio/vo/es-mx"),
];
const AUDIO_ROOT = AUDIO_ROOT_CANDIDATES.find((candidate) => existsSync(candidate)) ?? AUDIO_ROOT_CANDIDATES[0]!;

type AudioClip = { clueId: string; championId: string; audioUrl: string; filePath: string };

@Injectable()
export class ContentService {
  private readonly bundle: ContentBundle = loadContent();
  private readonly info: Record<string, { id: string; name: string; imageUrl: string }>;
  private readonly clueList: ContentClue[];
  private readonly clueById: Map<string, ContentClue>;
  private readonly imageCache = new Map<string, Buffer>();
  private readonly audioById = new Map<string, AudioClip>();

  constructor() {
    const info: Record<string, { id: string; name: string; imageUrl: string }> = {};
    for (const champion of this.bundle.champions) {
      info[champion.id] = {
        id: champion.id,
        name: champion.name,
        imageUrl: champion.imageUrl,
      };
    }
    this.info = info;

    this.clueById = new Map(this.bundle.clues.map((clue) => [clue.clueId, clue]));

    /*
     * Las URLs de Data Dragon incluyen el nombre del campeón
     * (`/spell/AatroxQ.png`). Servirlas tal cual filtraría la respuesta de
     * Bomba, así que el cliente solo ve un id opaco y la imagen se proxya.
     */
    this.clueList = this.bundle.clues.map((clue) => ({
      ...clue,
      imageUrl: `${PUBLIC_BASE}/api/clues/${encodeURIComponent(clue.clueId)}/image`,
    }));

    const manifestPath = join(AUDIO_ROOT, "manifest.json");
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { champions?: Record<string, { clips?: { file?: string }[] }> };
      let index = 0;
      for (const [championId, champion] of Object.entries(manifest.champions ?? {})) {
        for (const clip of champion.clips ?? []) {
          if (!clip.file) continue;
          const clueId = `audio-${index.toString(36)}`;
          this.audioById.set(clueId, {
            clueId,
            championId,
            audioUrl: `${PUBLIC_BASE}/api/audio-clues/${clueId}`,
            filePath: join(AUDIO_ROOT, clip.file),
          });
          index += 1;
        }
      }
    }
  }

  get meta() {
    return this.bundle.meta;
  }

  get champions(): PublicChampion[] {
    return this.bundle.champions;
  }

  get clues(): ContentClue[] {
    return this.clueList;
  }

  get pairs(): ContentPair[] {
    return this.bundle.pairs;
  }

  get avatars(): { id: string; imageUrl: string }[] {
    return this.bundle.avatars;
  }

  /** Mapa reducido para el motor: id -> { id, name, imageUrl }. */
  get championInfo(): Record<string, { id: string; name: string; imageUrl: string }> {
    return this.info;
  }

  get unicaChampionInfo(): Record<string, { id: string; name: string; imageUrl: string; tags: string[] }> {
    return Object.fromEntries(this.bundle.champions.map((champion) => [champion.id, {
      id: champion.id,
      name: champion.name,
      imageUrl: champion.imageUrl,
      tags: champion.tags,
    }]));
  }

  get audioClips(): { clueId: string; championId: string; audioUrl: string }[] {
    return [...this.audioById.values()].map(({ clueId, championId, audioUrl }) => ({ clueId, championId, audioUrl }));
  }

  audioClip(clueId: string): { body: Buffer; contentType: string } | null {
    const clip = this.audioById.get(clueId);
    if (!clip || !existsSync(clip.filePath)) return null;
    return { body: readFileSync(clip.filePath), contentType: "audio/ogg" };
  }

  exists(championId: string): boolean {
    return Boolean(this.bundle.championById[championId]);
  }

  /** Descarga (y cachea) la imagen original de una pista. */
  async clueImage(clueId: string): Promise<Buffer> {
    const cached = this.imageCache.get(clueId);
    if (cached) return cached;

    const clue = this.clueById.get(clueId);
    if (!clue) throw new NotFoundException("Pista desconocida");

    const response = await fetch(clue.imageUrl);
    if (!response.ok) {
      throw new NotFoundException("La imagen de la pista no está disponible");
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (this.imageCache.size >= IMAGE_CACHE_LIMIT) {
      const oldest = this.imageCache.keys().next().value;
      if (oldest !== undefined) this.imageCache.delete(oldest);
    }
    this.imageCache.set(clueId, buffer);
    return buffer;
  }
}
