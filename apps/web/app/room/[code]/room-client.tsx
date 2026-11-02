"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket, request } from "@/lib/socket";
import { clearSession, lastNickname, loadSession, saveSession } from "@/lib/session";
import { loadChampions, type Champion } from "@/lib/champions";
import { lastAvatarId, loadAvatars, saveAvatarId, type Avatar } from "@/lib/avatars";
import { AvatarPicker } from "@/components/AvatarPicker";
import { RoomNotFoundModal } from "@/components/RoomNotFoundModal";
import type {
  BombaPrivateView,
  DescripcionPrivateView,
  DuoPrivateView,
  ImpostorPrivateView,
  JoinAck,
  PrivateView,
  RoomView,
  SimpleAck,
} from "@lolgames/protocol";
import { Lobby } from "@/components/Lobby";
import { BombaGame } from "@/components/BombaGame";
import { ImpostorGame } from "@/components/ImpostorGame";
import { PictionaryGame } from "@/components/PictionaryGame";
import { UnicaGame } from "@/components/UnicaGame";
import { QuienSoyGame } from "@/components/QuienSoyGame";
import { CarreraGame } from "@/components/CarreraGame";
import { DescripcionGame } from "@/components/DescripcionGame";
import { DuoGame } from "@/components/DuoGame";
import { PartyGame } from "@/components/PartyGame";

