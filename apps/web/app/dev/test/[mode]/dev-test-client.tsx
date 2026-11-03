"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ModeId } from "@lolgames/protocol";
import { SERVER_URL } from "@/lib/socket";
import { DEV_MODE_LABELS } from "@/lib/dev-modes";

export function DevTestClient({ mode, players }: { mode: ModeId; players: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    const url = `${SERVER_URL}/api/dev/test-room?mode=${encodeURIComponent(mode)}&players=${encodeURIComponent(players)}`;

    fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`El servidor respondió ${response.status}. ¿Sigue encendido en ${SERVER_URL}?`);
        }
        const data = (await response.json()) as { ok?: boolean; message?: string; hostPath?: string };
        if (!data.ok || !data.hostPath) {
          throw new Error(data.message ?? "No se pudo crear la sala de prueba.");
        }
        if (!cancelled) router.replace(data.hostPath);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo conectar con el servidor de juego.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, mode, players, router]);

  return (
    <main className="container dev-test">
      <section className="panel dev-test-card">
        <div className="eyebrow">Solo desarrollo</div>
        <h1>{DEV_MODE_LABELS[mode]}</h1>
        {error ? (
          <>
            <p className="hint" style={{ color: "var(--danger)" }}>
              {error}
            </p>
            <button className="primary" onClick={() => setAttempt((value) => value + 1)}>
              Reintentar
            </button>
          </>
        ) : (
          <>
            <div className="dev-test-spinner" aria-hidden />
            <p className="hint">
              Creando sala con {players} jugadores y arrancando la partida…
            </p>
          </>
        )}
      </section>
    </main>
  );
}
