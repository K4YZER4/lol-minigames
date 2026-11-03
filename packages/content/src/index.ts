import { readFileSync } from "node:fs";
import { join } from "node:path";

export type PublicChampion = {
  id: string;
  name: string;
  imageUrl: string;
  tags: string[];
  info: { attack: number; defense: number; magic: number; difficulty: number };
  stats: {
    hp: number;
    armor: number;
    spellblock: number;
    attackrange: number;
    movespeed: number;
  };
};

export type ContentClue = {
  clueId: string;
  championId: string;
  kind: "spell" | "passive";
  imageUrl: string;
};

export type ContentPair = {
  championId: string;
  partnerId: string;
  distance: number;
  difficulty: "easy" | "normal" | "hard";
  curated: boolean;
};

export type ContentMeta = {
  version: string;
  locale: string;
  generatedAt: string;
  championCount: number;
  clueCount: number;
  cluesDroppedAsAmbiguous: number;
  pairCount: number;
  curatedPairs: number;
  avatarCount: number;
};

export type ContentAvatar = {
  id: string;
  imageUrl: string;
};

export type ContentEmojiClues = Record<string, string[][]>;

export type ContentBundle = {
  meta: ContentMeta;
  champions: PublicChampion[];
  championById: Record<string, PublicChampion>;
  clues: ContentClue[];
  pairs: ContentPair[];
  avatars: ContentAvatar[];
  emojiClues: ContentEmojiClues;
};

const DATA_DIR = join(__dirname, "..", "data");

function readJson<T>(file: string): T {
  try {
    return JSON.parse(readFileSync(join(DATA_DIR, file), "utf8")) as T;
  } catch {
    throw new Error(
      `Falta ${join(DATA_DIR, file)}. Ejecuta "npm run content" antes de arrancar el servidor.`,
    );
  }
}

let cached: ContentBundle | null = null;

export function loadContent(): ContentBundle {
  if (cached) return cached;
  const meta = readJson<ContentMeta>("meta.json");
  const champions = readJson<PublicChampion[]>("champions.json");
  const clues = readJson<ContentClue[]>("clues.json");
  const pairs = readJson<ContentPair[]>("pairs.json");
  const avatars = readJson<ContentAvatar[]>("avatars.json");
  const emojiClues = readJson<ContentEmojiClues>("emoji-clues.json");

  const championById: Record<string, PublicChampion> = {};
  for (const champion of champions) championById[champion.id] = champion;

  cached = { meta, champions, championById, clues, pairs, avatars, emojiClues };
  return cached;
}
