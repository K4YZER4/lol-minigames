"use client";

import { useEffect, useState } from "react";
import { SERVER_URL } from "@/lib/socket";
import { useTranslation } from "@/lib/i18n";

const MAX_WAIT_MS = 90_000;
const RETRY_MS = 3_000;
const REQUEST_TIMEOUT_MS = 8_000;
const OVERLAY_DELAY_MS = 700;

type Status = "checking" | "ready" | "timeout";

/**
 * Despierta el servidor de Render al cargar la web.
 * Se monta como capa independiente: no envuelve el contenido, así el HTML
 * sigue disponible para SEO y el layout no cambia de estructura.
 */
export function HealthGate() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>("checking");
  const [attempt, setAttempt] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    let cancelled = false;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const check = async () => {
      try {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        const response = await fetch(`${SERVER_URL}/api/health`, {
          cache: "no-store",
          signal: controller.signal,
        });
        window.clearTimeout(timeout);
        if (response.ok) {
          if (!cancelled) setStatus("ready");
          return;
        }
      } catch {
        // Render puede tardar en despertar; se reintenta abajo.
      }
      if (cancelled) return;
      if (Date.now() - startedAt >= MAX_WAIT_MS) {
        setStatus("timeout");
        return;
      }
      timer = setTimeout(check, RETRY_MS);
    };

    void check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [attempt, dismissed]);

  useEffect(() => {
    if (dismissed || status !== "checking") {
      setShowOverlay(false);
      return;
    }
    const timer = setTimeout(() => setShowOverlay(true), OVERLAY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [status, dismissed]);

  const retry = () => {
    setStatus("checking");
    setShowOverlay(false);
    setDismissed(false);
    setAttempt((value) => value + 1);
  };

  const visible = !dismissed && (showOverlay || status === "timeout");

  if (!visible) return null;

  return (
    <div className="server-wakeup-overlay" role="status" aria-live="polite">
      <div className="server-wakeup-card">
        {status === "checking" ? (
          <div className="server-wakeup-spinner" aria-hidden="true" />
        ) : (
          <div className="server-wakeup-icon" aria-hidden="true">!</div>
        )}
        <h1>{status === "checking" ? t.serverWaking : t.serverUnavailable}</h1>
        <p>{status === "checking" ? t.serverWakingHint : t.serverUnavailableHint}</p>
        {status === "timeout" ? (
          <div className="server-wakeup-actions">
            <button className="primary" onClick={retry}>{t.retry}</button>
            <button className="secondary" onClick={() => setDismissed(true)}>{t.continueAnyway}</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
