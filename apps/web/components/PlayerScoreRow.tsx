import type { PlayerView } from "@lolgames/protocol";

type Props = {
  player: PlayerView;
  score?: number;
  prefix?: string;
};

/** Fila de puntuación compartida para mantener avatar y nombre alineados. */
export function PlayerScoreRow({ player, score = player.score, prefix = "" }: Props) {
  return <div className="score-row">
    <span className="score-player">
      <span className="avatar"><img src={player.avatar.imageUrl} alt="" /></span>
      <span>{player.name}</span>
    </span>
    <strong>{prefix}{score}</strong>
  </div>;
}
