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
  { id: "quien-soy", name: "¿Quién soy?", icon: "?", blurb: "Todos ven tu campeón menos tú. Pregunta, adivina y suma." },
  { id: "carrera", name: "Carrera de pistas", icon: "➜", blurb: "Adivina antes que los demás con pistas progresivas." },
  { id: "carrera-sonido", name: "Carrera: Sonido", icon: "♫", blurb: "Escucha una voz distorsionada y descubre al campeón." },
  { id: "carrera-emojis", name: "Carrera de emojis", icon: "😀", blurb: "Descubre el campeón con cuatro emojis." },
  { id: "imitacion", name: "Imitación de voz", icon: "★", blurb: "Imita la línea y deja que el grupo vote." },
  { id: "party", name: "Party", icon: "✦", blurb: "Campaña de minijuegos con puntos acumulados y podio final." },
];
const PARTY_MODE_IDS = MODES.filter((mode) => mode.id !== "party");

function SettingStepper({ label, value, min, max, step, disabled, onChange }: { label: string; value: number; min: number; max: number; step: number; disabled: boolean; onChange: (value: number) => void }) {
  return <div className="mode-setting-stepper"><span className="hint">{label}</span><button className="step" disabled={disabled || value <= min} onClick={() => onChange(value - step)}>−</button><strong>{value}</strong><button className="step" disabled={disabled || value >= max} onClick={() => onChange(value + step)}>+</button></div>;
}

