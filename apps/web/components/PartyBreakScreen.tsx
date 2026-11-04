"use client";

import type { RoomView } from "@lolgames/protocol";
import { MODE_LABELS } from "@/lib/mode-labels";
import { ScorePodium } from "./ScorePodium";
import { Timer } from "./Timer";

export function PartyBreakScreen({ room }: { room: RoomView }) {
  const partyBreak = room.partyBreak;
  if (!partyBreak) return null;

  const ranked = [...room.players].sort(
    (a, b) =>
      (partyBreak.modeScores[b.playerId] ?? 0) - (partyBreak.modeScores[a.playerId] ?? 0) ||
      b.score - a.score,
  );
  const modeWinner = ranked[0] && (partyBreak.modeScores[ranked[0].playerId] ?? 0) > 0 ? ranked[0] : null;

  return <section className="results-screen party-break-screen">
    <div className="results-heading">
      <div className="star">✦</div>
      <div className="eyebrow">Party · modo {partyBreak.modeNumber} de {partyBreak.totalModes}</div>
      <h1>{MODE_LABELS[partyBreak.endedMode]} terminado</h1>
    </div>

    <section className="panel party-break-summary">
      <div className="eyebrow">Puntos que sumó este modo</div>
      {modeWinner ? <p className="party-break-winner">Ganó este modo: <strong>{modeWinner.name}</strong></p> : null}
      <div className="party-mode-scores">
        {ranked.map((player) => <div className="party-mode-score" key={player.playerId}>
          <div className="avatar"><img src={player.avatar.imageUrl} alt="" /></div>
          <span>{player.name}</span>
          <strong className={(partyBreak.modeScores[player.playerId] ?? 0) > 0 ? "is-positive" : ""}>
            +{partyBreak.modeScores[player.playerId] ?? 0}
          </strong>
          <small>{player.score} pts en total</small>
        </div>)}
      </div>
    </section>

    <div className="eyebrow party-break-podium-label">Así va el podio</div>
    <ScorePodium players={room.players} />

    <div className="panel party-break-next">
      <div className="eyebrow">Siguiente modo</div>
      <h2>{MODE_LABELS[partyBreak.nextMode]}</h2>
      <Timer endsAt={partyBreak.endsAt} serverTime={room.serverTime} totalMs={5_000} label="Comienza en" />
    </div>
  </section>;
}
