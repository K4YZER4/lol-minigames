"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reloj estimado del servidor.
 *
 * En Impostor `phaseEndsAt` es público, así que el cliente puede mostrar la
 * cuenta atrás. En Bomba el vencimiento exacto nunca sale del servidor.
 */
export function useServerTime(serverTime: number): number {
  const offset = useRef(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    offset.current = serverTime - Date.now();
  }, [serverTime]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offset.current), 250);
    setNow(Date.now() + offset.current);
    return () => clearInterval(id);
  }, []);

  return now;
}
