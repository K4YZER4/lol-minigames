"use client";

type Props = {
  answered: boolean;
  winnerName: string | null;
  targetName: string | null;
};

/** Estado textual de la ronda para quien no tiene una tarjeta de revelación. */
export function CarreraAnswerStatus({ answered, winnerName, targetName }: Props) {
  if (targetName) return <p className="hint carrera-result">Era {targetName}.</p>;
  if (answered) return <p className="hint carrera-result">No era ese campeón. Espera a que termine la ronda.</p>;
  if (winnerName) return <p className="hint carrera-result">{winnerName} acertó primero. La ronda sigue abierta.</p>;
  return <p className="hint carrera-result">Sin ganador en esta ronda.</p>;
}
