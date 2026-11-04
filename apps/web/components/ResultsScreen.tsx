"use client";

import type { ModeId, RoomView } from "@lolgames/protocol";
import { MODE_LABELS } from "@/lib/mode-labels";
import { ScorePodium } from "./ScorePodium";
import { PlayerScoreRow } from "./PlayerScoreRow";

type Props = { room: RoomView; me: string | null; resetting: boolean; onReset: (mode?: ModeId) => void };

export function ResultsScreen({ room, me, resetting, onReset }: Props) {
  const isHost = room.hostId === me;
  const partyHistory = room.mode === "party" && room.partyHistory?.length ? room.partyHistory : null;

  if (partyHistory) {
    const ranking = [...room.players].sort((a, b) => b.score - a.score);
    const winner = ranking[0];
    return <section className="results-screen party-final-screen">
      <div className="results-heading">
        <div className="star">✦</div>
        <div className="eyebrow">Party · fin de la partida</div>
        <h1>Podio final</h1>
      </div>

      {winner ? <div className="party-final-winner">
        <div className="avatar"><img src={winner.avatar.imageUrl} alt="" /></div>
        <div>
          <div className="eyebrow">Ganador de la Party</div>
          <strong>{winner.name}</strong>
          <b>{winner.score} pts</b>
        </div>
      </div> : null}

      <ScorePodium players={room.players} />

      <div className="party-history">
        {partyHistory.map((entry, index) => {
          const modeRanking = [...room.players].sort(
            (a, b) => (entry.scores[b.playerId] ?? 0) - (entry.scores[a.playerId] ?? 0),
          );
          return <article className="panel party-history-card" key={`${entry.mode}-${index}`}>
            <div className="eyebrow">Modo {index + 1}</div>
            <h2>{MODE_LABELS[entry.mode]}</h2>
            {modeRanking.map((player) => <PlayerScoreRow player={player} score={entry.scores[player.playerId] ?? 0} prefix="+" key={player.playerId} />)}
          </article>;
        })}
      </div>

      <div className="results-actions">{isHost ? <><button className="primary" disabled={resetting} onClick={() => onReset("party")}>Jugar otra Party →</button><button className="secondary" disabled={resetting} onClick={() => onReset()}>Cambiar modo</button></> : <p className="hint">Esperando al anfitrión para otra partida…</p>}</div>
    </section>;
  }

  return <section className="results-screen">
     <div className="results-heading"><div className="star">✦</div><div className="eyebrow">Fin de la partida · {MODE_LABELS[room.mode]}</div><h1>Podio</h1></div>
    <ScorePodium players={room.players} />
    <div className="results-actions">{isHost ? <><button className="primary" disabled={resetting} onClick={() => onReset(room.mode)}>Repetir {MODE_LABELS[room.mode]} →</button><button className="secondary" disabled={resetting} onClick={() => onReset()}>Cambiar modo</button></> : <p className="hint">Esperando al anfitrión para repetir la partida…</p>}</div>
  </section>;
}
