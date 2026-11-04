export type UiSound = "click" | "correct" | "incorrect" | "new-clue" | "countdown" | "timeout" | "reveal" | "victory" | "defeat" | "explosion";

const SOURCES: Record<UiSound, string> = {
  click: "/audio/sfx/01_boton_click.wav",
  correct: "/audio/sfx/02_respuesta_correcta.wav",
  incorrect: "/audio/sfx/03_respuesta_incorrecta.wav",
  "new-clue": "/audio/sfx/04_nueva_pista.wav",
  countdown: "/audio/sfx/05_cuenta_regresiva.wav",
  timeout: "/audio/sfx/06_tiempo_agotado.wav",
  reveal: "/audio/sfx/07_revelacion.wav",
  victory: "/audio/sfx/08_victoria.wav",
  defeat: "/audio/sfx/09_derrota.wav",
  explosion: "/audio/sfx/10_explosion.wav",
};

const cache = new Map<UiSound, HTMLAudioElement>();
const VOLUME_STORAGE_KEY = "lolparty:volume";
export const UI_VOLUME_EVENT = "lolparty:volume-change";

export function getUiVolume(): number {
  if (typeof window === "undefined") return 1;
  let stored = Number.NaN;
  try { stored = Number(window.localStorage.getItem(VOLUME_STORAGE_KEY)); } catch { /* almacenamiento bloqueado */ }
  return Number.isFinite(stored) ? Math.min(1, Math.max(0, stored)) : 1;
}

export function setUiVolume(value: number): void {
  if (typeof window === "undefined") return;
  const volume = Math.min(1, Math.max(0, value));
  try { window.localStorage.setItem(VOLUME_STORAGE_KEY, String(volume)); } catch { /* almacenamiento bloqueado */ }
  for (const [sound, audio] of cache) audio.volume = (sound === "explosion" || sound === "victory" ? 0.7 : 0.45) * volume;
  window.dispatchEvent(new Event(UI_VOLUME_EVENT));
}

export function playUiSound(sound: UiSound) {
  if (typeof window === "undefined") return;
  let audio = cache.get(sound);
  if (!audio) {
    audio = new Audio(SOURCES[sound]);
    audio.preload = "auto";
    cache.set(sound, audio);
  }
  audio.currentTime = 0;
  audio.volume = (sound === "explosion" || sound === "victory" ? 0.7 : 0.45) * getUiVolume();
  void audio.play().catch(() => undefined);
}

export const UI_SOUND_LABELS: Record<UiSound, string> = {
  click: "Botón",
  correct: "Respuesta correcta",
  incorrect: "Respuesta incorrecta",
  "new-clue": "Nueva pista",
  countdown: "Cuenta regresiva",
  timeout: "Tiempo agotado",
  reveal: "Revelación",
  victory: "Victoria",
  defeat: "Derrota",
  explosion: "Explosión",
};
