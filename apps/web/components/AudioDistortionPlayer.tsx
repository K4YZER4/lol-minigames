"use client";

import { useEffect, useRef, useState } from "react";
import { getUiVolume, UI_VOLUME_EVENT } from "@/lib/sounds";

type Props = {
  src: string;
  level: number;
  label?: string;
};

export function AudioDistortionPlayer({ src, level, label }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const applyVolume = () => {
      if (audioRef.current) audioRef.current.volume = getUiVolume();
    };
    applyVolume();
    window.addEventListener(UI_VOLUME_EVENT, applyVolume);
    return () => window.removeEventListener(UI_VOLUME_EVENT, applyVolume);
  }, []);

  function play() {
    const audio = audioRef.current;
    if (!audio) {
      setError("No se encontró el reproductor de audio.");
      return;
    }
    setError(null);
    void audio.play().then(() => setPlaying(true)).catch(() => {
      setPlaying(false);
      setError("No se pudo reproducir esta pista. Revisa que el servidor tenga los audios locales.");
    });
  }

  function stop() {
    audioRef.current?.pause();
    setPlaying(false);
  }

  return (
    <div className="audio-player">
      <audio ref={audioRef} src={src} preload="metadata" onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} onError={() => setError("La pista no está disponible en el endpoint de audio.")} />
      <button className="primary" type="button" onClick={playing ? stop : play}>
        {playing ? "Pausar audio" : "▶ Escuchar pista"}
      </button>
      <span className="hint">{label ?? `Pista sonora ${level}`}</span>
      {error ? <span className="hint audio-player-error">{error}</span> : null}
    </div>
  );
}
