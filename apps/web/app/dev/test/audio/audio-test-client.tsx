"use client";

import { useEffect, useState } from "react";
import { AudioDistortionPlayer } from "@/components/AudioDistortionPlayer";

type Clip = { url: string; durationMs?: number };
type Manifest = { champions?: Record<string, { name?: string; clips?: Clip[] }> };

export function AudioTestClient() {
  const [clips, setClips] = useState<{ champion: string; url: string }[]>([]);
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
        const firstChampion = candidates[0]?.champion;
        const first = candidates.filter((item) => item.champion === firstChampion).slice(0, 5);
        if (first.length === 0) throw new Error("No hay clips de audio en el manifest local.");
        setClips(first);
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
        {clips.length > 0 ? (
          <div className="audio-test-card">
            <p className="hint">Cinco clips limpios de: {clips[0]?.champion}</p>
            {clips.map((clip, index) => (
              <AudioDistortionPlayer key={clip.url} src={clip.url} level={index + 1} label={`Línea ${index + 1}`} />
            ))}
          </div>
        ) : !error ? <p className="hint">Cargando clips…</p> : null}
      </section>
    </main>
  );
}
