import { SERVER_URL } from "./socket";

export type Avatar = { id: string; imageUrl: string };

let cache: Avatar[] | null = null;
let inflight: Promise<Avatar[]> | null = null;

export async function loadAvatars(): Promise<Avatar[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch(`${SERVER_URL}/api/avatars`)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<Avatar[]>;
    })
    .then((avatars) => {
      cache = avatars;
      return avatars;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

const AVATAR_KEY = "lolparty:avatar";

export function lastAvatarId(): string | null {
  try {
    return localStorage.getItem(AVATAR_KEY);
  } catch {
    return null;
  }
}

export function saveAvatarId(id: string) {
  try {
    localStorage.setItem(AVATAR_KEY, id);
  } catch {
    /* almacenamiento bloqueado */
  }
}
