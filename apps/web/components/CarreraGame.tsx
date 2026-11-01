"use client";
import { useState } from "react";
import type { CarreraPrivateView, RoomView } from "@lolgames/protocol";
import type { Champion } from "@/lib/champions";
type Props = { room: RoomView; priv: CarreraPrivateView | null; champions: Champion[]; onAnswer: (id: string) => void };
export function CarreraGame({ room, priv, champions, onAnswer }: Props) {
  const [choice, setChoice] = useState("");
  const game = room.game?.mode === "carrera" ? room.game : null;
  if (!game) return null;
  const answered = priv?.hasAnswered ?? false;
  return <div className="game-shell"><section className="panel">
    <div className="eyebrow">Carrera de pistas · ronda {game.round + 1}/{game.totalRounds}</div>
    <h2>{game.phase === "CLUES" ? `Pista ${game.clueIndex + 1}` : game.phase === "FINISHED" ? "Carrera terminada" : "Respuesta"}</h2>
    <p className="hint">{game.phase === "CLUES" ? "Elige el campeón correcto antes que los demás." : game.target ? `Era ${game.target.name}.` : "La ronda se revela…"}</p>
    <div className="clue-grid">{game.clues.map((clue) => <div className="clue-card" key={clue.clueId}><img src={clue.imageUrl} alt="Pista" /><span>{clue.kind === "spell" ? "Habilidad" : "Pasiva"}</span></div>)}</div>
    {game.phase === "CLUES" && !answered ? <><select className="input" value={choice} onChange={(e) => setChoice(e.target.value)}><option value="">Elige un campeón…</option>{champions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="primary" disabled={!choice} onClick={() => { onAnswer(choice); setChoice(""); }}>Responder</button></> : <p className="hint">{answered ? "Respuesta registrada. Espera el resultado." : game.winnerId ? `${room.players.find((p) => p.playerId === game.winnerId)?.name ?? "Alguien"} ganó la ronda.` : "Sin ganador en esta ronda."}</p>}
  </section></div>;
}
