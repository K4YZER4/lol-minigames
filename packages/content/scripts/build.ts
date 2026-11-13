/**
 * Importador de Data Dragon.
 *
 * Genera el catálogo propio y versionado que consume el servidor:
 *   - champions.json    datos públicos de campeones
 *   - clues.json        pistas de habilidad (SOLO servidor: clueId -> championId)
 *   - pairs.json        parejas de Impostor con dificultad
 *   - meta.json         versión y conteos
 *
 * Reglas de calidad aplicadas aquí:
 *   1. Se eliminan las pistas cuyo ícono se repite entre campeones (ambiguas).
 *   2. Se descarta todo texto: al cliente solo viaja el ícono.
 *   3. Los pares se calculan por similitud y se corrigen con un mapa manual.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LOCALE = "es_MX";
const OUT_DIR = join(process.cwd(), "data");
const CDN = "https://ddragon.leagueoflegends.com/cdn";
const VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json";
const COMMUNITYDRAGON_BASE = "https://raw.communitydragon.org";

type RawChampion = {
  id: string;
  key: string;
  name: string;
  title: string;
  tags: string[];
  partype: string;
  info: { attack: number; defense: number; magic: number; difficulty: number };
  stats: Record<string, number>;
  image: { full: string };
};

type RawChampionDetail = {
  id: string;
  name: string;
  spells: { id: string; name: string; description: string; image: { full: string } }[];
  passive: { name: string; description: string; image: { full: string } };
};

type RawEmote = {
  id: number;
  inventoryIcon?: string;
};

type RawProfileIcon = {
  id: number;
  image: { full: string };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
};

async function fetchJson<T>(url: string, attempt = 0): Promise<T> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    if (attempt < 3) {
      await sleep(400 * (attempt + 1));
      return fetchJson<T>(url, attempt + 1);
    }
    throw new Error(`HTTP ${res.status} en ${url}`);
  }
  return (await res.json()) as T;
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      out[index] = await fn(items[index]!, index);
    }
  });
  await Promise.all(workers);
  return out;
}

/* ------------------------------------------------------------------ */
/* Parejas curadas a mano para los campeones más jugados               */
/* ------------------------------------------------------------------ */

const PAIR_OVERRIDES: Record<string, string> = {
  Yasuo: "Yone",
  Yone: "Yasuo",
  Ahri: "Leblanc",
  Leblanc: "Ahri",
  Lux: "Morgana",
  Morgana: "Lux",
  Jinx: "Caitlyn",
  Caitlyn: "Jinx",
  Garen: "Darius",
  Darius: "Garen",
  Zed: "Talon",
  Talon: "Zed",
  Katarina: "Akali",
  Akali: "Katarina",
  LeeSin: "XinZhao",
  XinZhao: "LeeSin",
  Riven: "Fiora",
  Fiora: "Riven",
  Vayne: "Kaisa",
  Kaisa: "Vayne",
  Ezreal: "Jhin",
  Jhin: "Ezreal",
  Thresh: "Blitzcrank",
  Blitzcrank: "Thresh",
  Leona: "Nautilus",
  Nautilus: "Leona",
  Braum: "Alistar",
  Alistar: "Braum",
  Janna: "Soraka",
  Soraka: "Janna",
  Lulu: "Karma",
  Karma: "Lulu",
  Nami: "Sona",
  Sona: "Nami",
  Draven: "Twitch",
  Twitch: "Draven",
  Teemo: "Heimerdinger",
  Heimerdinger: "Teemo",
  Syndra: "Orianna",
  Orianna: "Syndra",
  Viktor: "Ryze",
  Ryze: "Viktor",
  Anivia: "Lissandra",
  Lissandra: "Anivia",
  Annie: "Veigar",
  Veigar: "Annie",
  Malzahar: "Swain",
  Swain: "Malzahar",
  Vladimir: "Kennen",
  Kennen: "Vladimir",
  Shen: "Poppy",
  Poppy: "Shen",
  Maokai: "Ivern",
  Ivern: "Maokai",
  Sejuani: "Nunu",
  Nunu: "Sejuani",
  Amumu: "Rammus",
  Rammus: "Amumu",
  Volibear: "Udyr",
  Udyr: "Volibear",
  Olaf: "Tryndamere",
  Tryndamere: "Olaf",
  Jax: "Irelia",
  Irelia: "Jax",
  Aatrox: "Renekton",
  Renekton: "Aatrox",
  Nasus: "Sion",
  Sion: "Nasus",
  Tristana: "Corki",
  Corki: "Tristana",
  MissFortune: "Sivir",
  Sivir: "MissFortune",
  Ashe: "Varus",
  Varus: "Ashe",
  Xerath: "Velkoz",
  Velkoz: "Xerath",
  Graves: "Lucian",
  Lucian: "Graves",
  RekSai: "Kayn",
  Kayn: "RekSai",
  Ekko: "Fizz",
  Fizz: "Ekko",
  Sylas: "Viego",
  Viego: "Sylas",
  Gwen: "Camille",
  Camille: "Gwen",
};

