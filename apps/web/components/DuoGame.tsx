"use client";
import type { DuoPrivateView, RoomView } from "@lolgames/protocol";
import type { Champion } from "@/lib/champions";
import { ChampionPicker } from "@/components/ChampionPicker";

type Props = { room: RoomView; me: string | null; priv: DuoPrivateView | null; champions: Champion[]; isHost: boolean; resetting: boolean; onSubmit: (id: string) => void; onReset: (mode?: "duo") => void };
export function DuoGame({ room, me, priv, champions, isHost, resetting, onSubmit, onReset }: Props) {
  const game = room.game?.mode === "duo" ? room.game : null;
  if (!game) return null;
  const partner = priv?.partnerId ? room.players.find((p) => p.playerId === priv.partnerId)?.name : null;
  return <div className="game-shell">
    {game.phase === "GUESSING" ? <section className="glass private"><div className="eyebrow">Tu información es privada</div><h2>{priv?.ownChampion?.name ?? "Cargando…"}</h2><p className="muted">Tu pareja es {partner ?? "un jugador"}. Elige el campeón que crees que recibió.</p>{priv?.hasSubmitted ? <p className="hint">Respuesta guardada. Espera la revelación.</p> : <ChampionPicker champions={champions} onPick={onSubmit} submitLabel="Adivinar campeón" />}</section> : <section className="panel"><div className="eyebrow">Revelación</div><h2>¿Qué tan bien se conocen?</h2>{game.pairs.map((pair) => <div className="reveal-grid" key={pair.playerIds.join("-")}>{pair.playerIds.map((id) => { const player = room.players.find((p) => p.playerId === id); const guess = pair.guesses[id]; return <div className="reveal-card" key={id}><div className="who">{player?.name}</div><div className="what">{guess?.name ?? "Sin respuesta"}</div><span className={`tag ${pair.correct?.[id] ? "tag-green" : "tag-red"}`}>{pair.correct?.[id] ? "+1 punto" : "falló"}</span></div>; })}</div>)}{isHost ? <div className="result-actions"><button className="primary" disabled={resetting} onClick={() => onReset("duo")}>Repetir Dúo →</button><button className="secondary" disabled={resetting} onClick={() => onReset()}>Cambiar modo</button></div> : <p className="hint">Esperando al anfitrión para otra partida…</p>}</section>}
  </div>;
}
