"use client";

import type { ModeId, RoomView } from "@lolgames/protocol";

type Props = { room: RoomView; me: string | null; resetting: boolean; onReset: (mode?: ModeId) => void };
const LABELS: Record<ModeId, string> = { bomba: "Bomba", impostor: "Impostor", pictionary: "Pictionary", "quien-soy": "¿Quién soy?", carrera: "Carrera de pistas", "carrera-sonido": "Carrera de pistas: Sonido", imitacion: "Imitación de voz", descripcion: "Descripción", duo: "Dúo a ciegas", party: "Party" };

export function ResultsScreen({ room, me, resetting, onReset }: Props) {
  const ranking = [...room.players].sort((a, b) => b.score - a.score);
  const podium = ranking.slice(0, 3);
  const isHost = room.hostId === me;
  return <section className="results-screen">
    <div className="results-heading"><div className="star">✦</div><div className="eyebrow">Fin de la partida · {LABELS[room.mode]}</div><h1>Podio</h1><p className="muted">La partida terminó. Estos son los resultados.</p></div>
    <div className="podium">{podium.map((player, index) => <div className={`podium-card place-${index + 1}`} key={player.playerId}><span className="podium-medal">{index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}</span><div className="avatar"><img src={player.avatar.imageUrl} alt="" /></div><strong>{player.name}</strong><b>{player.score} pts</b></div>)}</div>
    <div className="results-ranking">{ranking.slice(3).map((player, index) => <div className="results-rank" key={player.playerId}><span>{index + 4}</span><div className="avatar"><img src={player.avatar.imageUrl} alt="" /></div><strong>{player.name}</strong><b>{player.score} pts</b></div>)}</div>
    <div className="results-actions">{isHost ? <><button className="primary" disabled={resetting} onClick={() => onReset(room.mode)}>Repetir {LABELS[room.mode]} →</button><button className="secondary" disabled={resetting} onClick={() => onReset()}>Cambiar modo</button></> : <p className="hint">Esperando al anfitrión para repetir la partida…</p>}</div>
  </section>;
}