/* ------------------------------------------------------------------ */
/* Vector de similitud                                                 */
/* ------------------------------------------------------------------ */

const TAG_ORDER = ["Fighter", "Tank", "Mage", "Marksman", "Assassin", "Support"];

function vector(c: RawChampion): number[] {
  const tags = TAG_ORDER.map((t) => (c.tags.includes(t) ? 1.6 : 0));
  const info = [c.info.attack, c.info.defense, c.info.magic, c.info.difficulty].map(
    (n) => n / 10,
  );
  const s = c.stats;
  const stats = [
    Math.log1p(s.hp ?? 0) / Math.log1p(3000),
    (s.armor ?? 0) / 100,
    (s.spellblock ?? 0) / 100,
    (s.attackrange ?? 0) / 650,
    (s.movespeed ?? 0) / 400,
  ];
  return [...tags, ...info, ...stats];
}

function distance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/* ------------------------------------------------------------------ */

async function main() {
  console.log("→ Consultando versiones de Data Dragon…");
  const versions = await fetchJson<string[]>(VERSIONS_URL);
  const version = versions[0];
  if (!version) throw new Error("Data Dragon no devolvió versiones");

  console.log(`→ Versión fijada: ${version}`);
  const communityVersion = version.split(".").slice(0, 2).join(".");
  const championUrl = `${CDN}/${version}/data/${LOCALE}/champion.json`;
  const raw = await fetchJson<{ data: Record<string, RawChampion> }>(championUrl);
  const rawList = Object.values(raw.data);
  console.log(`→ ${rawList.length} campeones`);

  console.log("→ Descargando detalle de habilidades…");
  const details = await mapLimit(rawList, 8, async (champion) => {
    const url = `${CDN}/${version}/data/${LOCALE}/champion/${champion.id}.json`;
    const payload = await fetchJson<{ data: Record<string, RawChampionDetail> }>(url);
    return payload.data[champion.id]!;
  });

  /* ----------------------------- campeones ----------------------------- */

  const champions = rawList.map((c) => ({
    id: c.id,
    name: c.name,
    imageUrl: `${CDN}/${version}/img/champion/${c.image.full}`,
    tags: c.tags,
    info: c.info,
    stats: {
      hp: c.stats.hp ?? 0,
      armor: c.stats.armor ?? 0,
      spellblock: c.stats.spellblock ?? 0,
      attackrange: c.stats.attackrange ?? 0,
      movespeed: c.stats.movespeed ?? 0,
    },
  }));

  /* ------------------------------ pistas ------------------------------- */

  type Candidate = {
    championId: string;
    kind: "spell" | "passive";
    imageFile: string;
    imageUrl: string;
  };

  const candidates: Candidate[] = [];
  for (const detail of details) {
    if (!detail) continue;
    for (const spell of detail.spells ?? []) {
      candidates.push({
        championId: detail.id,
        kind: "spell",
        imageFile: `spell:${spell.image.full}`,
        imageUrl: `${CDN}/${version}/img/spell/${spell.image.full}`,
      });
    }
    if (detail.passive?.image?.full) {
      candidates.push({
        championId: detail.id,
        kind: "passive",
        imageFile: `passive:${detail.passive.image.full}`,
        imageUrl: `${CDN}/${version}/img/passive/${detail.passive.image.full}`,
      });
    }
  }

  const usage = new Map<string, number>();
  for (const c of candidates) usage.set(c.imageFile, (usage.get(c.imageFile) ?? 0) + 1);

  const unique = candidates.filter((c) => (usage.get(c.imageFile) ?? 0) === 1);
  const dropped = candidates.length - unique.length;

  const clues = unique
    .sort((a, b) => (a.championId < b.championId ? -1 : a.championId > b.championId ? 1 : 0))
    .map((c, index) => ({
      clueId: `c_${String(index + 1).padStart(4, "0")}`,
      championId: c.championId,
      kind: c.kind,
      imageUrl: c.imageUrl,
    }));

  /* ------------------------------ parejas ------------------------------ */

  const vectors = new Map(rawList.map((c) => [c.id, vector(c)]));
  const known = new Set(rawList.map((c) => c.id));

  const nearest = new Map<string, { partnerId: string; distance: number }>();
  for (const champion of rawList) {
    const own = vectors.get(champion.id)!;
    let best: { partnerId: string; distance: number } | null = null;
    for (const other of rawList) {
      if (other.id === champion.id) continue;
      const d = distance(own, vectors.get(other.id)!);
      if (!best || d < best.distance) best = { partnerId: other.id, distance: d };
    }
    if (best) nearest.set(champion.id, best);
  }

  const allDistances = [...nearest.values()].map((n) => n.distance).sort((a, b) => a - b);
  const p33 = allDistances[Math.floor(allDistances.length * 0.33)] ?? 0;
  const p66 = allDistances[Math.floor(allDistances.length * 0.66)] ?? 0;

  const overrides = Object.entries(PAIR_OVERRIDES).filter(([from, to]) => {
    if (!known.has(from) || !known.has(to)) {
      console.log(`   ⚠ override ignorado: ${from} -> ${to}`);
      return false;
    }
    return true;
  });

  const pairs = rawList.map((champion) => {
    const auto = nearest.get(champion.id)!;
    const override = PAIR_OVERRIDES[champion.id];
    const partnerId = override && known.has(override) ? override : auto.partnerId;
    const d =
      partnerId === auto.partnerId
        ? auto.distance
        : distance(vectors.get(champion.id)!, vectors.get(partnerId)!);
    const difficulty = d <= p33 ? "hard" : d <= p66 ? "normal" : "easy";
    return {
      championId: champion.id,
      partnerId,
      distance: Number(d.toFixed(4)),
      difficulty,
      curated: Boolean(override),
    };
  });

  /* ------------------------------ avatares ----------------------------- */
  let avatars: { id: string; imageUrl: string }[] = [];
  let avatarSource = "emotes de League";
  try {
    console.log("→ Descargando emotes de League para avatares…");
    const emotes = await fetchJson<RawEmote[]>(
      `${COMMUNITYDRAGON_BASE}/${communityVersion}/plugins/rcp-be-lol-game-data/global/default/v1/summoner-emotes.json`,
    );
    const emoteMarker = "/lol-game-data/assets/";
    avatars = emotes
      .filter(
        (emote) =>
          Boolean(emote.inventoryIcon?.startsWith(emoteMarker)) &&
          Boolean(emote.inventoryIcon && emote.inventoryIcon.length > emoteMarker.length) &&
          Boolean(emote.inventoryIcon && /\.(png|jpg|jpeg)$/i.test(emote.inventoryIcon)),
      )
      .map((emote) => {
        const relative = emote.inventoryIcon!.slice(emoteMarker.length).replace(/^assets[\\/]/i, "");
        return {
          id: `emote_${emote.id}`,
          imageUrl: `${COMMUNITYDRAGON_BASE}/${communityVersion}/plugins/rcp-be-lol-game-data/global/default/assets/${relative.replace(/\\/g, "/").toLowerCase()}`,
        };
      })
      .filter((avatar, index, all) => all.findIndex((candidate) => candidate.imageUrl === avatar.imageUrl) === index)
      .filter((avatar) => !avatar.imageUrl.includes("/tft/"))
      .slice(0, 64);
    if (avatars.length < 12) {
      console.warn(`   ⚠ CommunityDragon devolvió ${avatars.length} emotes; se usarán íconos de perfil.`);
    }
  } catch (error) {
    console.warn("   ⚠ No se pudieron descargar los emotes; se usarán íconos de perfil.");
    console.warn(`     ${error instanceof Error ? error.message : String(error)}`);
  }

  if (avatars.length < 12) {
    console.log("→ Descargando íconos de perfil de Data Dragon…");
    const profileIcons = await fetchJson<{ data: Record<string, RawProfileIcon> }>(
      `${CDN}/${version}/data/${LOCALE}/profileicon.json`,
    );
    avatars = Object.values(profileIcons.data)
      .filter((icon) => icon.id > 0 && Boolean(icon.image?.full))
      .sort((a, b) => a.id - b.id)
      .slice(0, 64)
      .map((icon) => ({
        id: `icon_${icon.id}`,
        imageUrl: `${CDN}/${version}/img/profileicon/${icon.image.full}`,
      }));
    avatarSource = "íconos de perfil de Data Dragon";
  }

  if (avatars.length < 12) throw new Error("No se pudieron generar suficientes avatares");

  /* ------------------------------ escribir ----------------------------- */

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "champions.json"), JSON.stringify(champions, null, 2));
  writeFileSync(join(OUT_DIR, "clues.json"), JSON.stringify(clues, null, 2));
  writeFileSync(join(OUT_DIR, "pairs.json"), JSON.stringify(pairs, null, 2));
  writeFileSync(join(OUT_DIR, "avatars.json"), JSON.stringify(avatars, null, 2));
  writeFileSync(
    join(OUT_DIR, "meta.json"),
    JSON.stringify(
      {
        version,
        locale: LOCALE,
        generatedAt: new Date().toISOString(),
        championCount: champions.length,
        clueCount: clues.length,
        cluesDroppedAsAmbiguous: dropped,
        pairCount: pairs.length,
        curatedPairs: overrides.length,
        avatarCount: avatars.length,
      },
      null,
      2,
    ),
  );

  console.log("");
  console.log(`✓ Campeones: ${champions.length}`);
  console.log(`✓ Pistas:    ${clues.length} (${dropped} descartadas por ícono repetido)`);
  console.log(`✓ Parejas:   ${pairs.length} (${overrides.length} curadas a mano)`);
  console.log(`✓ Avatares:  ${avatars.length} ${avatarSource}`);
  console.log(`✓ Salida:    ${OUT_DIR}`);
}

main().catch((error) => {
  console.error("✗ Falló el importador:", error);
  process.exit(1);
});
