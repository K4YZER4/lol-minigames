"use client";

import type { CarreraPrivateView, RoomView } from "@lolgames/protocol";
import type { Champion } from "@/lib/champions";
import { CarreraAnswerStatus } from "./CarreraAnswerStatus";
import { CarreraRevealCard } from "./CarreraRevealCard";
import { ChampionPicker } from "./ChampionPicker";
import { PlayerScoreRow } from "./PlayerScoreRow";
import { Timer } from "./Timer";

type Props = { room: RoomView; priv: CarreraPrivateView | null; champions: Champion[]; isHost: boolean; resetting: boolean; onAnswer: (id: string) => void; onReset: (mode?: "carrera") => void };

export function CarreraGame({ room, priv, champions, isHost, resetting, onAnswer, onReset }: Props) {
  const game = room.game?.mode === "carrera" ? room.game : null;
  if (!game) return null;
  const answered = priv?.hasAnswered ?? false;
  const winner = room.players.find((player) => player.playerId === game.winnerId);
  const privateTarget = priv?.revealedTarget ?? null;
  const publicTarget = game.phase !== "CLUES" ? game.target : null;
  const revealTarget = publicTarget ?? privateTarget;
  const showPrivateReveal = !publicTarget && Boolean(privateTarget);
  // Prueba visual: pixelación/desenfoque aproximadamente al doble.
  const blur = Math.max(4, 32 - game.clueIndex * 10);
  const clueSlots = Array.from({ length: 4 }, (_, index) => game.clues[index] ?? null);
  return <div className={`game-shell carrera-layout${revealTarget ? " has-reveal" : ""}`}>
    <div className="center carrera-heading"><div className="eyebrow">Carrera de pistas · ronda {game.round + 1}/{game.totalRounds}</div><h1>{game.phase === "CLUES" ? "Todos podéis adivinar." : game.phase === "FINISHED" ? "Carrera terminada" : "Respuesta revelada"}</h1><div className="timerbox"><Timer endsAt={game.phaseEndsAt} serverTime={room.serverTime} totalMs={room.settings.carrera.clueSeconds * 1000} label={`Pista ${game.clueIndex + 1}`} /></div></div>
    {revealTarget ? <CarreraRevealCard champion={revealTarget} eyebrow="El campeón era" note={showPrivateReveal ? "¡Acertaste! Solo tú ves esta confirmación. Los demás siguen adivinando." : undefined} /> : null}
    <section className="glass carrera-clues"><div className="carrera-clue-grid">{clueSlots.map((clue, index) => <div className={`carrera-clue-card${clue ? "" : " is-hidden"}`} key={clue?.clueId ?? `locked-${index}`}>{clue ? <><img src={clue.imageUrl} alt="Pista visual" style={{ filter: game.phase === "CLUES" ? `blur(${blur}px)` : "none" }} /><span>{clue.kind === "spell" ? "Habilidad" : "Pasiva"}</span></> : <span className="carrera-clue-locked">Pista {index + 1}</span>}</div>)}</div>{game.phase === "CLUES" && !answered ? <ChampionPicker champions={champions} onPick={onAnswer} placeholder="¿Qué campeón es?" /> : showPrivateReveal ? null : <CarreraAnswerStatus answered={answered} winnerName={winner?.name ?? null} targetName={game.target?.name ?? null} />}</section>
     <aside className="panel carrera-sidebar"><div className="eyebrow">Puntuación</div>{room.players.slice().sort((a, b) => b.score - a.score).map((player) => <PlayerScoreRow player={player} key={player.playerId} />)}{game.phase === "FINISHED" && isHost ? <div className="result-actions"><button className="primary" disabled={resetting} onClick={() => onReset("carrera")}>Repetir carrera →</button></div> : null}</aside>
  </div>;
}
