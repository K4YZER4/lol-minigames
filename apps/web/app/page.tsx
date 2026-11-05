"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { request } from "@/lib/socket";
import { lastNickname, saveSession } from "@/lib/session";
import { AvatarPicker } from "@/components/AvatarPicker";
import { RoomNotFoundModal } from "@/components/RoomNotFoundModal";
import { lastAvatarId, loadAvatars, saveAvatarId, type Avatar } from "@/lib/avatars";
import type { JoinAck } from "@lolgames/protocol";
import { useTranslation } from "@/lib/i18n";

const LANDING_MODES = [
  ["bomba", "◕"], ["impostor", "◈"], ["pictionary", "〰"], ["quien-soy", "?"],
  ["carrera", "➜"], ["carrera-sonido", "♫"], ["carrera-emojis", "😀"], ["imitacion", "★"], ["party", "✦"],
] as const;

type EntryMode = "create" | "join";

export default function HomePage() {
  const router = useRouter();
  const { t } = useTranslation();
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
    }).catch(() => setError(t.catalogError));
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
      setError(t.nicknameMin);
      return;
    }

    const roomCode = code.trim().toUpperCase();
    if (mode === "join" && roomCode.length !== 6) {
      setError(t.codeLength);
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
            <p className="muted">{t.tagline}</p>

            <div className="buttons">
              <button className="primary" onClick={() => setMode("create")}>
                {t.createRoom}
              </button>
              <button className="secondary" onClick={() => setMode("join")}>
                {t.joinRoom}
              </button>
            </div>

            <a className="textbutton home-explore" href="#modos">{t.exploreModes}</a>

            <p className="mini" style={{ marginTop: 22 }}>
               {t.modeCount}
            </p>
          </div>
        </div>

        <section id="modos" className="mode-preview">
           <div className="eyebrow">{t.chooseHow}</div>
           <h2>{t.oneRoom}</h2>
          <div className="mode-preview-grid">
             {LANDING_MODES.map(([id, icon]) => <article className="glass mode-preview-card" key={id}>
               <div className="mode-preview-icon">{icon}</div>
               <h3>{t.modeName(id)}</h3>
               <p>{t.modeBlurb(id)}</p>
               <span className="more">{t.players}</span>
            </article>)}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="glass form">
        <button className="back-button" type="button" onClick={back}>
           {t.back}
        </button>

        <h1 style={{ marginTop: 25 }}>
           {mode === "create" ? t.whatIsYourName : t.teamWaiting}
        </h1>
         <p className="muted">{t.nicknameEnough}</p>

        <AvatarPicker avatars={avatars} selectedId={avatarId} onChange={(id) => { setAvatarId(id); saveAvatarId(id); }} />

        {mode === "join" ? (
          <>
             <label htmlFor="room-code">{t.roomCode}</label>
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

         <label htmlFor="nickname">{t.nickname}</label>
        <input
          id="nickname"
          value={nickname}
          maxLength={16}
           placeholder={t.nicknameExample}
          autoComplete="off"
          onChange={(event) => setNickname(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
        />

        <button className="primary" disabled={busy !== null} onClick={() => void submit()}>
           {busy ? t.joining : t.letsPlay}
        </button>

        {error && errorCode !== "ROOM_NOT_FOUND" ? (
          <p className="mini" style={{ color: "var(--danger)", marginTop: 14 }}>
            {error}
          </p>
        ) : null}

      </div>
      {errorCode === "ROOM_NOT_FOUND" ? <RoomNotFoundModal code={code} onHome={() => router.push("/")} /> : null}
    </main>
  );
}
