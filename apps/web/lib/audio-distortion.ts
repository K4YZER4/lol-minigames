/** Presets del modo Carrera de pistas: Sonido.
 *
 * Se ajustan aquí, no en los archivos de audio. El navegador aplica estos
 * efectos en tiempo real, por lo que todos los niveles usan el mismo clip.
 */
export type AudioDistortionLevel = {
  lowpassHz: number;
  highpassHz: number;
  speed: number;
  bitcrush: number;
  noise: number;
  delayMs: number;
};

export const AUDIO_DISTORTION_LEVELS: Record<number, AudioDistortionLevel> = {
  // Distorsión reconocible, no irreconocible: siempre queda señal limpia.
  1: { lowpassHz: 5_000, highpassHz: 80, speed: 0.95, bitcrush: 0.025, noise: 0.003, delayMs: 4 },
  2: { lowpassHz: 8_000, highpassHz: 55, speed: 0.97, bitcrush: 0.012, noise: 0.0015, delayMs: 2 },
  3: { lowpassHz: 12_000, highpassHz: 25, speed: 0.99, bitcrush: 0.004, noise: 0.0005, delayMs: 1 },
  4: { lowpassHz: 20_000, highpassHz: 0, speed: 1, bitcrush: 0, noise: 0, delayMs: 0 },
};

export function audioDistortionLevel(level: number): AudioDistortionLevel {
  return AUDIO_DISTORTION_LEVELS[Math.max(1, Math.min(4, Math.round(level)))] ?? AUDIO_DISTORTION_LEVELS[4]!;
}