const newRequestId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function RoomClient({ code, devSession }: { code: string; devSession?: { token: string; playerId: string; nickname: string } | null }) {
  const router = useRouter();
  const socket = useMemo(() => getSocket(), []);

  const [room, setRoom] = useState<RoomView | null>(null);
  const [priv, setPriv] = useState<PrivateView>(null);
  const [me, setMe] = useState<string | null>(null);
  const [champions, setChampions] = useState<Champion[]>([]);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [needsJoin, setNeedsJoin] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinErrorCode, setJoinErrorCode] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [flash, setFlash] = useState<{ type: string; key: number } | null>(null);

  const session = useRef(loadSession(code));

  useEffect(() => {
    if (devSession) {
      const stored = { ...devSession };
      session.current = stored;
      saveSession(code, stored);
    }
    setNickname(session.current?.nickname || lastNickname());
    setAvatarId(session.current?.avatarId ?? lastAvatarId());
    void loadChampions()
      .then(setChampions)
      .catch(() => setToast("No se pudo cargar el catálogo de campeones"));
    void loadAvatars()
      .then((items) => {
        setAvatars(items);
        setAvatarId((current) => current && items.some((item) => item.id === current) ? current : items[0]?.id ?? null);
      })
      .catch(() => setToast("No se pudo cargar el catálogo de emotes"));
  }, [code, devSession]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), flash.type === "bomba:explosion" ? 1600 : 750);
    return () => clearTimeout(id);
  }, [flash]);

  const join = useCallback(
    async (token?: string, nick?: string) => {
      const ack = await request<JoinAck>("room:join", {
        code,
        token,
        nickname: nick,
        avatarId: avatarId ?? undefined,
      });

      if (ack.ok) {
        const finalNickname = nick ?? session.current?.nickname ?? "";
        const stored = {
          playerId: ack.playerId,
          token: ack.token,
          nickname: finalNickname,
          avatarId: avatarId ?? session.current?.avatarId,
        };
        session.current = stored;
        saveSession(code, stored);
        setMe(ack.playerId);
        setNeedsJoin(false);
        setJoinError(null);
        setJoinErrorCode(null);
        return;
      }

      if (token) {
        // El token ya no sirve (sala cerrada o reinicio del servidor).
        session.current = null;
        clearSession(code);
        setNeedsJoin(true);
        setJoinError(ack.message);
        setJoinErrorCode(ack.code);
        return;
      }

      setJoinError(ack.message);
      setJoinErrorCode(ack.code);
    },
    [avatarId, code],
  );

  useEffect(() => {
    const onConnect = () => {
      setConnecting(false);
      const stored = session.current;
      if (stored) void join(stored.token, stored.nickname);
      else setNeedsJoin(true);
    };
    const onDisconnect = () => setConnecting(true);
    const onState = (view: RoomView) => {
      setRoom((previous) =>
        !previous || view.stateVersion >= previous.stateVersion ? view : previous,
      );
    };
    const onPrivate = (view: PrivateView) => setPriv(view);
    const onEffect = (effect: { type?: string }) => {
      if (effect?.type) setFlash({ type: effect.type, key: Date.now() });
    };
    const onRejected = (payload: { code?: string; message?: string }) => {
      setToast(
        payload?.code === "SESSION_REPLACED"
          ? "Esta sesión se abrió en otra pestaña. Usa otro jugador para esta pestaña."
          : (payload?.message ?? "El servidor rechazó la acción"),
      );
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room:state", onState);
    socket.on("private:state", onPrivate);
    socket.on("game:effect", onEffect);
    socket.on("action:rejected", onRejected);

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:state", onState);
      socket.off("private:state", onPrivate);
      socket.off("game:effect", onEffect);
      socket.off("action:rejected", onRejected);
    };
  }, [socket, join]);

  const act = useCallback(async (event: string, payload: unknown = {}) => {
    const ack = await request<SimpleAck>(event, payload);
    if (!ack.ok) setToast(ack.message);
    return ack;
  }, []);

  const submitJoin = useCallback(async () => {
    const nick = nickname.trim();
    if (nick.length < 2) {
      setJoinError("Pon un apodo de al menos 2 caracteres");
      return;
    }
    setBusy(true);
    await join(undefined, nick);
    setBusy(false);
  }, [join, nickname]);

  const leave = useCallback(async () => {
    await act("room:leave");
    clearSession(code);
    session.current = null;
    router.push("/");
  }, [act, code, router]);

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setToast("Código copiado");
    } catch {
      setToast(`Código: ${code}`);
    }
  }, [code]);

  const resetToLobby = useCallback(async (mode?: "bomba" | "impostor" | "pictionary" | "unica" | "quien-soy" | "carrera" | "descripcion" | "duo") => {
    setResetting(true);
    const ack = await act("session:reset", mode ? { mode } : {});
    setResetting(false);
    if (ack.ok) setToast("Lobby listo: configura la siguiente partida");
  }, [act]);

  const bombaPriv = priv?.mode === "bomba" ? (priv as BombaPrivateView) : null;
  const impostorPriv = priv?.mode === "impostor" ? (priv as ImpostorPrivateView) : null;
  const descripcionPriv = priv?.mode === "descripcion" ? (priv as DescripcionPrivateView) : null;
  const duoPriv = priv?.mode === "duo" ? (priv as DuoPrivateView) : null;

  if (needsJoin) {
    if (joinErrorCode === "ROOM_NOT_FOUND") {
      return (
        <main className="container">
          <RoomNotFoundModal code={code} onHome={() => router.push("/")} />
        </main>
      );
    }

    return (
      <main className="container">
        <section className="glass form">
          <div className="eyebrow">Sala {code}</div>
          <h1>Entrar a la sala</h1>
          <p className="muted">Tu equipo te espera.</p>
          <AvatarPicker avatars={avatars} selectedId={avatarId} onChange={(id) => { setAvatarId(id); saveAvatarId(id); }} />
          <label htmlFor="room-nickname">Tu apodo</label>
            <input
              id="room-nickname"
              className="input"
              value={nickname}
              maxLength={16}
              placeholder="Ej. Horacio"
              onChange={(event) => setNickname(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submitJoin();
              }}
            />
          <button
            className="primary"
            disabled={busy}
            onClick={() => void submitJoin()}
          >
            {busy ? "Entrando…" : "Entrar →"}
          </button>
          {joinError ? (
            <p className="hint" style={{ marginTop: 12, color: "var(--danger)" }}>
              {joinError}
            </p>
          ) : null}
          <p className="hint" style={{ marginTop: 12 }}>
            Si la sala ya empezó no se puede entrar como jugador nuevo.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="top">
        <div>
          <div className="eyebrow"><span className={`live-dot${connecting ? "" : " on"}`} /> Sala {code}</div>
          <h1>{!room || room.phase === "LOBBY" ? "La sala está lista." : room.mode === "bomba" ? "No te la quedes." : room.mode === "impostor" ? "Que no te lean tan fácil." : room.mode === "pictionary" ? "Dibuja. Que no te descubran." : room.mode === "unica" ? "Elige sin repetir." : "Descubre quién eres."}</h1>
        </div>
        <div className="row">
          <button className="secondary" onClick={() => void copyCode()}>Copiar código ↗</button>
          <button className="textbutton" onClick={() => void leave()}>Salir</button>
        </div>
      </div>

      {!room ? (
        <section className="panel center">
          <p className="hint">{connecting ? "Conectando al servidor…" : "Cargando sala…"}</p>
        </section>
      ) : room.phase === "LOBBY" ? (
        <Lobby
          room={room}
          me={me}
          onReady={(ready) => void act("room:ready", { ready })}
          onConfigure={(patch) => void act("session:configure", patch)}
          onStart={() => void act("session:start", {})}
        />
      ) : room.game?.mode === "bomba" ? (
        <BombaGame
          room={room}
          me={me}
          priv={bombaPriv}
          champions={champions}
          flash={flash}
          onAnswer={(championId) =>
            void act("bomba:answer", { requestId: newRequestId(), championId })
          }
          isHost={room.hostId === me}
          resetting={resetting}
          onReset={(mode) => void resetToLobby(mode)}
        />
      ) : room.game?.mode === "impostor" ? (
        <ImpostorGame
          room={room}
          me={me}
          priv={impostorPriv}
          onAck={() => void act("impostor:ack", { requestId: newRequestId() })}
          onClue={(text) =>
            void act("impostor:clue", { requestId: newRequestId(), text })
          }
          onVote={(targetId) =>
            void act("impostor:vote", { requestId: newRequestId(), targetId })
          }
          isHost={room.hostId === me}
          resetting={resetting}
          onReset={(mode) => void resetToLobby(mode)}
        />
      ) : room.game?.mode === "pictionary" ? (
        <PictionaryGame
          room={room}
          me={me}
          priv={priv?.mode === "pictionary" ? priv : null}
          champions={champions}
          isHost={room.hostId === me}
          resetting={resetting}
          onStroke={(points) => void act("pictionary:stroke", { requestId: newRequestId(), points })}
          onUndo={() => void act("pictionary:undo", { requestId: newRequestId() })}
          onFill={(x, y, color) => void act("pictionary:fill", { requestId: newRequestId(), x, y, color })}
          onGuess={(championId) => void act("pictionary:guess", { requestId: newRequestId(), championId })}
          onReset={(mode) => void resetToLobby(mode)}
        />
      ) : room.game?.mode === "unica" ? (
        <UnicaGame
          room={room}
          me={me}
          priv={priv?.mode === "unica" ? priv : null}
          champions={champions}
          isHost={room.hostId === me}
          resetting={resetting}
          onSubmit={(championId) => void act("unica:submit", { requestId: newRequestId(), championId })}
          onReset={(mode) => void resetToLobby(mode)}
        />
      ) : room.game?.mode === "quien-soy" ? (
        <QuienSoyGame room={room} me={me} priv={priv?.mode === "quien-soy" ? priv : null} champions={champions} isHost={room.hostId === me} resetting={resetting}
          onQuestion={(text) => void act("quien-soy:question", { requestId: newRequestId(), text })}
          onAnswer={(answer) => void act("quien-soy:answer", { requestId: newRequestId(), answer })}
          onGuess={(championId) => void act("quien-soy:guess", { requestId: newRequestId(), championId })}
           onReset={(mode) => void resetToLobby(mode)} />
      ) : room.game?.mode === "carrera" ? (
        <CarreraGame room={room} priv={priv?.mode === "carrera" ? priv : null} champions={champions} isHost={room.hostId === me} resetting={resetting} onAnswer={(championId) => void act("carrera:answer", { requestId: newRequestId(), championId })} onReset={(mode) => void resetToLobby(mode)} />
      ) : room.game?.mode === "descripcion" ? (
        <DescripcionGame room={room} me={me} priv={priv?.mode === "descripcion" ? priv : null} isHost={room.hostId === me} resetting={resetting}
          onClue={(text) => void act("descripcion:clue", { requestId: newRequestId(), text })}
          onGuess={(text) => void act("descripcion:guess", { requestId: newRequestId(), text })}
          onReset={(mode) => void resetToLobby(mode)} />
      ) : room.game?.mode === "duo" ? (
        <DuoGame room={room} me={me} priv={duoPriv} champions={champions} isHost={room.hostId === me} resetting={resetting} onSubmit={(championId) => void act("duo:submit", { requestId: newRequestId(), championId })} onReset={(mode) => void resetToLobby(mode)} />
      ) : room.game?.mode === "party" ? (
        <PartyGame room={room} me={me} priv={priv?.mode === "party" ? priv : null} champions={champions} onGuess={(championId) => void act("party:guess", { requestId: newRequestId(), championId })} />
      ) : (
        <section className="panel center">
          <p className="hint">Esperando el estado de la partida…</p>
        </section>
      )}

      {toast ? <div className="toast">{toast}</div> : null}
    </main>
  );
}
