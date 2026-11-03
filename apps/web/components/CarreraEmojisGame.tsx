"use client";

import type { CarreraEmojisPrivateView, RoomView } from "@lolgames/protocol";
import type { Champion } from "@/lib/champions";
import { ChampionPicker } from "./ChampionPicker";
import { Timer } from "./Timer";

type Props = { room: RoomView; priv: CarreraEmojisPrivateView | null; champions: Champion[]; isHost: boolean; resetting: boolean; onAnswer: (id: string) => void; onReset: (mode?: "carrera-emojis") => void };

export function CarreraEmojisGame({ room, priv, champions, isHost, resetting, onAnswer, onReset }: Props) {
  const game = room.game?.mode === "carrera-emojis" ? room.game : null;
  if (!game) return null;
  const answered = priv?.hasAnswered ?? false;
  const winner = room.players.find((player) => player.playerId === game.winnerId);
  const revealed = game.clues[0]?.emojis ?? [];
  return <div className={`game-shell carrera-layout carrera-emojis-layout${game.phase !== "CLUES" && game.target ? " has-reveal" : ""}`}>
    <div className="center carrera-heading"><div className="eyebrow">Carrera de emojis · ronda {game.round + 1}/{game.totalRounds}</div><h1>{game.phase === "CLUES" ? "Descubre el campeón." : game.phase === "FINISHED" ? "Carrera terminada" : "Respuesta revelada"}</h1><p className="muted">Se revela un emoji por pista. Adivina rápido para ganar más puntos.</p><div className="timerbox"><Timer endsAt={game.phaseEndsAt} serverTime={room.serverTime} totalMs={room.settings.carreraEmojis.clueSeconds * 1000} label={`Pista ${game.clueIndex + 1}/4`} /></div></div>
    {game.phase !== "CLUES" && game.target ? <section className="panel carrera-reveal-card"><div className="eyebrow">El campeón era</div><img src={game.target.imageUrl} alt={game.target.name} /><h2>{game.target.name}</h2></section> : null}
    <section className="glass carrera-emojis-clues"><div className="emoji-clue-grid">{Array.from({ length: 4 }, (_, index) => <div className={`emoji-clue-card${index < revealed.length ? " is-revealed" : " is-hidden"}`} key={index}><span className="emoji-clue-number">{index + 1}</span><span className="emoji-clue-value">{revealed[index] ?? "?"}</span></div>)}</div>{game.phase === "CLUES" && !answered ? <ChampionPicker champions={champions} onPick={onAnswer} placeholder="¿Qué campeón es?" /> : <p className="hint carrera-result">{answered ? "Respuesta registrada. Espera el resultado." : winner ? `${winner.name} ganó la ronda.` : game.target ? `Era ${game.target.name}.` : "Sin ganador en esta ronda."}</p>}</section>
    <aside className="panel carrera-sidebar"><div className="eyebrow">Puntuación</div>{room.players.slice().sort((a, b) => (game.scores[b.playerId] ?? b.score) - (game.scores[a.playerId] ?? a.score)).map((player) => <div className="score-row" key={player.playerId}><span>{player.name}</span><strong>{game.scores[player.playerId] ?? player.score}</strong></div>)}{game.phase === "FINISHED" && isHost ? <div className="result-actions"><button className="primary" disabled={resetting} onClick={() => onReset("carrera-emojis")}>Repetir emojis →</button></div> : null}</aside>
  </div>;
}
