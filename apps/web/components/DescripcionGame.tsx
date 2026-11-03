"use client";
import { useState } from "react";
import type { DescripcionPrivateView, RoomView } from "@lolgames/protocol";
import { Timer } from "./Timer";

type Props = { room: RoomView; me: string | null; priv: DescripcionPrivateView | null; isHost: boolean; resetting: boolean; onClue: (text: string) => void; onGuess: (text: string) => void; onReset: (mode?: "descripcion") => void };
export function DescripcionGame({ room, me, priv, isHost, resetting, onClue, onGuess, onReset }: Props) {
  const game = room.game?.mode === "descripcion" ? room.game : null;
  const [text, setText] = useState("");
  if (!game) return null;
  const describer = room.players.find((p) => p.playerId === game.describerId);
  const mine = game.describerId === me && game.phase === "DESCRIPTION";
  const submit = () => { const value = text.trim(); if (!value) return; (mine ? onClue : onGuess)(value); setText(""); };
  return <div className="game-shell">
    <section className="panel center"><div className="eyebrow">Descripción · ronda {game.roundIndex + 1}/{game.totalRounds}</div>
      <h1>{game.phase === "REVEAL" ? "¡Objetivo revelado!" : mine ? "Describe sin decir el nombre." : `${describer?.name ?? "Alguien"} está describiendo.`}</h1>
      <div className="timerbox"><Timer endsAt={game.phaseEndsAt} serverTime={room.serverTime} totalMs={room.settings.descripcion.turnSeconds * 1000} label={mine && priv?.target ? `Objetivo: ${priv.target.name}` : "Tiempo del turno"} /></div>
    </section>
    <section className="glass private"><div className="eyebrow">Pistas del turno</div>{game.clues.length ? game.clues.map((clue, i) => <p key={`${clue.playerId}-${i}`} className="clue">“{clue.text}”</p>) : <p className="muted">Todavía no hay pistas.</p>}
      {mine && priv?.target ? <p className="hint">Prohibido: {priv.forbiddenWords.join(", ") || "el nombre del campeón"}</p> : null}
    </section>
    {game.phase === "DESCRIPTION" && !mine ? <section className="panel"><h2>Tu respuesta</h2><div className="row"><input className="input" value={text} maxLength={80} placeholder="Escribe el nombre o una frase…" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} /><button className="primary" onClick={submit}>Adivinar</button></div></section> : null}
    {game.phase === "DESCRIPTION" && mine ? <section className="panel"><h2>Tu pista</h2><div className="row"><input className="input" value={text} maxLength={120} placeholder="Describe apariencia, historia o habilidades…" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} /><button className="primary" onClick={submit}>Enviar pista</button></div></section> : null}
    {game.guesses.length ? <section className="panel"><div className="eyebrow">Intentos</div>{game.guesses.map((guess, i) => <p key={`${guess.playerId}-${i}`} className="hint">{room.players.find((p) => p.playerId === guess.playerId)?.name}: {guess.text}{guess.correct ? " ✓" : ""}</p>)}</section> : null}
    {game.phase === "REVEAL" ? <section className="glass private"><div className="eyebrow">Respuesta</div><h2>{game.target?.name ?? "Sin acierto"}</h2>{isHost ? <div className="result-actions"><button className="primary" disabled={resetting} onClick={() => onReset("descripcion")}>Repetir descripción →</button><button className="secondary" disabled={resetting} onClick={() => onReset()}>Cambiar modo</button></div> : null}</section> : null}
  </div>;
}
