"use client";

import { useEffect, useState } from "react";
import type { ImpostorPrivateView, RoomView } from "@lolgames/protocol";
import { Timer } from "./Timer";

type Props = { room: RoomView; me: string | null; priv: ImpostorPrivateView | null; onAck: () => void; onClue: (text: string) => void; onVote: (targetId: string | null) => void; isHost: boolean; resetting: boolean; onReset: (mode?: "bomba" | "impostor") => void };
const PHASE_LABEL: Record<string, string> = { ASSIGNMENT: "Reparto de campeones", CLUES: "Ronda de pistas", DISCUSSION: "Discusión", VOTING: "Votación secreta", REVEAL: "Revelación" };

export function ImpostorGame({ room, me, priv, onAck, onClue, onVote, isHost, resetting, onReset }: Props) {
  const game = room.game?.mode === "impostor" ? room.game : null;
  const [acked, setAcked] = useState(false); const [clue, setClue] = useState(""); const [picked, setPicked] = useState<string | null>(null); const [revealed, setRevealed] = useState(false);
  const phase = game?.phase;
  useEffect(() => { setAcked(false); setClue(""); setPicked(null); setRevealed(false); }, [phase]);
  if (!game) return null;
  const nameOf = (id: string) => room.players.find((p) => p.playerId === id)?.name ?? "???";
  const current = game.clueOrder[game.clueIndex];
  const myTurn = game.phase === "CLUES" && current === me;
  const champion = priv?.mode === "impostor" ? priv.champion : null;
  const hasVoted = priv?.mode === "impostor" ? priv.hasVoted : false;
  const s = room.settings.impostor;
  const totalMs = game.phase === "ASSIGNMENT" ? s.assignmentSeconds * 1000 : game.phase === "CLUES" ? s.clueSeconds * 1000 : game.phase === "DISCUSSION" ? s.discussionSeconds * 1000 : s.voteSeconds * 1000;
  const headline: Record<string, string> = { ASSIGNMENT: "Que no te lean tan fácil.", CLUES: "Una pista cada uno.", DISCUSSION: "Ahora sí, sospechen.", VOTING: "¿Quién es el infiltrado?", REVEAL: game.reveal?.caught ? "Atraparon al infiltrado." : "El infiltrado se salió con la suya." };
  const orderCards = game.clueOrder.map((id, index) => {
    const player = room.players.find((candidate) => candidate.playerId === id);
    return { id, index, player, status: index < game.clueIndex ? "done" : index === game.clueIndex && game.phase === "CLUES" ? "current" : "pending" } as const;
  });
  return <div className="game-shell">
     <div className="center"><div className="eyebrow">{PHASE_LABEL[game.phase]}</div><h1>{headline[game.phase]}</h1>{game.phase === "CLUES" ? <p className="muted">Turno de {nameOf(current)}</p> : null}{game.phase !== "REVEAL" ? <div className="timerbox"><Timer endsAt={game.phaseEndsAt} serverTime={room.serverTime} totalMs={totalMs} label={`${game.clues.length}/${game.clueOrder.length} pistas · ${game.votesSubmitted.length}/${game.clueOrder.length} votos`} /></div> : null}</div>

     {game.phase === "ASSIGNMENT" ? <section className="glass private"><div className="star">◈</div><div className="eyebrow">Solo para tus ojos</div>{champion && revealed ? <><div className="champ-img"><img src={champion.imageUrl} alt={champion.name} /></div><div className="champ">{champion.name}</div></> : <div className="champ">•••••</div>}<button className="secondary" onClick={() => setRevealed((v) => !v)}>{revealed ? "Ocultar campeón" : "Ver mi campeón"}</button><div style={{ marginTop: 20 }}>{acked ? <span className="hint">Listo. Esperando a los demás…</span> : <button className="primary" onClick={() => { setAcked(true); onAck(); }}>Ya lo vi</button>}</div></section> : null}

    {game.phase === "CLUES" || game.phase === "DISCUSSION" ? <section className="panel"><div className="eyebrow">Orden de participación</div><div className="turn-order">{orderCards.map((card) => <div key={card.id} className={`turn-card ${card.status}`}><div className="turn-number">{card.index + 1}</div><div className="avatar">{card.player ? <img src={card.player.avatar.imageUrl} alt="" /> : null}</div><strong>{card.player?.name ?? "???"}</strong><span>{card.status === "current" ? "hablando" : card.status === "done" ? "listo" : "pendiente"}</span></div>)}</div><div className="divider" /><h2>Pistas</h2>{game.clues.length === 0 ? <p className="hint">Todavía nadie dio una pista.</p> : <div className="clue-list">{game.clues.map((entry, i) => <div key={`${entry.playerId}-${i}`} className="clue-row"><span className="clue-author">{nameOf(entry.playerId)}</span><span className="clue-text">{entry.text}</span></div>)}</div>}{myTurn ? <form className="row" style={{ marginTop: 14 }} onSubmit={(e) => { e.preventDefault(); const text = clue.trim(); if (!text) return; setClue(""); onClue(text); }}><input className="input" style={{ flex: 1, minWidth: 200 }} maxLength={80} value={clue} placeholder="Tu pista, sin el nombre del campeón" onChange={(e) => setClue(e.target.value)} autoFocus /><button className="primary" type="submit" disabled={!clue.trim()}>Enviar</button></form> : game.phase === "CLUES" ? <p className="hint" style={{ marginTop: 12 }}>Le toca a {nameOf(current)}.</p> : null}</section> : null}

    {game.phase === "VOTING" ? <section className="panel"><h2>¿Quién es el infiltrado?</h2>{hasVoted ? <p className="hint">Voto registrado. Espera la revelación.</p> : <><div className="vote">{room.players.map((player) => <button key={player.playerId} className={`vote-btn${picked === player.playerId ? " is-picked" : ""}`} disabled={player.playerId === me} onClick={() => { setPicked(player.playerId); onVote(player.playerId); }}>{player.name}{player.playerId === me ? " (tú)" : ""}</button>)}</div><button className="textbutton" onClick={() => { setPicked(null); onVote(null); }}>Abstenerse</button></>}</section> : null}

    {game.phase === "REVEAL" && game.reveal ? <section className="panel"><div className="row"><h2>Resultado</h2><span className="tag">{game.reveal.caught ? "ganó la tripulación" : "ganó el infiltrado"}</span></div><div className="reveal-grid">{room.players.map((player) => { const info = game.reveal?.assignment[player.playerId]; const impostor = game.reveal?.impostorIds.includes(player.playerId); return <div key={player.playerId} className={`reveal-card${impostor ? " is-impostor" : ""}`}>{info ? <img src={info.imageUrl} alt={info.name} /> : null}<div className="who">{player.name}</div><div className="what">{info?.name ?? "sin campeón"}</div>{impostor ? <div className="tag tag-red">infiltrado</div> : null}</div>; })}</div><div className="divider" /><div className="clue-list">{game.reveal.winners.map((id) => <div key={id} className="clue-row"><span className="clue-author">Ganó</span><span className="clue-text">{nameOf(id)}</span></div>)}</div>{isHost ? <div className="result-actions"><button className="primary" disabled={resetting} onClick={() => onReset("impostor")}>Repetir Impostor →</button><button className="secondary" disabled={resetting} onClick={() => onReset()}>Cambiar modo</button></div> : <p className="hint" style={{ marginTop: 14 }}>Esperando al anfitrión para otra partida…</p>}</section> : null}
  </div>;
}
