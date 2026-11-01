"use client";

import type { RoomView, UnicaPrivateView } from "@lolgames/protocol";
import type { Champion } from "@/lib/champions";
import { ChampionPicker } from "./ChampionPicker";
import { Timer } from "./Timer";

type Props = { room: RoomView; me: string | null; priv: UnicaPrivateView | null; champions: Champion[]; isHost: boolean; resetting: boolean; onSubmit: (championId: string) => void; onReset: (mode?: "bomba" | "impostor" | "pictionary" | "unica") => void };

export function UnicaGame({ room, priv, champions, isHost, resetting, onSubmit, onReset }: Props) {
  const game = room.game?.mode === "unica" ? room.game : null;
  if (!game) return null;
  return <div className="game-shell unica-layout">
    <div className="center"><div className="eyebrow">Respuesta única</div><h1>{game.phase === "SUBMISSION" ? "Elige sin repetir." : "Resultados"}</h1><p className="muted">Categoría: <strong>{game.category}</strong></p><div className="timerbox"><Timer endsAt={game.phaseEndsAt} serverTime={room.serverTime} totalMs={room.settings.unica.answerSeconds * 1000} label={`${game.submitted.length}/${room.players.length} respuestas`} /></div></div>
    {game.phase === "SUBMISSION" ? <section className="glass private"><div className="star">✧</div><div className="eyebrow">Tu respuesta es privada</div>{priv?.hasSubmitted ? <><div className="champ-img">{priv.yourAnswer ? <img src={priv.yourAnswer.imageUrl} alt={priv.yourAnswer.name} /> : null}</div><div className="champ">{priv.yourAnswer?.name}</div><p className="muted">Respuesta guardada. Espera la revelación.</p></> : <ChampionPicker champions={champions} onPick={onSubmit} submitLabel="Guardar respuesta" />}</section> : <section className="panel"><h2>Respuestas</h2><div className="reveal-grid">{game.answers.map((answer) => { const player = room.players.find((item) => item.playerId === answer.playerId); return <div key={answer.playerId} className={`reveal-card${answer.duplicate ? " is-impostor" : ""}`}><div className="who">{player?.name}</div><div className="what">{answer.champion?.name ?? "Sin respuesta"}</div><span className={`tag ${answer.duplicate ? "tag-red" : "tag-green"}`}>{answer.duplicate ? "repetida" : answer.champion ? "+1 punto" : "sin respuesta"}</span></div>; })}</div>{isHost ? <div className="result-actions"><button className="primary" disabled={resetting} onClick={() => onReset("unica")}>Repetir Respuesta única →</button><button className="secondary" disabled={resetting} onClick={() => onReset()}>Cambiar modo</button></div> : null}</section>}
  </div>;
}
