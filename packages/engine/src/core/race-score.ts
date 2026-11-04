/** Puntos por acierto: cada pista y cada jugador que se adelantó reducen la recompensa. */
export function raceScore(clueIndex: number, earlierCorrectAnswers: number): number {
  return Math.max(100, 1000 - clueIndex * 200 - earlierCorrectAnswers * 100);
}
