import type { BombaSettings, CarreraSettings, ImpostorSettings, ModeId, PictionarySettings, QuienSoySettings, UnicaSettings } from "@lolgames/protocol";
import type { BombaState } from "@lolgames/engine";
import type { ImpostorState } from "@lolgames/engine";
import type { PictionaryState } from "@lolgames/engine";
import type { UnicaState } from "@lolgames/engine";
import type { QuienSoyState } from "@lolgames/engine";
import type { CarreraState } from "@lolgames/engine";

export type Player = {
  id: string;
  name: string;
  nameKey: string;
  avatar: { id: string; imageUrl: string };
  /** Orden de llegada. El host es el conectado con seq más bajo. */
  seq: number;
  connected: boolean;
  ready: boolean;
  socketId: string | null;
  disconnectedAt: number | null;
  token: string;
  recentRequests: string[];
};

export type GameState = BombaState | ImpostorState | PictionaryState | UnicaState | QuienSoyState | CarreraState;

export type Room = {
  id: string;
  code: string;
  createdAt: number;
  lastActivityAt: number;
  players: Player[];
  hostId: string | null;
  mode: ModeId;
  phase: "LOBBY" | "PLAYING" | "FINISHED";
  stateVersion: number;
  game: GameState | null;
  settings: {
    bomba: BombaSettings;
    impostor: ImpostorSettings;
    pictionary: PictionarySettings;
    unica: UnicaSettings;
    quienSoy: QuienSoySettings;
    carrera: CarreraSettings;
  };
  scores: Record<string, number>;
  /** Desplazamiento del primer hablante de Impostor en la siguiente ronda. */
  impostorRoundOffset: number;
};

export type IncomingAction =
  | { kind: "bomba:answer"; requestId: string; championId: string }
  | { kind: "impostor:ack"; requestId: string }
  | { kind: "impostor:clue"; requestId: string; text: string }
  | { kind: "impostor:vote"; requestId: string; targetId: string | null }
  | { kind: "pictionary:stroke"; requestId: string; points: { x: number; y: number }[] }
  | { kind: "pictionary:guess"; requestId: string; championId: string }
  | { kind: "unica:submit"; requestId: string; championId: string }
  | { kind: "quien-soy:question"; requestId: string; text: string }
  | { kind: "quien-soy:answer"; requestId: string; answer: boolean }
  | { kind: "quien-soy:guess"; requestId: string; championId: string }
  | { kind: "carrera:answer"; requestId: string; championId: string };
