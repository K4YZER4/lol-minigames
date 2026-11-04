"use client";

import type { ModeId, RoomView } from "@lolgames/protocol";
import { MODE_LABELS } from "@/lib/mode-labels";
import { ScorePodium } from "./ScorePodium";

type Props = { room: RoomView; me: string | null; resetting: boolean; onReset: (mode?: ModeId) => void };

export function ResultsScreen({ room, me, resetting, onReset }: Props) {
  const isHost = room.hostId === me;
  return <section className="results-screen">
    <div className="results-heading"><div className="star">✦</div><div className="eyebrow">Fin de la partida · {MODE_LABELS[room.mode]}</div><h1>Podio</h1><p className="muted">La partida terminó. Estos son los resultados.</p></div>
    <ScorePodium players={room.players} />
    <div className="results-actions">{isHost ? <><button className="primary" disabled={resetting} onClick={() => onReset(room.mode)}>Repetir {MODE_LABELS[room.mode]} →</button><button className="secondary" disabled={resetting} onClick={() => onReset()}>Cambiar modo</button></> : <p className="hint">Esperando al anfitrión para repetir la partida…</p>}</div>
  </section>;
}
