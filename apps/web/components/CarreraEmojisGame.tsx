"use client";

import type { CarreraEmojisPrivateView, RoomView } from "@lolgames/protocol";
import type { Champion } from "@/lib/champions";
import { CarreraAnswerStatus } from "./CarreraAnswerStatus";
import { CarreraRevealCard } from "./CarreraRevealCard";
import { ChampionPicker } from "./ChampionPicker";
import { Timer } from "./Timer";

type Props = { room: RoomView; priv: CarreraEmojisPrivateView | null; champions: Champion[]; isHost: boolean; resetting: boolean; onAnswer: (id: string) => void; onReset: (mode?: "carrera-emojis") => void };

export function CarreraEmojisGame({ room, priv, champions, isHost, resetting, onAnswer, onReset }: Props) {
  const game = room.game?.mode === "carrera-emojis" ? room.game : null;
  if (!game) return null;
  const answered = priv?.hasAnswered ?? false;
  const winner = room.players.find((player) => player.playerId === game.winnerId);
  const privateTarget = priv?.revealedTarget ?? null;
  const publicTarget = game.phase !== "CLUES" ? game.target : null;
  const revealTarget = publicTarget ?? privateTarget;
  const showPrivateReveal = !publicTarget && Boolean(privateTarget);
  const revealed = game.clues[0]?.emojis ?? [];
  return <div className={`game-shell carrera-layout carrera-emojis-layout${revealTarget ? " has-reveal" : ""}`}>
     <div className="center carrera-heading"><div className="eyebrow">Carrera de emojis · ronda {game.round + 1}/{game.totalRounds}</div><h1>{game.phase === "CLUES" ? "Descubre el campeón." : game.phase === "FINISHED" ? "Carrera terminada" : "Respuesta revelada"}</h1><div className="timerbox"><Timer endsAt={game.phaseEndsAt} serverTime={room.serverTime} totalMs={room.settings.carreraEmojis.clueSeconds * 1000} label={`Pista ${game.clueIndex + 1}/4`} /></div></div>
    {revealTarget ? <CarreraRevealCard champion={revealTarget} eyebrow="El campeón era" note={showPrivateReveal ? "¡Acertaste! Solo tú ves esta confirmación. Los demás siguen adivinando." : undefined} /> : null}
    <section className="glass carrera-emojis-clues"><div className="emoji-clue-grid">{Array.from({ length: 4 }, (_, index) => <div className={`emoji-clue-card${index < revealed.length ? " is-revealed" : " is-hidden"}`} key={index}><span className="emoji-clue-number">{index + 1}</span><span className="emoji-clue-value">{revealed[index] ?? "?"}</span></div>)}</div>{game.phase === "CLUES" && !answered ? <ChampionPicker champions={champions} onPick={onAnswer} placeholder="¿Qué campeón es?" /> : showPrivateReveal ? null : <CarreraAnswerStatus answered={answered} winnerName={winner?.name ?? null} targetName={game.target?.name ?? null} />}</section>
    <aside className="panel carrera-sidebar"><div className="eyebrow">Puntuación</div>{room.players.slice().sort((a, b) => b.score - a.score).map((player) => <div className="score-row" key={player.playerId}><span>{player.name}</span><strong>{player.score}</strong></div>)}{game.phase === "FINISHED" && isHost ? <div className="result-actions"><button className="primary" disabled={resetting} onClick={() => onReset("carrera-emojis")}>Repetir emojis →</button></div> : null}</aside>
  </div>;
}
