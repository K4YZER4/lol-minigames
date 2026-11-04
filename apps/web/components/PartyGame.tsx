"use client";
import type { PartyGameView, PartyPrivateView, RoomView } from "@lolgames/protocol";
import type { Champion } from "@/lib/champions";
import { ChampionPicker } from "./ChampionPicker";
import { Timer } from "./Timer";

export function PartyGame({ room, me, priv, champions, onGuess }: { room: RoomView; me: string | null; priv: PartyPrivateView | null; champions: Champion[]; onGuess: (id: string) => void }) {
  const game = room.game as PartyGameView;
  const active = room.players.find((p) => p.playerId === game.activePlayerId);
  const canGuess = !priv?.isActive && !priv?.hasGuessed && game.phase === "GUESSING";
  return <div className="game-shell party-layout"><section className="panel center party-heading"><div className="eyebrow">Party · ronda {game.round}/{game.totalRounds}</div><h1>{priv?.isActive ? "Describe sin decirlo." : `${active?.name ?? "Alguien"} tiene el campeón`}</h1><p className="muted">Los demás intentan descubrir el campeón del jugador activo.</p><Timer endsAt={game.phaseEndsAt} serverTime={room.serverTime} totalMs={room.settings.party.turnSeconds * 1000} label={`${game.guesses.length}/${Math.max(0, room.players.length - 1)} respuestas`} /></section><section className="glass party-main">{priv?.isActive ? <div className="party-target"><div className="eyebrow">Tu objetivo privado</div>{priv.target ? <><img src={priv.target.imageUrl} alt={priv.target.name} /><h2>{priv.target.name}</h2></> : <p className="hint">Cargando objetivo…</p>}<p className="hint">Descríbelo por Discord sin decir su nombre.</p></div> : <><div className="eyebrow">Adivina el objetivo de {active?.name ?? "otro jugador"}</div>{canGuess ? <ChampionPicker champions={champions} onPick={onGuess} submitLabel="Enviar respuesta" placeholder="¿Qué campeón recibió?" /> : <p className="hint">{priv?.hasGuessed ? "Respuesta registrada. Espera al resultado." : "Espera tu turno para responder."}</p>}</>}</section><aside className="panel party-sidebar"><div className="eyebrow">Puntuación</div>{room.players.slice().sort((a, b) => b.score - a.score).map((player) => <div className="score-row" key={player.playerId}><span>{player.name}</span><strong>{player.score}</strong></div>)}</aside></div>;
}
