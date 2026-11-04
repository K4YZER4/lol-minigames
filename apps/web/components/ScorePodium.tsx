import type { PlayerView } from "@lolgames/protocol";

export function ScorePodium({ players }: { players: PlayerView[] }) {
  const ranking = [...players].sort((a, b) => b.score - a.score);
  return <>
    <div className="podium">{ranking.slice(0, 3).map((player, index) => <div className={`podium-card place-${index + 1}`} key={player.playerId}><span className="podium-medal">{index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}</span><div className="avatar"><img src={player.avatar.imageUrl} alt="" /></div><strong>{player.name}</strong><b>{player.score} pts</b></div>)}</div>
    {ranking.length > 3 ? <div className="results-ranking">{ranking.slice(3).map((player, index) => <div className="results-rank" key={player.playerId}><span>{index + 4}</span><div className="avatar"><img src={player.avatar.imageUrl} alt="" /></div><strong>{player.name}</strong><b>{player.score} pts</b></div>)}</div> : null}
  </>;
}
