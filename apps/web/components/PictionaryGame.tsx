"use client";

import { useState } from "react";
import type { PointerEvent } from "react";
import type { PictionaryPrivateView, RoomView } from "@lolgames/protocol";
import type { Champion } from "@/lib/champions";
import { ChampionPicker } from "./ChampionPicker";
import { Timer } from "./Timer";

type Point = { x: number; y: number };
type Props = {
  room: RoomView;
  me: string | null;
  priv: PictionaryPrivateView | null;
  champions: Champion[];
  isHost: boolean;
  resetting: boolean;
  onStroke: (points: Point[]) => void;
  onGuess: (championId: string) => void;
  onReset: (mode?: "bomba" | "impostor" | "pictionary") => void;
};

function pointsAttribute(points: Point[]) {
  return points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
}

export function PictionaryGame({ room, me, priv, champions, isHost, resetting, onStroke, onGuess, onReset }: Props) {
  const game = room.game?.mode === "pictionary" ? room.game : null;
  const [draft, setDraft] = useState<Point[]>([]);
  const [drawing, setDrawing] = useState(false);
  if (!game) return null;

  const drawer = room.players.find((player) => player.playerId === game.drawerId);
  const isDrawer = Boolean(me) && game.drawerId === me && game.phase === "DRAWING";
  const pointFromEvent = (event: PointerEvent<SVGSVGElement>, canvas: SVGSVGElement): Point => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
  };
  const strokes = Array.isArray(game.strokes) ? game.strokes : [];

  return <div className="game-shell pictionary-layout">
    <div className="center pictionary-heading"><div className="eyebrow">Pictionary · ronda {game.roundIndex + 1}/{game.totalRounds}</div><h1>{game.phase === "DRAWING" ? (isDrawer ? "Dibuja sin decirlo." : `${drawer?.name ?? "Alguien"} está dibujando.`) : "¡Se reveló el campeón!"}</h1><div className="timerbox"><Timer endsAt={game.phaseEndsAt} serverTime={room.serverTime} totalMs={room.settings.pictionary.drawingSeconds * 1000} label={isDrawer && priv?.target ? `Dibuja: ${priv.target.name}` : "Tiempo de la ronda"} /></div></div>

    <section className="glass pictionary-board-wrap">
      <svg className={`pictionary-board${isDrawer ? " can-draw" : ""}`} viewBox="0 0 1 1" role="img" aria-label="Lienzo de Pictionary" onPointerDown={(event) => { if (!isDrawer) return; const canvas = event.currentTarget; try { canvas.setPointerCapture(event.pointerId); } catch { /* el puntero pudo salir del lienzo */ } setDrawing(true); setDraft([pointFromEvent(event, canvas)]); }} onPointerMove={(event) => { if (!drawing || !isDrawer) return; const canvas = event.currentTarget; setDraft((points) => points.length >= 40 ? points : [...points, pointFromEvent(event, canvas)]); }} onPointerUp={(event) => { if (!drawing) return; setDrawing(false); try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ya fue liberado */ } if (draft.length > 1) onStroke(draft.slice(0, 40)); setDraft([]); }} onPointerCancel={() => { setDrawing(false); setDraft([]); }}>
        <rect x="0" y="0" width="1" height="1" className="pictionary-paper" />
        {strokes.map((stroke, index) => <polyline key={index} points={pointsAttribute(stroke)} className="pictionary-line" />)}
        {draft.length > 1 ? <polyline points={pointsAttribute(draft)} className="pictionary-line draft" /> : null}
      </svg>
      {isDrawer ? <div className="pictionary-hint">Tu objetivo está oculto para los demás. Dibuja con el mouse o el dedo.</div> : <div className="pictionary-hint">Adivina el campeón sin pedir pistas.</div>}
    </section>

    {game.phase === "DRAWING" && !isDrawer ? <section className="panel pictionary-guess"><h2>¿Qué campeón es?</h2><ChampionPicker champions={champions} onPick={onGuess} submitLabel="Enviar intento" /></section> : null}
    {game.phase === "DRAWING" && isDrawer && priv?.target ? <section className="glass private pictionary-target"><div className="eyebrow">Solo para ti</div><div className="champ-img"><img src={priv.target.imageUrl} alt={priv.target.name} /></div><div className="champ">{priv.target.name}</div></section> : null}
    {game.phase === "REVEAL" ? <section className="glass private pictionary-target"><div className="eyebrow">Campeón de la ronda</div>{game.target ? <><div className="champ-img"><img src={game.target.imageUrl} alt={game.target.name} /></div><div className="champ">{game.target.name}</div></> : null}<p className="muted">{game.guesses.length ? `${game.guesses.length} jugador(es) acertaron.` : "Nadie acertó esta vez."}</p>{isHost ? <div className="result-actions"><button className="primary" disabled={resetting} onClick={() => onReset("pictionary")}>Repetir Pictionary →</button><button className="secondary" disabled={resetting} onClick={() => onReset()}>Cambiar modo</button></div> : null}</section> : null}
  </div>;
}
