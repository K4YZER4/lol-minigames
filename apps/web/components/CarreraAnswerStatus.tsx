"use client";

type Props = {
  answered: boolean;
  winnerName: string | null;
  targetName: string | null;
};
import { useTranslation } from "@/lib/i18n";

/** Estado textual de la ronda para quien no tiene una tarjeta de revelación. */
export function CarreraAnswerStatus({ answered, winnerName, targetName }: Props) {
  const { t } = useTranslation();
  if (targetName) return <p className="hint carrera-result">{t.was(targetName)}</p>;
  if (answered) return <p className="hint carrera-result">{t.wrongChampion}</p>;
  if (winnerName) return <p className="hint carrera-result">{t.firstCorrect(winnerName)}</p>;
  return <p className="hint carrera-result">{t.noWinner}</p>;
}
