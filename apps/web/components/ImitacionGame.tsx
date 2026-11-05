"use client";

import { useRef, useState } from "react";
import type { ImitacionPrivateView, RoomView } from "@lolgames/protocol";
import { AudioDistortionPlayer } from "./AudioDistortionPlayer";
import { PlayerScoreRow } from "./PlayerScoreRow";
import { Timer } from "./Timer";
import { useLanguage } from "@/lib/useLanguage";

type Props = { room: RoomView; me: string | null; priv: ImitacionPrivateView | null; isHost: boolean; resetting: boolean; onSubmit: (audioData: string, mimeType: string) => Promise<unknown> | void; onVote: (recordingId: string, stars: number) => void; onReset: (mode?: "imitacion") => void };

export function ImitacionGame({ room, priv, isHost, resetting, onSubmit, onVote, onReset }: Props) {
  const language = useLanguage();
  const game = room.game?.mode === "imitacion" ? room.game : null;
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [requestingMic, setRequestingMic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!game) return null;

  async function startRecording() {
    setError(null);
    setRequestingMic(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
      const next = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      next.ondataavailable = (event) => { if (event.data.size > 0) chunks.current.push(event.data); };
      next.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks.current, { type: next.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = async () => {
          setUploading(true);
          try {
            const result = await onSubmit(String(reader.result), blob.type);
            if (result && typeof result === "object" && "ok" in result && result.ok === false) {
              setError("El servidor rechazó la grabación. Inténtalo otra vez.");
            }
          } finally {
            setUploading(false);
          }
        };
        reader.readAsDataURL(blob);
      };
      recorder.current = next;
      next.start();
      setRecording(true);
    } catch {
      setError("No se pudo acceder al micrófono. Revisa los permisos del navegador.");
    } finally {
      setRequestingMic(false);
    }
  }

  function stopRecording() {
    recorder.current?.stop();
    recorder.current = null;
    setRecording(false);
  }

  const names = new Map(room.players.map((player) => [player.playerId, player.name]));
  const winner = game.winnerId ? names.get(game.winnerId) : null;
  return <div className="game-shell imitacion-layout">
     <section className="panel center imitacion-heading"><div className="eyebrow">Imitación de voz</div><h1>{game.phase === "RECORDING" ? "Imita la línea." : game.phase === "VOTING" ? "Voten la mejor imitación." : "Resultados de la ronda"}</h1><div className="timerbox"><Timer endsAt={game.phaseEndsAt} serverTime={room.serverTime} totalMs={(game.phase === "RECORDING" ? room.settings.imitacion.recordingSeconds : room.settings.imitacion.votingSeconds) * 1000} label={game.phase === "RECORDING" ? "Tiempo para grabar" : "Tiempo para votar"} /></div></section>
     <section className="glass imitacion-original"><div className="eyebrow">Línea original</div>{game.targetAudioUrl ? <AudioDistortionPlayer src={language === "en-us" ? game.targetAudioUrlEn ?? game.targetAudioUrl : game.targetAudioUrl} level={1} label="Escuchar original" /> : <p className="hint">Cargando línea…</p>}</section>
     {game.phase === "RECORDING" ? <section className="panel imitacion-record"><h2>Tu imitación</h2>{priv?.isSubmitted ? <p className="tag tag-green">Grabación enviada. Espera a los demás.</p> : <><button className={`primary record-button${recording ? " is-recording" : ""}`} disabled={priv?.isSubmitted || uploading || requestingMic} onClick={recording ? stopRecording : () => void startRecording()}>{requestingMic ? "Solicitando micrófono…" : uploading ? "Enviando grabación…" : recording ? "■ Detener y enviar" : "● Empezar a grabar"}</button><p className="hint recording-status">{recording ? "Grabando… pulsa el botón para terminar." : uploading ? "El servidor está procesando tu audio…" : null}</p></>}{error ? <p className="hint audio-player-error">{error}</p> : null}</section> : null}
    {game.phase === "VOTING" ? <section className="panel imitacion-votes"><h2>Voten sin favoritismos</h2><div className="imitacion-recordings">{game.recordings.map((recording) => <article className="imitacion-recording" key={recording.recordingId}><div className="eyebrow">Grabación {recording.recordingId.replace("recording-", "#")}</div><AudioDistortionPlayer src={recording.audioData} level={1} label="Escuchar imitación" /><div className="star-votes">{[1, 2, 3, 4, 5].map((stars) => <button className="star-vote" type="button" key={stars} disabled={priv?.hasVoted || priv?.ownRecordingId === recording.recordingId} onClick={() => onVote(recording.recordingId, stars)}>{"★".repeat(stars)}</button>)}</div></article>)}</div></section> : null}
    {game.phase === "REVEAL" || game.phase === "FINISHED" ? <section className="panel imitacion-votes"><h2>{winner ? `Ganó ${winner}` : "Resultados"}</h2><div className="imitacion-recordings">{game.recordings.map((recording) => <article className="imitacion-recording" key={recording.recordingId}><div className="eyebrow">{names.get(recording.playerId ?? "") ?? "Jugador"}</div><AudioDistortionPlayer src={recording.audioData} level={1} label="Escuchar" /><strong className="imitation-score">{recording.averageStars?.toFixed(1) ?? "0.0"} ★</strong></article>)}</div>{game.phase === "FINISHED" && isHost ? <div className="result-actions"><button className="primary" disabled={resetting} onClick={() => onReset("imitacion")}>Repetir imitación →</button></div> : null}</section> : null}
     <aside className="panel imitacion-sidebar"><div className="eyebrow">Participantes</div>{room.players.map((player) => <PlayerScoreRow player={player} key={player.playerId} />)}</aside>
  </div>;
}
