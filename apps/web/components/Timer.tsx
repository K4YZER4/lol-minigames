"use client";

import { useServerTime } from "@/lib/useServerClock";

type Props = {
  endsAt: number;
  serverTime: number;
  totalMs: number;
  label?: string;
};

export function Timer({ endsAt, serverTime, totalMs, label }: Props) {
  const now = useServerTime(serverTime);
  const remaining = Math.max(0, endsAt - now);
  const ratio = Math.max(0, Math.min(1, remaining / Math.max(1, totalMs)));
  const seconds = Math.ceil(remaining / 1000);

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="hint">{label ?? "Tiempo"}</span>
        <span className="mono" style={{ fontSize: 14 }}>
          {seconds}s
        </span>
      </div>
      <div className="timer">
        <div
          className={`timer-fill${remaining <= 5000 ? " urgent" : ""}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
