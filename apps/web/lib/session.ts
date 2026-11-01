export type StoredSession = {
  playerId: string;
  token: string;
  nickname: string;
  avatarId?: string;
};

const key = (code: string) => `lolparty:session:${code.toUpperCase()}`;

export function saveSession(code: string, session: StoredSession) {
  try {
    // sessionStorage is intentionally tab-scoped: several tabs can represent
    // different players in the same room without replacing each other's token.
    sessionStorage.setItem(key(code), JSON.stringify(session));
    localStorage.setItem("lolparty:nickname", session.nickname);
  } catch {
    /* almacenamiento bloqueado: seguimos sin persistir */
  }
}

export function loadSession(code: string): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(key(code));
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
    sessionStorage.removeItem(key(code));
    // Remove legacy tokens written by older builds. They must never be reused
    // automatically because localStorage is shared by every tab.
    localStorage.removeItem(key(code));
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
