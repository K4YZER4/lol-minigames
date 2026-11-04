"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { request } from "@/lib/socket";
import { lastNickname, saveSession } from "@/lib/session";
import { AvatarPicker } from "@/components/AvatarPicker";
import { RoomNotFoundModal } from "@/components/RoomNotFoundModal";
import { lastAvatarId, loadAvatars, saveAvatarId, type Avatar } from "@/lib/avatars";
import type { JoinAck } from "@lolgames/protocol";

const LANDING_MODES = [
  ["◕", "Bomba", "Adivina el campeón y pásala antes de que explote."],
  ["◈", "Impostor", "Da pistas, discute y descubre al infiltrado."],
  ["〰", "Pictionary", "Dibuja un campeón y deja que tu equipo lo adivine."],
  ["?", "¿Quién soy?", "Todos ven tu campeón menos tú."],
  ["➜", "Carrera de pistas", "Adivina con imágenes antes que los demás."],
  ["♫", "Carrera de sonido", "Reconoce al campeón por su voz."],
  ["😀", "Carrera de emojis", "Descubre el campeón con cuatro emojis."],
  ["★", "Imitación de voz", "Imita la línea y recibe estrellas del grupo."],
  ["✦", "Party", "Un jugador recibe un campeón y el grupo intenta adivinarlo."],
] as const;

type EntryMode = "create" | "join";

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<EntryMode | null>(null);
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [busy, setBusy] = useState<EntryMode | null>(null);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [avatarId, setAvatarId] = useState<string | null>(null);

  useEffect(() => {
    setNickname(lastNickname());
    setAvatarId(lastAvatarId());
    void loadAvatars().then((items) => {
      setAvatars(items);
      setAvatarId((current) => current && items.some((item) => item.id === current) ? current : items[0]?.id ?? null);
    }).catch(() => setError("No se pudo cargar el catálogo de emotes"));
  }, []);

  function back() {
    setMode(null);
    setError(null);
    setErrorCode(null);
  }

  async function submit() {
    if (!mode) return;
    setError(null);
    setErrorCode(null);

    const nick = nickname.trim();
    if (nick.length < 2) {
      setError("Pon un apodo de al menos 2 caracteres");
      return;
    }

    const roomCode = code.trim().toUpperCase();
    if (mode === "join" && roomCode.length !== 6) {
      setError("El código tiene 6 caracteres");
      return;
    }

    setBusy(mode);
    if (avatarId) saveAvatarId(avatarId);
    const ack =
      mode === "create"
        ? await request<JoinAck>("room:create", { nickname: nick, avatarId: avatarId ?? undefined })
        : await request<JoinAck>("room:join", { code: roomCode, nickname: nick, avatarId: avatarId ?? undefined });
    setBusy(null);

    if (!ack.ok) {
      setError(ack.message);
      setErrorCode(ack.code);
      return;
    }

    saveSession(ack.roomCode, {
      playerId: ack.playerId,
      token: ack.token,
      nickname: nick,
      avatarId: avatarId ?? undefined,
    });
    router.push(`/room/${ack.roomCode}`);
  }

  if (!mode) {
    return (
      <main className="container home-page">
        <div className="home">
          <div className="home-inner">
            <img className="home-logo" src="/images/logo-lol-party.png" alt="Logo de LoL Party" />
            <h1 className="hero-logo-title"><span>LOL</span> <b>PARTY</b></h1>
            <p className="muted">Tu equipo. Otro tipo de partida.</p>

            <div className="buttons">
              <button className="primary" onClick={() => setMode("create")}>
                Crear sala
              </button>
              <button className="secondary" onClick={() => setMode("join")}>
                Unirme a sala
              </button>
            </div>

            <a className="textbutton home-explore" href="#modos">Explorar los modos ↗</a>

            <p className="mini" style={{ marginTop: 22 }}>
               9 modos · 3 a 12 jugadores · sin cuentas
            </p>
          </div>
        </div>

        <section id="modos" className="mode-preview">
          <div className="eyebrow">Elige cómo se juega</div>
          <h2>Una sala. Muchas formas de liarla.</h2>
          <div className="mode-preview-grid">
            {LANDING_MODES.map(([icon, name, description]) => <article className="glass mode-preview-card" key={name}>
              <div className="mode-preview-icon">{icon}</div>
              <h3>{name}</h3>
              <p>{description}</p>
              <span className="more">3 a 12 jugadores</span>
            </article>)}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="glass form">
        <button className="textbutton" style={{ padding: 0 }} onClick={back}>
          ← Volver
        </button>

        <h1 style={{ marginTop: 25 }}>
          {mode === "create" ? "¿Cómo te llamas?" : "Tu equipo te espera."}
        </h1>
        <p className="muted">Con tu apodo es suficiente.</p>

        <AvatarPicker avatars={avatars} selectedId={avatarId} onChange={(id) => { setAvatarId(id); saveAvatarId(id); }} />

        {mode === "join" ? (
          <>
            <label htmlFor="room-code">Código de sala</label>
            <input
              id="room-code"
              className="input code"
              value={code}
              maxLength={6}
              placeholder="ABC234"
              autoComplete="off"
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submit();
              }}
            />
          </>
        ) : null}

        <label htmlFor="nickname">Tu apodo</label>
        <input
          id="nickname"
          value={nickname}
          maxLength={16}
          placeholder="Ej. Horacio"
          autoComplete="off"
          onChange={(event) => setNickname(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
        />

        <button className="primary" disabled={busy !== null} onClick={() => void submit()}>
          {busy ? "Entrando…" : "Vamos a jugar →"}
        </button>

        {error && errorCode !== "ROOM_NOT_FOUND" ? (
          <p className="mini" style={{ color: "var(--danger)", marginTop: 14 }}>
            {error}
          </p>
        ) : null}

        <p className="mini" style={{ marginTop: 18 }}>
          {mode === "create"
            ? "Vas a ser el anfitrión: elegís el modo y arrancás la partida."
            : "Usa el mismo apodo de siempre para recuperar tu lugar si se corta la conexión."}
        </p>
      </div>
      {errorCode === "ROOM_NOT_FOUND" ? <RoomNotFoundModal code={code} onHome={() => router.push("/")} /> : null}
    </main>
  );
}
