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
  1: { lowpassHz: 700, highpassHz: 90, speed: 0.72, bitcrush: 0.35, noise: 0.25, delayMs: 100 },
  2: { lowpassHz: 1_800, highpassHz: 65, speed: 0.88, bitcrush: 0.16, noise: 0.12, delayMs: 65 },
  3: { lowpassHz: 5_000, highpassHz: 35, speed: 0.96, bitcrush: 0.04, noise: 0.04, delayMs: 25 },
  4: { lowpassHz: 20_000, highpassHz: 0, speed: 1, bitcrush: 0, noise: 0, delayMs: 0 },
};

export function audioDistortionLevel(level: number): AudioDistortionLevel {
  return AUDIO_DISTORTION_LEVELS[Math.max(1, Math.min(4, Math.round(level)))] ?? AUDIO_DISTORTION_LEVELS[4]!;
}
