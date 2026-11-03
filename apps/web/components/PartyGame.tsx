"use client";
import type { PartyGameView, PartyPrivateView, RoomView } from "@lolgames/protocol";
import type { Champion } from "@/lib/champions";
import { Timer } from "./Timer";

export function PartyGame({ room, me, priv, champions, onGuess }: { room: RoomView; me: string | null; priv: PartyPrivateView | null; champions: Champion[]; onGuess: (id: string) => void }) {
  const game = room.game as PartyGameView;
  const active = room.players.find((p) => p.playerId === game.activePlayerId);
  const canGuess = !priv?.isActive && !priv?.hasGuessed && game.phase === "GUESSING";
  return <div className="game-shell"><section className="panel center"><div className="eyebrow">Party · ronda {game.round}/{game.totalRounds}</div><h1>{priv?.isActive ? "Describe sin decirlo." : `${active?.name ?? "Alguien"} tiene el campeón`}</h1><p className="muted">Categoría: {game.category === "audio" ? "Audio (no disponible)" : "Roles"}</p><Timer endsAt={game.phaseEndsAt} serverTime={room.serverTime} totalMs={room.settings.party.turnSeconds * 1000} label={`${game.guesses.length}/${Math.max(0, room.players.length - 1)} respuestas`} />{priv?.isActive ? <p className="hint">Tu objetivo privado es <strong>{priv.target?.name}</strong>. Comunícalo por tu canal de voz.</p> : <div className="chips">{champions.map((champion) => <button key={champion.id} className="chip" disabled={!canGuess} onClick={() => onGuess(champion.id)}>{champion.name}</button>)}</div>}<p className="hint">{game.phase === "FINISHED" ? "Partida terminada." : "La puntuación y el cambio de ronda los decide el servidor."}</p></section></div>;
}
