"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SERVER_URL } from "@/lib/socket";
import { useTranslation } from "@/lib/i18n";
import { SERVER_GATE_DEMAND_EVENT, setServerStatus, type ServerStatus } from "@/lib/server-health";

const MAX_WAIT_MS = 90_000;
const RETRY_MS = 3_000;
const REQUEST_TIMEOUT_MS = 8_000;
const SLOW_HINT_MS = 8_000;
const KEEPALIVE_MS = 10 * 60_000;
const MODE_INTERVAL_MS = 2_800;

const MODES = [
  ["bomba", "◕"], ["impostor", "◈"], ["pictionary", "〰"], ["quien-soy", "?"],
  ["carrera", "➜"], ["carrera-sonido", "♫"], ["carrera-emojis", "😀"], ["imitacion", "★"], ["party", "✦"],
] as const;

type Status = ServerStatus;

/** Consulta el health del servidor con un límite de espera corto. */
async function pingHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const response = await fetch(`${SERVER_URL}/api/health`, {
      cache: "no-store",
      signal: controller.signal,
    });
    window.clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Despierta el servidor de Render al cargar la web y lo mantiene activo
 * mientras haya una pestaña abierta. Se monta como capa independiente: no
 * envuelve el contenido, así el HTML sigue disponible para SEO.
 */
export function HealthGate() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [status, setStatusState] = useState<Status>("checking");
  const [demanded, setDemanded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [slow, setSlow] = useState(false);
  const [modeIndex, setModeIndex] = useState(0);

  const setStatus = (next: Status) => {
    setStatusState(next);
    setServerStatus(next);
  };

  const isDemanded = demanded || Boolean(pathname?.startsWith("/room/"));
  const loading = !dismissed && isDemanded && status === "checking";

  useEffect(() => {
    const onDemand = (e: Event) => {
      const detail = (e as CustomEvent<{ force?: boolean }>).detail;
      setDemanded(true);
      if (detail?.force) {
        setDismissed(false);
      }
    };
    window.addEventListener(SERVER_GATE_DEMAND_EVENT, onDemand);
    return () => window.removeEventListener(SERVER_GATE_DEMAND_EVENT, onDemand);
  }, []);

  useEffect(() => {
    if (pathname?.startsWith("/room/")) {
      setDemanded(true);
    }
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const check = async () => {
      const ok = await pingHealth();
      if (cancelled) return;
      if (ok) {
        setStatus("ready");
        return;
      }
      if (Date.now() - startedAt >= MAX_WAIT_MS) {
        setStatus("timeout");
        return;
      }
      timer = setTimeout(check, RETRY_MS);
    };

    setStatus("checking");
    void check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [attempt]);

  // Mientras la pestaña siga abierta, evita que Render vuelva a dormirse.
  useEffect(() => {
    if (status !== "ready") return;
    let lastPing = Date.now();
    const keepAlive = () => {
      lastPing = Date.now();
      void pingHealth();
    };
    const interval = setInterval(keepAlive, KEEPALIVE_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastPing > KEEPALIVE_MS / 2) {
        keepAlive();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status]);

  useEffect(() => {
    if (status !== "checking" || !isDemanded) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), SLOW_HINT_MS);
    return () => clearTimeout(timer);
  }, [status, isDemanded]);

  useEffect(() => {
    if (!loading) return;
    setModeIndex(0);
    const timer = setInterval(() => {
      setModeIndex((index) => (index + 1) % MODES.length);
    }, MODE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loading]);

  const retry = () => {
    setStatus("checking");
    setDemanded(true);
    setDismissed(false);
    setAttempt((value) => value + 1);
  };

  const visible = !dismissed && (status === "timeout" || (isDemanded && status === "checking"));

  if (!visible) return null;

  const hint = status === "timeout"
    ? t.serverUnavailableHint
    : slow
      ? t.serverWakingSlow
      : t.serverWakingHint;
  const [modeId, modeIcon] = MODES[modeIndex]!;

  return (
    <div className="server-wakeup-overlay" role="status" aria-live="polite">
      <div className="server-wakeup-card">
        {status === "checking" ? (
          <div className="server-wakeup-spinner" aria-hidden="true" />
        ) : (
          <div className="server-wakeup-icon" aria-hidden="true">!</div>
        )}
        <h1>{status === "checking" ? t.serverWaking : t.serverUnavailable}</h1>
        <p>{hint}</p>
        {status === "checking" ? (
          <div className="server-wakeup-modes" aria-live="off">
            <div className="server-wakeup-modes-label">{t.chooseHow}</div>
            <div className="server-wakeup-mode" key={modeId}>
              <div className="server-wakeup-mode-icon" aria-hidden="true">{modeIcon}</div>
              <div>
                <strong>{t.modeName(modeId)}</strong>
                <p>{t.modeBlurb(modeId)}</p>
              </div>
            </div>
            <div className="server-wakeup-dots" aria-hidden="true">
              {MODES.map(([id], index) => (
                <span key={id} className={index === modeIndex ? "is-active" : ""} />
              ))}
            </div>
          </div>
        ) : null}
        {status === "timeout" ? (
          <div className="server-wakeup-actions">
            <button className="primary" onClick={retry}>{t.retry}</button>
            <button className="secondary" onClick={() => setDismissed(true)}>{t.continueAnyway}</button>
          </div>
        ) : slow ? (
          <div className="server-wakeup-actions">
            <button className="textbutton" onClick={() => setDismissed(true)}>{t.keepBrowsing}</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
