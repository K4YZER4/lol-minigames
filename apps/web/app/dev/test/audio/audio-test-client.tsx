"use client";

import { useEffect, useState } from "react";
import { AudioDistortionPlayer } from "@/components/AudioDistortionPlayer";
import { AUDIO_DISTORTION_LEVELS } from "@/lib/audio-distortion";

type Clip = { url: string; durationMs?: number };
type Manifest = { champions?: Record<string, { name?: string; clips?: Clip[] }> };

export function AudioTestClient() {
  const [clip, setClip] = useState<{ champion: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/audio/vo/es-mx/manifest.json")
      .then((response) => {
        if (!response.ok) throw new Error(`Manifest respondió ${response.status}`);
        return response.json() as Promise<Manifest>;
      })
      .then((manifest) => {
        const candidates = Object.entries(manifest.champions ?? {})
          .flatMap(([champion, data]) => (data.clips ?? []).map((item) => ({
            champion,
            url: item.url.startsWith("/") ? item.url : `/audio/vo/es-mx/${item.url}`,
          })));
        const first = candidates[0];
        if (!first) throw new Error("No hay clips de audio en el manifest local.");
        setClip(first);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "No se pudo cargar el audio."));
  }, []);

  return (
    <main className="container">
      <section className="panel">
        <div className="eyebrow">Solo desarrollo</div>
        <h1>Prueba de Carrera sonora</h1>
        <p className="muted">Elige un nivel y escucha cómo se degrada o se limpia la misma voz.</p>
        {error ? <p className="hint" style={{ color: "var(--danger)" }}>{error}</p> : null}
        {clip ? (
          <div className="audio-test-card">
            <p className="hint">Clip local de prueba: {clip.champion}</p>
            {Object.keys(AUDIO_DISTORTION_LEVELS).map((level) => (
              <AudioDistortionPlayer key={level} src={clip.url} level={Number(level)} label={`Nivel ${level}`} />
            ))}
          </div>
        ) : !error ? <p className="hint">Cargando clips…</p> : null}
      </section>
    </main>
  );
}
