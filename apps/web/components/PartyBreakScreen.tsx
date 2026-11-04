"use client";

import type { RoomView } from "@lolgames/protocol";
import { MODE_LABELS } from "@/lib/mode-labels";
import { ScorePodium } from "./ScorePodium";
import { Timer } from "./Timer";

export function PartyBreakScreen({ room }: { room: RoomView }) {
  if (!room.partyBreak) return null;

  return <section className="results-screen party-break-screen">
    <div className="results-heading"><div className="star">✦</div><div className="eyebrow">Party · marcador acumulado</div><h1>Puntuación actual</h1></div>
    <ScorePodium players={room.players} />
    <div className="panel party-break-next">
      <div className="eyebrow">Siguiente modo</div>
      <h2>{MODE_LABELS[room.partyBreak.nextMode]}</h2>
      <Timer endsAt={room.partyBreak.endsAt} serverTime={room.serverTime} totalMs={5_000} label="Comienza en" />
    </div>
  </section>;
}
