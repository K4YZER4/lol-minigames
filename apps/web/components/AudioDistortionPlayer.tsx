"use client";

import { useEffect, useRef, useState } from "react";
import { getUiVolume, UI_VOLUME_EVENT } from "@/lib/sounds";
import { useTranslation } from "@/lib/i18n";

type Props = {
  src: string;
  level: number;
  label?: string;
};

export function AudioDistortionPlayer({ src, level, label }: Props) {
  const { t } = useTranslation();
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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.load();
    setPlaying(false);
    setError(null);
  }, [src]);

  function play() {
    const audio = audioRef.current;
    if (!audio) {
      setError(t.audioPlayerMissing);
      return;
    }
    setError(null);
    void audio.play().then(() => setPlaying(true)).catch(() => {
      setPlaying(false);
      setError(t.audioPlaybackError);
    });
  }

  function stop() {
    audioRef.current?.pause();
    setPlaying(false);
  }

  return (
    <div className="audio-player">
      <audio ref={audioRef} src={src} preload="metadata" onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} onError={() => setError(t.audioEndpointError)} />
      <button className="primary" type="button" onClick={playing ? stop : play}>
        {playing ? t.pauseAudio : `▶ ${label ?? t.listenClue}`}
      </button>
      {!label ? <span className="hint">{t.soundClue(level, level)}</span> : null}
      {error ? <span className="hint audio-player-error">{error}</span> : null}
    </div>
  );
}
