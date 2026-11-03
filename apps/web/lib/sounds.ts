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

export function playUiSound(sound: UiSound) {
  if (typeof window === "undefined") return;
  const audio = cache.get(sound) ?? new Audio(SOURCES[sound]);
  cache.set(sound, audio);
  audio.currentTime = 0;
  audio.volume = sound === "explosion" || sound === "victory" ? 0.7 : 0.45;
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
