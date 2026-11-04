"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { PictionaryPrivateView, RoomView } from "@lolgames/protocol";
import type { Champion } from "@/lib/champions";
import { ChampionPicker } from "./ChampionPicker";
import { Timer } from "./Timer";

type Point = { x: number; y: number; color?: string; width?: number };
type Props = { room: RoomView; me: string | null; priv: PictionaryPrivateView | null; champions: Champion[]; isHost: boolean; resetting: boolean; onStroke: (points: Point[]) => void; onUndo: () => void; onFill: (x: number, y: number, color: string) => void; onGuess: (championId: string) => void; onReset: (mode?: "bomba" | "impostor" | "pictionary") => void };

const COLORS = ["#14284b", "#c0392b", "#2d8a56", "#7b4bb7", "#e09b2d", "#111111"];
const W = 900;
const H = 600;

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Point[]) {
  if (stroke.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(stroke[0]!.x * W, stroke[0]!.y * H);
  for (const point of stroke.slice(1)) ctx.lineTo(point.x * W, point.y * H);
  ctx.strokeStyle = stroke[0]!.color ?? "#14284b";
  ctx.lineWidth = (stroke[0]!.width ?? 0.006) * W;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

function floodFill(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): boolean {
  const px = Math.max(0, Math.min(W - 1, Math.floor(x * W)));
  const py = Math.max(0, Math.min(H - 1, Math.floor(y * H)));
  const image = ctx.getImageData(0, 0, W, H);
  const data = image.data;
  const start = (py * W + px) * 4;
  const target = [data[start]!, data[start + 1]!, data[start + 2]!, data[start + 3]!];
  const match = (index: number) => Math.abs(data[index]! - target[0]!) < 12 && Math.abs(data[index + 1]! - target[1]!) < 12 && Math.abs(data[index + 2]! - target[2]!) < 12;
  const parsed = color.slice(1).match(/.{2}/g)!.map((part) => parseInt(part, 16));
  if (target[0] === parsed[0] && target[1] === parsed[1] && target[2] === parsed[2]) return false;
  const queue: [number, number][] = [[px, py]];
  const seen = new Uint8Array(W * H);
  let touchesEdge = false;
  while (queue.length) {
    const [cx, cy] = queue.pop()!;
    if (cx < 0 || cx >= W || cy < 0 || cy >= H) continue;
    const pos = cy * W + cx;
    if (seen[pos]) continue;
    const index = pos * 4;
    if (!match(index)) continue;
    seen[pos] = 1;
    if (cx === 0 || cy === 0 || cx === W - 1 || cy === H - 1) touchesEdge = true;
    data[index] = parsed[0]!; data[index + 1] = parsed[1]!; data[index + 2] = parsed[2]!; data[index + 3] = 255;
    queue.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  if (touchesEdge) return false;
  ctx.putImageData(image, 0, 0);
  return true;
}

export function PictionaryGame({ room, me, priv, champions, isHost, resetting, onStroke, onUndo, onFill, onGuess, onReset }: Props) {
  const game = room.game?.mode === "pictionary" ? room.game : null;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draftRef = useRef<Point[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState(COLORS[0]!);
  const [width, setWidth] = useState(0.006);
  const [tool, setTool] = useState<"brush" | "eraser" | "fill">("brush");
  const background = game?.backgroundColor ?? "#f0ecdd";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !game) return;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = background; ctx.fillRect(0, 0, W, H);
    if (game.operations?.length) {
      for (const operation of game.operations) {
        if (operation.type === "fill") floodFill(ctx, operation.fill.x, operation.fill.y, operation.fill.color);
        else drawStroke(ctx, operation.points);
      }
    } else {
      for (const fill of game.fills ?? []) floodFill(ctx, fill.x, fill.y, fill.color);
      for (const stroke of game.strokes ?? []) drawStroke(ctx, stroke);
    }
  }, [game, background]);

  if (!game) return null;
  const drawer = room.players.find((player) => player.playerId === game.drawerId);
  const isDrawer = Boolean(me) && game.drawerId === me && game.phase === "DRAWING";

  const pointFromEvent = (event: PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement): Point => {
    const rect = canvas.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)), color: tool === "eraser" ? background : color, width };
  };

  return <div className="game-shell pictionary-layout">
    <div className="center pictionary-heading"><div className="eyebrow">Pictionary · ronda {game.roundIndex + 1}/{game.totalRounds}</div><h1>{game.phase === "DRAWING" ? (isDrawer ? "Dibuja sin decirlo." : `${drawer?.name ?? "Alguien"} está dibujando.`) : "¡Se reveló el campeón!"}</h1><div className="timerbox"><Timer endsAt={game.phaseEndsAt} serverTime={room.serverTime} totalMs={room.settings.pictionary.drawingSeconds * 1000} label={isDrawer && priv?.target ? `Dibuja: ${priv.target.name}` : "Tiempo de la ronda"} /></div></div>
    <section className="panel pictionary-scoreboard"><div className="eyebrow">Puntuación</div>{room.players.slice().sort((a, b) => b.score - a.score).map((player) => <div className="score-row" key={player.playerId}><span>{player.name}</span><strong>{player.score}</strong></div>)}</section>
    <section className="glass pictionary-board-wrap">
      <canvas ref={canvasRef} className={`pictionary-board${isDrawer ? " can-draw" : ""}`} aria-label="Lienzo de Pictionary" onPointerDown={(event) => { if (!isDrawer) return; const canvas = canvasRef.current; if (!canvas) return; const point = pointFromEvent(event, canvas); if (tool === "fill") { onFill(point.x, point.y, color); return; } try { canvas.setPointerCapture(event.pointerId); } catch {} draftRef.current = [point]; setDrawing(true); }} onPointerMove={(event) => { if (!drawing || !isDrawer) return; const canvas = canvasRef.current; if (!canvas) return; const point = pointFromEvent(event, canvas); const previous = draftRef.current.at(-1); if (!previous || draftRef.current.length >= 1000) return; const ctx = canvas.getContext("2d"); if (ctx) drawStroke(ctx, [previous, point]); draftRef.current.push(point); }} onPointerUp={(event) => { if (!drawing) return; setDrawing(false); const canvas = canvasRef.current; if (!canvas) { draftRef.current = []; return; } const point = pointFromEvent(event, canvas); const previous = draftRef.current.at(-1); if (previous) { const ctx = canvas.getContext("2d"); if (ctx) drawStroke(ctx, [previous, point]); draftRef.current.push(point); } const completed = draftRef.current.slice(0, 1000); for (let index = 0; index < completed.length - 1; index += 39) onStroke(completed.slice(index, index + 40)); draftRef.current = []; }} onPointerCancel={() => { setDrawing(false); draftRef.current = []; }} />
      <div className="pictionary-tools"><div className="pictionary-tool-modes">{([["✎", "brush", "Pincel"], ["⌫", "eraser", "Borrador"], ["▰", "fill", "Cubeta"]] as const).map(([icon, value, label]) => <button key={value} type="button" className={`pictionary-size pictionary-icon-tool${tool === value ? " selected" : ""}`} title={label} aria-label={label} onClick={() => setTool(value)}>{icon}</button>)}</div><input className="pictionary-color-wheel" type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Rueda de colores" /><div className="pictionary-colors">{COLORS.map((swatch) => <button key={swatch} type="button" className={`pictionary-swatch${color === swatch ? " selected" : ""}`} style={{ background: swatch }} onClick={() => setColor(swatch)} aria-label={`Color ${swatch}`} />)}</div><div className="pictionary-width"><span>Grosor</span><div className="pictionary-sizes">{[["•", 0.003, "Fino"], ["●", 0.006, "Medio"], ["●", 0.012, "Grueso"]].map(([icon, value, label]) => <button key={label as string} type="button" className={`pictionary-size pictionary-width-tool${width === value ? " selected" : ""}`} title={label as string} aria-label={label as string} onClick={() => setWidth(value as number)}>{icon}</button>)}</div></div><button type="button" className="secondary pictionary-clear" title="Deshacer" aria-label="Deshacer" onClick={onUndo}>↶</button></div>
      <div className="pictionary-hint">{isDrawer ? "Tu objetivo está oculto para los demás." : "Adivina el campeón sin pedir pistas."}</div>
    </section>
    {game.phase === "DRAWING" && !isDrawer ? <section className="panel pictionary-guess"><h2>¿Qué campeón es?</h2><ChampionPicker champions={champions} onPick={onGuess} submitLabel="Enviar intento" /></section> : null}
    {game.phase === "DRAWING" && isDrawer && priv?.target ? <section className="glass private pictionary-target"><div className="eyebrow">Solo para ti</div><div className="champ-img"><img src={priv.target.imageUrl} alt={priv.target.name} /></div><div className="champ">{priv.target.name}</div></section> : null}
    {game.phase === "REVEAL" ? <section className="glass private pictionary-target"><div className="eyebrow">Campeón de la ronda</div>{game.target ? <><div className="champ-img"><img src={game.target.imageUrl} alt={game.target.name} /></div><div className="champ">{game.target.name}</div></> : null}<p className="muted">{game.guesses.length ? `${game.guesses.length} jugador(es) acertaron.` : "Nadie acertó esta vez."}</p>{isHost ? <div className="result-actions"><button className="primary" disabled={resetting} onClick={() => onReset("pictionary")}>Repetir Pictionary →</button><button className="secondary" disabled={resetting} onClick={() => onReset()}>Cambiar modo</button></div> : null}</section> : null}
  </div>;
}
