import { SERVER_URL } from "./socket";

export type Champion = { id: string; name: string; imageUrl: string };

let cache: Champion[] | null = null;
let inflight: Promise<Champion[]> | null = null;

export async function loadChampions(): Promise<Champion[]> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = fetch(`${SERVER_URL}/api/champions`)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<Champion[]>;
    })
    .then((champions) => {
      cache = champions;
      return champions;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function searchChampions(champions: Champion[], query: string, limit = 8): Champion[] {
  const needle = normalize(query);
  if (!needle) return [];
  const starts: Champion[] = [];
  const contains: Champion[] = [];
  for (const champion of champions) {
    const haystack = normalize(champion.name);
    if (haystack.startsWith(needle)) starts.push(champion);
    else if (haystack.includes(needle)) contains.push(champion);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