export function Lobby({ room, me, onReady, onConfigure, onStart }: Props) {
  const mePlayer = room.players.find((player) => player.playerId === me);
  const isHost = room.hostId === me;
  const connected = room.players.filter((player) => player.connected);
  const readyCount = connected.filter((player) => player.ready).length;
  const canStart = isHost && connected.length >= 3 && connected.every((p) => p.ready);
  const fuse = room.settings.bomba;
  const selectedMode = MODES.find((mode) => mode.id === room.mode);

  return (
    <div className="game-shell lobby-screen">
      <div className="split">
        <section className="panel lobby-main-panel">
          <div className="eyebrow">Elige la partida</div>
          <h2>¿Qué jugamos?</h2>
          <div className="lobbygrid">
            {MODES.map((mode) => {
              const active = room.mode === mode.id;
              return (
                <button key={mode.id} className={`lobbymode${active ? " selected" : ""}`} disabled={!isHost} onClick={() => onConfigure({ mode: mode.id })}>
                  <span className="mode-icon">{mode.icon}</span>{mode.name}
                  {active ? <span className="tag">activo</span> : null}
                </button>
              );
            })}
          </div>
          {selectedMode ? <p className="hint lobby-mode-blurb">{selectedMode.blurb}</p> : null}

          {room.mode === "bomba" ? (
            <>
              <div className="divider" />
              <div className="bar lobby-settings-row" style={{ marginTop: 0 }}>
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
              <p className="hint" style={{ marginTop: 10 }}>Fallar descuenta {(fuse.penaltyMs / 1000).toFixed(0)} s y siempre tendrás al menos {(fuse.minMarginMs / 1000).toFixed(0)} s para pasarla.</p>
            </>
           ) : room.mode === "impostor" ? (
             <><div className="divider" /><p className="hint">Un infiltrado con 3 a 6 jugadores, dos desde 7.</p><div className="mode-settings"><SettingStepper label="Pistas" value={room.settings.impostor.clueSeconds} min={10} max={120} step={10} disabled={!isHost} onChange={(value) => onConfigure({ impostor: { clueSeconds: value } })} /><SettingStepper label="Discusión" value={room.settings.impostor.discussionSeconds} min={20} max={180} step={10} disabled={!isHost} onChange={(value) => onConfigure({ impostor: { discussionSeconds: value } })} /><SettingStepper label="Votación" value={room.settings.impostor.voteSeconds} min={15} max={120} step={15} disabled={!isHost} onChange={(value) => onConfigure({ impostor: { voteSeconds: value } })} /></div></>
          ) : room.mode === "pictionary" ? (
            <><div className="divider" /><p className="hint">Por turnos, una persona dibuja durante {room.settings.pictionary.drawingSeconds} s. El resto intenta adivinar el campeón.</p><div className="stepper" style={{ marginTop: 14 }}><span className="hint">Rondas</span><button className="step" disabled={!isHost || room.settings.pictionary.rounds <= 1} onClick={() => onConfigure({ pictionary: { rounds: room.settings.pictionary.rounds - 1 } })}>−</button><strong>{room.settings.pictionary.rounds}</strong><button className="step" disabled={!isHost || room.settings.pictionary.rounds >= 10} onClick={() => onConfigure({ pictionary: { rounds: room.settings.pictionary.rounds + 1 } })}>+</button></div></>
          ) : room.mode === "quien-soy" ? (
            <><div className="divider" /><p className="hint">Cada jugador recibe un campeón secreto: todos lo ven menos él. En tu turno puedes adivinar con el buscador. Acierto: +1000 puntos y termina tu turno; fallo: sigues intentando. Jugáis una vez cada uno.</p><div className="stepper" style={{ marginTop: 14 }}><span className="hint">Segundos por turno</span><button className="step" disabled={!isHost || room.settings.quienSoy.turnSeconds <= 20} onClick={() => onConfigure({ quienSoy: { turnSeconds: room.settings.quienSoy.turnSeconds - 10 } })}>−</button><strong>{room.settings.quienSoy.turnSeconds}</strong><button className="step" disabled={!isHost || room.settings.quienSoy.turnSeconds >= 180} onClick={() => onConfigure({ quienSoy: { turnSeconds: room.settings.quienSoy.turnSeconds + 10 } })}>+</button></div></>
           ) : room.mode === "carrera" ? (
             <><div className="divider" /><p className="hint">Se revelan pistas progresivamente. Todos pueden responder y los puntos bajan con cada pista.</p><div className="mode-settings"><SettingStepper label="Segundos por pista" value={room.settings.carrera.clueSeconds} min={3} max={30} step={1} disabled={!isHost} onChange={(value) => onConfigure({ carrera: { clueSeconds: value } })} /><SettingStepper label="Rondas" value={room.settings.carrera.rounds} min={1} max={10} step={1} disabled={!isHost} onChange={(value) => onConfigure({ carrera: { rounds: value } })} /></div></>
           ) : room.mode === "carrera-sonido" ? (
             <><div className="divider" /><p className="hint">Escucha una voz de campeón. Todos pueden responder y los puntos bajan progresivamente.</p><div className="mode-settings"><SettingStepper label="Segundos por pista" value={room.settings.carreraSonido.clueSeconds} min={3} max={30} step={1} disabled={!isHost} onChange={(value) => onConfigure({ carreraSonido: { clueSeconds: value } })} /><SettingStepper label="Rondas" value={room.settings.carreraSonido.rounds} min={1} max={10} step={1} disabled={!isHost} onChange={(value) => onConfigure({ carreraSonido: { clueSeconds: room.settings.carreraSonido.clueSeconds, rounds: value } })} /></div></>
           ) : room.mode === "carrera-emojis" ? (
             <><div className="divider" /><p className="hint">Se revela un emoji por pista hasta completar cuatro. Todos pueden responder.</p><div className="mode-settings"><SettingStepper label="Segundos por emoji" value={room.settings.carreraEmojis.clueSeconds} min={3} max={30} step={1} disabled={!isHost} onChange={(value) => onConfigure({ carreraEmojis: { clueSeconds: value } })} /><SettingStepper label="Rondas" value={room.settings.carreraEmojis.rounds} min={1} max={10} step={1} disabled={!isHost} onChange={(value) => onConfigure({ carreraEmojis: { clueSeconds: room.settings.carreraEmojis.clueSeconds, rounds: value } })} /></div></>
           ) : room.mode === "imitacion" ? (
             <><div className="divider" /><p className="hint">Escucha una línea, graba tu imitación y vota de 1 a 5 estrellas. No puedes votar tu propia grabación.</p><div className="mode-settings"><SettingStepper label="Segundos para grabar" value={room.settings.imitacion.recordingSeconds} min={10} max={30} step={5} disabled={!isHost} onChange={(value) => onConfigure({ imitacion: { recordingSeconds: value } })} /><SettingStepper label="Segundos para votar" value={room.settings.imitacion.votingSeconds} min={15} max={120} step={15} disabled={!isHost} onChange={(value) => onConfigure({ imitacion: { votingSeconds: value } })} /></div></>
           ) : (
             <><div className="divider" /><p className="hint">Elige qué minijuegos entran en la Party. Se jugarán rápido, en orden aleatorio y con un marcador global.</p><div className="party-mode-picker">{PARTY_MODE_IDS.map((mode) => { const selected = room.settings.party.selectedModes.includes(mode.id); return <button type="button" key={mode.id} className={`party-mode-chip${selected ? " selected" : ""}`} disabled={!isHost} onClick={() => onConfigure({ party: { selectedModes: selected ? room.settings.party.selectedModes.filter((id) => id !== mode.id) : [...room.settings.party.selectedModes, mode.id] } })}>{mode.icon} {mode.name}</button>; })}</div><p className="hint party-preset-note">Preset Party: 3 rondas y tiempos cortos por modo.</p></>
           )}
        </section>

        <aside className="panel lobby-team-panel">
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
        </aside>
      </div>

      <div className="bar lobby-actions">
        <div className="row"><button className={`lobby-ready-btn ${mePlayer?.ready ? "secondary" : "primary"}`} onClick={() => onReady(!mePlayer?.ready)}>{mePlayer?.ready ? "Quitar listo" : "Estoy listo"}</button><span className="hint">{readyCount}/{connected.length} jugadores listos</span></div>
        {isHost ? <button className="primary lobby-start-btn" disabled={!canStart} onClick={onStart}>Empezar partida →</button> : <span className="hint">Esperando al anfitrión…</span>}
      </div>
      {isHost && !canStart ? <p className="hint">{connected.length < 3 ? "Hacen falta al menos 3 jugadores conectados." : "Todos deben marcarse como listos para arrancar."}</p> : null}
    </div>
  );
}
