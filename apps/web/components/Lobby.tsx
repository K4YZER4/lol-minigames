"use client";

import type { ModeId, RoomView } from "@lolgames/protocol";

type Props = {
  room: RoomView;
  me: string | null;
  onReady: (ready: boolean) => void;
  onConfigure: (patch: Record<string, unknown>) => void;
  onStart: () => void;
};

const FUSE_PRESETS = [
  { label: "Corta", minFuseMs: 8_000, maxFuseMs: 15_000 },
  { label: "Normal", minFuseMs: 10_000, maxFuseMs: 30_000 },
  { label: "Larga", minFuseMs: 20_000, maxFuseMs: 45_000 },
];

const MODES: { id: ModeId; name: string; icon: string; blurb: string }[] = [
  { id: "bomba", name: "Bomba", icon: "◕", blurb: "Adivina el campeón y pasa la bomba antes de que explote." },
  { id: "impostor", name: "Impostor", icon: "◈", blurb: "Encuentra al infiltrado antes de que engañe a todos." },
  { id: "pictionary", name: "Pictionary", icon: "〰", blurb: "Dibuja un campeón y deja que tu equipo lo adivine." },
  { id: "unica", name: "Respuesta única", icon: "✧", blurb: "Elige un campeón válido y no repitas la respuesta de nadie." },
  { id: "carrera", name: "Carrera de pistas", icon: "➜", blurb: "Se revelan pistas: sé el primero en identificar al campeón." },
];

export function Lobby({ room, me, onReady, onConfigure, onStart }: Props) {
  const mePlayer = room.players.find((player) => player.playerId === me);
  const isHost = room.hostId === me;
  const connected = room.players.filter((player) => player.connected);
  const readyCount = connected.filter((player) => player.ready).length;
  const canStart = isHost && connected.length >= 3 && connected.every((p) => p.ready);
  const fuse = room.settings.bomba;

  return (
    <div className="game-shell">
      <div className="split">
        <section className="panel">
          <div className="eyebrow">Elige la partida</div>
          <h2>¿Qué jugamos?</h2>
          <div className="lobbygrid">
            {MODES.map((mode) => {
              const active = room.mode === mode.id;
              return (
                <button key={mode.id} className={`lobbymode${active ? " selected" : ""}`} disabled={!isHost} onClick={() => onConfigure({ mode: mode.id })}>
                  <span className="mode-icon">{mode.icon}</span>{mode.name}
                  {active ? <span className="tag">activo</span> : null}
                  <small>{mode.blurb}</small>
                </button>
              );
            })}
          </div>

          {room.mode === "bomba" ? (
            <>
              <div className="divider" />
              <div className="bar" style={{ marginTop: 0 }}>
                <div>
                  <span className="hint">Vidas por jugador</span>
                  <div className="stepper" style={{ marginTop: 8 }}>
                    <button className="step" disabled={!isHost || fuse.lives <= 1} onClick={() => onConfigure({ bomba: { lives: fuse.lives - 1 } })}>−</button>
                    <strong>{fuse.lives}</strong>
                    <button className="step" disabled={!isHost || fuse.lives >= 9} onClick={() => onConfigure({ bomba: { lives: fuse.lives + 1 } })}>+</button>
                  </div>
                </div>
                <div>
                  <span className="hint">Mecha</span>
                  <div className="chips" style={{ marginTop: 8 }}>
                    {FUSE_PRESETS.map((preset) => {
                      const active = fuse.minFuseMs === preset.minFuseMs && fuse.maxFuseMs === preset.maxFuseMs;
                      return <button key={preset.label} className={`chip${active ? " active" : ""}`} disabled={!isHost} onClick={() => onConfigure({ bomba: { minFuseMs: preset.minFuseMs, maxFuseMs: preset.maxFuseMs } })}>{preset.label}</button>;
                    })}
                  </div>
                </div>
              </div>
              <p className="hint" style={{ marginTop: 16 }}>Fallar descuenta {(fuse.penaltyMs / 1000).toFixed(0)} s y siempre tendrás al menos {(fuse.minMarginMs / 1000).toFixed(0)} s para pasarla.</p>
            </>
          ) : room.mode === "impostor" ? (
            <><div className="divider" /><p className="hint">Un infiltrado con 3 a 6 jugadores, dos desde 7. Pistas de {room.settings.impostor.clueSeconds} s, discusión de {room.settings.impostor.discussionSeconds} s y votación de {room.settings.impostor.voteSeconds} s.</p></>
          ) : room.mode === "pictionary" ? (
            <><div className="divider" /><p className="hint">Por turnos, una persona dibuja durante {room.settings.pictionary.drawingSeconds} s. El resto intenta adivinar el campeón.</p></>
          ) : room.mode === "carrera" ? (
            <><div className="divider" /><p className="hint">Se revela una pista cada {room.settings.carrera.clueSeconds} s. El primer acierto gana la ronda; se juegan {room.settings.carrera.rounds} rondas.</p></>
          ) : (
            <><div className="divider" /><p className="hint">Todos responden en secreto con un campeón de la categoría. Las respuestas repetidas no puntúan.</p></>
          )}
        </section>

        <aside className="panel">
          <div className="eyebrow">{readyCount}/{connected.length} listos</div>
          <h2>Tu equipo <span className="muted">{room.players.length}</span></h2>
          <div className="roster">
            {room.players.map((player) => (
              <div className="person" key={player.playerId}>
                <div className="avatar"><img src={player.avatar.imageUrl} alt="" /></div>
                <div className="name">{player.name}{player.playerId === me ? <span className="tag" style={{ marginLeft: 6 }}>tú</span> : null}<small>{player.isHost ? "Anfitrión" : !player.connected ? "Desconectado" : player.ready ? "Listo" : "Esperando…"}</small></div>
                <span className={`presence${!player.connected ? " off" : player.ready ? " ready" : ""}`} />
              </div>
            ))}
          </div>
          <p className="mini" style={{ marginTop: 16 }}>La conversación va por Discord. Aquí ponemos el juego.</p>
        </aside>
      </div>

      <div className="bar">
        <div className="row"><button className={mePlayer?.ready ? "secondary" : "primary"} onClick={() => onReady(!mePlayer?.ready)}>{mePlayer?.ready ? "Quitar listo" : "Estoy listo"}</button><span className="hint">{readyCount}/{connected.length} jugadores listos</span></div>
        {isHost ? <button className="primary" disabled={!canStart} onClick={onStart}>Empezar partida →</button> : <span className="hint">Esperando al anfitrión…</span>}
      </div>
      {isHost && !canStart ? <p className="hint">{connected.length < 3 ? "Hacen falta al menos 3 jugadores conectados." : "Todos deben marcarse como listos para arrancar."}</p> : null}
    </div>
  );
}
