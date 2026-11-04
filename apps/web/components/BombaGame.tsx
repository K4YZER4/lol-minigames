"use client";

import { useEffect, useState } from "react";
import type { BombaPrivateView, RoomView } from "@lolgames/protocol";
import type { Champion } from "@/lib/champions";
import { ChampionPicker } from "./ChampionPicker";

type Flash = { type: string; key: number } | null;
type Props = { room: RoomView; me: string | null; priv: BombaPrivateView | null; champions: Champion[]; flash: Flash; onAnswer: (championId: string) => void; isHost: boolean; resetting: boolean; onReset: (mode?: "bomba" | "impostor") => void };

const FLASH_CLASS: Record<string, string> = { "bomba:correct": "flash-correct", "bomba:wrong": "flash-wrong", "bomba:explosion": "flash-explosion" };

export function BombaGame({ room, me, priv, champions, flash, onAnswer, isHost, resetting, onReset }: Props) {
  const game = room.game?.mode === "bomba" ? room.game : null;
  const [displayedClue, setDisplayedClue] = useState(game?.clue ?? null);
  useEffect(() => {
    if (game && flash?.type !== "bomba:explosion") setDisplayedClue(game.clue);
  }, [game?.clue, flash?.type]);
  if (!game) return null;
  const active = room.players.find((player) => player.playerId === game.activePlayerId);
  const isMyTurn = Boolean(me) && game.activePlayerId === me && !game.finished;
  const survivors = room.players.filter((player) => !player.eliminated);
  const flashClass = flash ? (FLASH_CLASS[flash.type] ?? "") : "";
  return <div className="game-shell bomba-layout">
    {flash?.type === "bomba:explosion" ? <div className="explosion-overlay" role="alert"><div className="explosion-burst">✹</div><strong>¡BOOM!</strong><span>La bomba explotó</span></div> : null}
    <div className="center">
      {game.finished ? <div className="eyebrow">Fin de la partida</div> : null}
      <h1>{game.finished ? `Sobrevivió ${survivors.map((p) => p.name).join(", ") || "nadie"}` : (active?.name ?? "—")}</h1>
      {game.finished ? <section className="glass clue result-clue"><div className="eyebrow">Fin de la partida</div><div className="result-symbol">✹</div><p className="muted">{game.explosions} {game.explosions === 1 ? "explosión" : "explosiones"} en total.</p>{isHost ? <div className="result-actions"><button className="primary" disabled={resetting} onClick={() => onReset("bomba")}>Repetir Bomba →</button><button className="secondary" disabled={resetting} onClick={() => onReset()}>Cambiar modo</button></div> : <p className="hint" style={{ marginTop: 12 }}>Esperando al anfitrión para otra partida…</p>}</section> : <section className={`glass clue ${flashClass}`}>
        <div className="eyebrow">¿De quién es esta habilidad?</div>
        <div className="clue-frame">{displayedClue ? <img src={displayedClue.imageUrl} alt="Pista visual" /> : <span className="hint">Sin pista</span>}</div>
        <div className="heat"><div className={`heat-fill heat-${game.heat}`} /></div>
        <p className="mini" style={{ marginTop: 10 }}>{game.heat === "cold" ? "La mecha está fría" : game.heat === "warm" ? "La mecha se está calentando" : "¡La mecha está por estallar!"}</p>
      </section>}
      {!game.finished && isMyTurn ? <div className="answer"><ChampionPicker champions={champions} onPick={onAnswer} submitLabel="Pasar bomba →" /></div> : null}
    </div>

    <section className="panel">
      <div className="bar" style={{ marginTop: 0 }}><div className="eyebrow">Supervivientes</div><span className="hint">{game.explosions} {game.explosions === 1 ? "explosión" : "explosiones"}</span></div>
      <div className="players">{room.players.map((player) => <div key={player.playerId} className={`player${player.playerId === game.activePlayerId && !game.finished ? " active" : ""}${player.eliminated ? " dead" : ""}`}>
        <div className="avatar"><img src={player.avatar.imageUrl} alt="" /></div><div>{player.name}{player.playerId === me ? <span className="tag" style={{ marginLeft: 5 }}>tú</span> : null}</div>
        <div className="hearts">{Array.from({ length: room.settings.bomba.lives }).map((_, i) => <span key={i} className={i >= (player.lives ?? 0) ? "lost" : ""}>♥</span>)}</div>
        {player.eliminated ? <span className="tag tag-red">fuera</span> : null}
      </div>)}</div>
    </section>
  </div>;
}
