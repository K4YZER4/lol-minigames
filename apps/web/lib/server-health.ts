export type ServerStatus = "checking" | "ready" | "timeout";

export const SERVER_HEALTH_EVENT = "lolparty:server-health";
export const SERVER_GATE_DEMAND_EVENT = "lolparty:server-gate-demand";

let currentStatus: ServerStatus = "checking";

export function setServerStatus(status: ServerStatus): void {
  currentStatus = status;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SERVER_HEALTH_EVENT, { detail: status }));
  }
}

export function getServerStatus(): ServerStatus {
  return currentStatus;
}

export function isServerReady(): boolean {
  return currentStatus === "ready";
}

export function demandServerGate(force = false): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SERVER_GATE_DEMAND_EVENT, { detail: { force } }));
  }
}
