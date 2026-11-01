export type StoredSession = {
  playerId: string;
  token: string;
  nickname: string;
  avatarId?: string;
};

const key = (code: string) => `lolparty:session:${code.toUpperCase()}`;

export function saveSession(code: string, session: StoredSession) {
  try {
    localStorage.setItem(key(code), JSON.stringify(session));
    localStorage.setItem("lolparty:nickname", session.nickname);
  } catch {
    /* almacenamiento bloqueado: seguimos sin persistir */
  }
}

export function loadSession(code: string): StoredSession | null {
  try {
    const raw = localStorage.getItem(key(code)) ?? sessionStorage.getItem(key(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token || !parsed?.playerId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(code: string) {
  try {
    localStorage.removeItem(key(code));
    sessionStorage.removeItem(key(code));
  } catch {
    /* nada */
  }
}

export function lastNickname(): string {
  try {
    return localStorage.getItem("lolparty:nickname") ?? "";
  } catch {
    return "";
  }
}
