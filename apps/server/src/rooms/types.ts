import type { BombaSettings, CarreraEmojisSettings, CarreraSettings, CarreraSonidoSettings, ImitacionSettings, ImpostorSettings, ModeId, PictionarySettings, QuienSoySettings, PartySettings } from "@lolgames/protocol";
import type { BombaState } from "@lolgames/engine";
import type { ImpostorState } from "@lolgames/engine";
import type { PictionaryState } from "@lolgames/engine";
import type { QuienSoyState } from "@lolgames/engine";
import type { CarreraState } from "@lolgames/engine";
import type { CarreraSonidoState } from "@lolgames/engine";
import type { CarreraEmojisState } from "@lolgames/engine";
import type { ImitacionState } from "@lolgames/engine";
import type { PartyState } from "@lolgames/engine";

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

export type GameState = BombaState | ImpostorState | PictionaryState | QuienSoyState | CarreraState | CarreraSonidoState | CarreraEmojisState | ImitacionState | PartyState;

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
    quienSoy: QuienSoySettings;
    carrera: CarreraSettings;
    carreraSonido: CarreraSonidoSettings;
    carreraEmojis: CarreraEmojisSettings;
    imitacion: ImitacionSettings;
    party: PartySettings;
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
  | { kind: "pictionary:stroke"; requestId: string; points: { x: number; y: number; color?: string; width?: number }[] }
  | { kind: "pictionary:guess"; requestId: string; championId: string }
  | { kind: "pictionary:clear"; requestId: string }
  | { kind: "pictionary:undo"; requestId: string }
  | { kind: "pictionary:fill"; requestId: string; x: number; y: number; color: string }
  | { kind: "quien-soy:guess"; requestId: string; championId: string }
  | { kind: "carrera:answer"; requestId: string; championId: string }
  | { kind: "carrera-sonido:answer"; requestId: string; championId: string }
  | { kind: "carrera-emojis:answer"; requestId: string; championId: string }
  | { kind: "imitacion:submit"; requestId: string; audioData: string; mimeType: string }
  | { kind: "imitacion:vote"; requestId: string; recordingId: string; stars: number }
  | { kind: "party:guess"; requestId: string; championId: string };
