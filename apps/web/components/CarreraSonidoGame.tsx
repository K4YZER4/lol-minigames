"use client";

import type { CarreraSonidoPrivateView, RoomView } from "@lolgames/protocol";
import type { Champion } from "@/lib/champions";
import { AudioDistortionPlayer } from "./AudioDistortionPlayer";
import { CarreraAnswerStatus } from "./CarreraAnswerStatus";
import { CarreraRevealCard } from "./CarreraRevealCard";
import { ChampionPicker } from "./ChampionPicker";
import { PlayerScoreRow } from "./PlayerScoreRow";
import { Timer } from "./Timer";

type Props = { room: RoomView; priv: CarreraSonidoPrivateView | null; champions: Champion[]; isHost: boolean; resetting: boolean; onAnswer: (id: string) => void; onReset: (mode?: "carrera-sonido") => void };

export function CarreraSonidoGame({ room, priv, champions, isHost, resetting, onAnswer, onReset }: Props) {
  const game = room.game?.mode === "carrera-sonido" ? room.game : null;
  if (!game) return null;
  const answered = priv?.hasAnswered ?? false;
  const winner = room.players.find((player) => player.playerId === game.winnerId);
  const privateTarget = priv?.revealedTarget ?? null;
  const publicTarget = game.phase !== "CLUES" ? game.target : null;
  const revealTarget = publicTarget ?? privateTarget;
  const showPrivateReveal = !publicTarget && Boolean(privateTarget);
  const current = game.clues[game.clueIndex];
  return <div className={`game-shell carrera-layout carrera-sonido-layout${revealTarget ? " has-reveal" : ""}`}>
     <div className="center carrera-heading"><div className="eyebrow">Carrera de pistas: Sonido · ronda {game.round + 1}/{game.totalRounds}</div><h1>{game.phase === "CLUES" ? "Escucha y adivina." : game.phase === "FINISHED" ? "Carrera terminada" : "Respuesta revelada"}</h1><div className="timerbox"><Timer endsAt={game.phaseEndsAt} serverTime={room.serverTime} totalMs={room.settings.carreraSonido.clueSeconds * 1000} label={`Pista sonora ${game.clueIndex + 1}/${game.clues.length}`} /></div></div>
    {revealTarget ? <CarreraRevealCard champion={revealTarget} eyebrow="El campeón era" note={showPrivateReveal ? "¡Acertaste! Solo tú ves esta confirmación. Los demás siguen adivinando." : undefined} /> : null}
    <section className="glass carrera-sonido-clues"><div className="audio-clue-list">{game.clues.map((clue, index) => <div className={`audio-clue-card${index === game.clueIndex ? " is-current" : ""}${index > game.clueIndex && game.phase === "CLUES" ? " is-locked" : ""}`} key={clue.clueId}><span className="audio-clue-number">{index + 1}</span><span>{index <= game.clueIndex || game.phase !== "CLUES" ? `Nivel ${index + 1}` : "Bloqueada"}</span>{index <= game.clueIndex && game.phase === "CLUES" ? <AudioDistortionPlayer src={clue.audioUrl} level={index + 1} label={index === game.clueIndex ? "Pista actual" : "Repetir pista"} /> : null}</div>)}</div>{game.phase === "CLUES" && !answered ? <ChampionPicker champions={champions} onPick={onAnswer} placeholder="¿Qué campeón es?" /> : showPrivateReveal ? null : <CarreraAnswerStatus answered={answered} winnerName={winner?.name ?? null} targetName={game.target?.name ?? null} />}</section>
     <aside className="panel carrera-sidebar"><div className="eyebrow">Puntuación</div>{room.players.slice().sort((a, b) => b.score - a.score).map((player) => <PlayerScoreRow player={player} key={player.playerId} />)}{game.phase === "FINISHED" && isHost ? <div className="result-actions"><button className="primary" disabled={resetting} onClick={() => onReset("carrera-sonido")}>Repetir carrera sonora →</button></div> : null}</aside>
  </div>;
}
