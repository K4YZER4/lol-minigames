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
  1: { lowpassHz: 2_600, highpassHz: 100, speed: 0.9, bitcrush: 0.08, noise: 0.015, delayMs: 18 },
  2: { lowpassHz: 4_500, highpassHz: 70, speed: 0.94, bitcrush: 0.045, noise: 0.008, delayMs: 12 },
  3: { lowpassHz: 8_000, highpassHz: 35, speed: 0.98, bitcrush: 0.015, noise: 0.003, delayMs: 6 },
  4: { lowpassHz: 20_000, highpassHz: 0, speed: 1, bitcrush: 0, noise: 0, delayMs: 0 },
};

export function audioDistortionLevel(level: number): AudioDistortionLevel {
  return AUDIO_DISTORTION_LEVELS[Math.max(1, Math.min(4, Math.round(level)))] ?? AUDIO_DISTORTION_LEVELS[4]!;
}
