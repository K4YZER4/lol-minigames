import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Constantes del dominio                                              */
/* ------------------------------------------------------------------ */

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;
export const MAX_PLAYERS = 12;
export const MIN_PLAYERS = 3;
export const NICKNAME_MAX = 16;
export const RECONNECT_GRACE_MS = 30_000;

export const MODE_IDS = ["bomba", "impostor", "pictionary", "quien-soy", "carrera", "carrera-sonido", "carrera-emojis", "imitacion", "party"] as const;
export type ModeId = (typeof MODE_IDS)[number];

/* ------------------------------------------------------------------ */
/* Esquemas de entrada (todo lo que llega del cliente se valida)        */
/* ------------------------------------------------------------------ */

export const NicknameSchema = z
  .string()
  .transform((v) => v.trim().replace(/\s+/g, " "))
  .refine((v) => v.length >= 2 && v.length <= NICKNAME_MAX, {
    message: `El apodo debe tener entre 2 y ${NICKNAME_MAX} caracteres`,
  })
  .refine((v) => /^[\p{L}\p{N} _.'-]+$/u.test(v), {
    message: "El apodo tiene caracteres no permitidos",
  });

export const RoomCodeSchema = z
  .string()
  .transform((v) => v.trim().toUpperCase())
  .refine(
    (v) =>
      v.length === ROOM_CODE_LENGTH &&
      [...v].every((c) => ROOM_CODE_ALPHABET.includes(c)),
    { message: "Código de sala inválido" },
  );

export const TokenSchema = z.string().length(64).regex(/^[a-f0-9]+$/);

export const AvatarIdSchema = z.string().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/);

export const ChampionIdSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9']+$/, "Identificador de campeón inválido");

export const RequestIdSchema = z.string().min(1).max(64);

const BombaSettingsBase = z.object({
  lives: z.number().int().min(1).max(9),
  minFuseMs: z.number().int().min(5_000).max(60_000),
  maxFuseMs: z.number().int().min(5_000).max(120_000),
  penaltyMs: z.number().int().min(0).max(10_000),
  minMarginMs: z.number().int().min(0).max(15_000),
});

export const BombaSettingsSchema = BombaSettingsBase.refine(
  (s) => s.minFuseMs <= s.maxFuseMs,
  { message: "La mecha mínima no puede superar a la máxima" },
);

/** Parche parcial: se valida completo recién cuando se fusiona en la sala. */
export const BombaSettingsPatchSchema = BombaSettingsBase.partial();

export const ImpostorSettingsSchema = z.object({
  assignmentSeconds: z.number().int().min(5).max(120),
  clueSeconds: z.number().int().min(10).max(180),
  discussionSeconds: z.number().int().min(10).max(600),
  voteSeconds: z.number().int().min(10).max(180),
});

export type BombaSettings = z.infer<typeof BombaSettingsSchema>;
export type ImpostorSettings = z.infer<typeof ImpostorSettingsSchema>;

export const DEFAULT_BOMBA_SETTINGS: BombaSettings = {
  lives: 3,
  minFuseMs: 10_000,
  maxFuseMs: 30_000,
  penaltyMs: 1_000,
  minMarginMs: 3_000,
};

export const DEFAULT_IMPOSTOR_SETTINGS: ImpostorSettings = {
  assignmentSeconds: 15,
  clueSeconds: 20,
  discussionSeconds: 60,
  voteSeconds: 30,
};

export const PictionarySettingsSchema = z.object({
  drawingSeconds: z.number().int().min(30).max(300),
  rounds: z.number().int().min(1).max(10),
});
export type PictionarySettings = z.infer<typeof PictionarySettingsSchema>;
export const DEFAULT_PICTIONARY_SETTINGS: PictionarySettings = { drawingSeconds: 90, rounds: 3 };
export const CarreraSettingsSchema = z.object({ clueSeconds: z.number().int().min(3).max(30), rounds: z.number().int().min(1).max(10) });
export type CarreraSettings = z.infer<typeof CarreraSettingsSchema>;
export const DEFAULT_CARRERA_SETTINGS: CarreraSettings = { clueSeconds: 8, rounds: 5 };
export const CarreraSonidoSettingsSchema = z.object({ clueSeconds: z.number().int().min(3).max(30), rounds: z.number().int().min(1).max(10) });
export type CarreraSonidoSettings = z.infer<typeof CarreraSonidoSettingsSchema>;
export const DEFAULT_CARRERA_SONIDO_SETTINGS: CarreraSonidoSettings = { clueSeconds: 8, rounds: 5 };
export const CarreraEmojisSettingsSchema = z.object({ clueSeconds: z.number().int().min(3).max(30), rounds: z.number().int().min(1).max(10) });
export type CarreraEmojisSettings = z.infer<typeof CarreraEmojisSettingsSchema>;
export const DEFAULT_CARRERA_EMOJIS_SETTINGS: CarreraEmojisSettings = { clueSeconds: 5, rounds: 5 };
export const ImitacionSettingsSchema = z.object({ recordingSeconds: z.number().int().min(10).max(30), votingSeconds: z.number().int().min(15).max(120) });
export type ImitacionSettings = z.infer<typeof ImitacionSettingsSchema>;
export const DEFAULT_IMITACION_SETTINGS: ImitacionSettings = { recordingSeconds: 20, votingSeconds: 45 };
export const PartyCategorySchema = z.enum(["roles", "audio"]);
export const PartySettingsSchema = z.object({ category: PartyCategorySchema, turnSeconds: z.number().int().min(20).max(180), rounds: z.number().int().min(1).max(10) });
export type PartyCategory = z.infer<typeof PartyCategorySchema>;
export type PartySettings = z.infer<typeof PartySettingsSchema>;
export const DEFAULT_PARTY_SETTINGS: PartySettings = { category: "roles", turnSeconds: 60, rounds: 3 };
export const QuienSoySettingsSchema = z.object({ turnSeconds: z.number().int().min(20).max(180) });
export type QuienSoySettings = z.infer<typeof QuienSoySettingsSchema>;
export const DEFAULT_QUIEN_SOY_SETTINGS: QuienSoySettings = { turnSeconds: 60 };

export const SettingsSchema = z.object({
  mode: z.enum(MODE_IDS).optional(),
  bomba: BombaSettingsPatchSchema.optional(),
  impostor: ImpostorSettingsSchema.partial().optional(),
  pictionary: PictionarySettingsSchema.partial().optional(),
  carrera: CarreraSettingsSchema.partial().optional(),
  carreraSonido: CarreraSonidoSettingsSchema.partial().optional(),
  carreraEmojis: CarreraEmojisSettingsSchema.partial().optional(),
  imitacion: ImitacionSettingsSchema.partial().optional(),
  party: PartySettingsSchema.partial().optional(),
  quienSoy: QuienSoySettingsSchema.partial().optional(),
});

export type SettingsPatch = z.infer<typeof SettingsSchema>;

export const AnswerPayloadSchema = z.object({
  requestId: RequestIdSchema,
  championId: ChampionIdSchema,
});

export const CluePayloadSchema = z.object({
  requestId: RequestIdSchema,
  text: z.string().trim().min(1).max(80),
});

export const VotePayloadSchema = z.object({
  requestId: RequestIdSchema,
  targetId: z.string().min(1).max(64).nullable(),
});

export const PictionaryStrokePayloadSchema = z.object({
  requestId: RequestIdSchema,
  points: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(), width: z.number().min(0.001).max(0.03).optional() })).min(2).max(40),
});
export const PictionaryFillPayloadSchema = z.object({ requestId: RequestIdSchema, x: z.number().min(0).max(1), y: z.number().min(0).max(1), color: z.string().regex(/^#[0-9a-f]{6}$/i) });

export const PictionaryGuessPayloadSchema = z.object({
  requestId: RequestIdSchema,
  championId: ChampionIdSchema,
});

export const CarreraAnswerPayloadSchema = z.object({ requestId: RequestIdSchema, championId: ChampionIdSchema });
export const PartyGuessPayloadSchema = z.object({ requestId: RequestIdSchema, championId: ChampionIdSchema });
export const QuienSoyGuessPayloadSchema = z.object({ requestId: RequestIdSchema, championId: ChampionIdSchema });
export const ImitacionSubmitPayloadSchema = z.object({ requestId: RequestIdSchema, audioData: z.string().min(32).max(1_500_000), mimeType: z.string().max(80) });
export const ImitacionVotePayloadSchema = z.object({ requestId: RequestIdSchema, recordingId: z.string().min(1).max(80), stars: z.number().int().min(1).max(5) });

/* ------------------------------------------------------------------ */
/* Nombres de eventos                                                  */
/* ------------------------------------------------------------------ */

export const ClientEvents = {
  CREATE_ROOM: "room:create",
  JOIN_ROOM: "room:join",
  LEAVE_ROOM: "room:leave",
  SET_READY: "room:ready",
  CONFIGURE: "session:configure",
  START: "session:start",
  RESET: "session:reset",
  BOMBA_ANSWER: "bomba:answer",
  IMPOSTOR_ACK: "impostor:ack",
  IMPOSTOR_CLUE: "impostor:clue",
  IMPOSTOR_VOTE: "impostor:vote",
  PICTIONARY_STROKE: "pictionary:stroke",
  PICTIONARY_GUESS: "pictionary:guess",
  PICTIONARY_CLEAR: "pictionary:clear",
  PICTIONARY_UNDO: "pictionary:undo",
  PICTIONARY_FILL: "pictionary:fill",
  CARRERA_ANSWER: "carrera:answer",
  CARRERA_SONIDO_ANSWER: "carrera-sonido:answer",
  CARRERA_EMOJIS_ANSWER: "carrera-emojis:answer",
  IMITACION_SUBMIT: "imitacion:submit",
  IMITACION_VOTE: "imitacion:vote",
  PARTY_GUESS: "party:guess",
  QUIEN_SOY_GUESS: "quien-soy:guess",
} as const;

export const ServerEvents = {
  STATE: "room:state",
  PRIVATE: "private:state",
  EFFECT: "game:effect",
  REJECTED: "action:rejected",
} as const;

/* ------------------------------------------------------------------ */
/* Códigos de rechazo                                                  */
/* ------------------------------------------------------------------ */

export const REJECT_CODES = [
  "INVALID",
  "RATE_LIMITED",
  "ROOM_NOT_FOUND",
  "ROOM_FULL",
  "ROOM_STARTED",
  "NAME_TAKEN",
  "NOT_IN_ROOM",
  "NOT_HOST",
  "NOT_ENOUGH_PLAYERS",
  "WRONG_PHASE",
  "NOT_YOUR_TURN",
  "LATE",
  "UNKNOWN_CHAMPION",
  "WRONG_ANSWER",
  "NAME_IN_CLUE",
  "INVALID_TARGET",
  "ALREADY_VOTED",
  "ALREADY_GUESSED",
  "ALREADY_ANSWERED",
  "INVALID_STROKE",
  "INVALID_CATEGORY",
  "INVALID_QUESTION",
  "SESSION_REPLACED",
] as const;

export type RejectCode = (typeof REJECT_CODES)[number];

export type Reject = { ok: false; code: RejectCode; message: string };
export type Ok<T> = { ok: true } & T;

/* ------------------------------------------------------------------ */
/* Vistas públicas                                                     */
/* ------------------------------------------------------------------ */

export type PublicChampion = {
  id: string;
  name: string;
  imageUrl: string;
};

export type PlayerView = {
  playerId: string;
  name: string;
  avatar: { id: string; imageUrl: string };
  connected: boolean;
  ready: boolean;
  isHost: boolean;
  lives: number | null;
  eliminated: boolean;
  score: number;
};

export type BombaPublicClue = {
  clueId: string;
  kind: "spell" | "passive";
  imageUrl: string;
};

export type BombaGameView = {
  mode: "bomba";
  activePlayerId: string | null;
  clue: BombaPublicClue | null;
  /** Solo una señal aproximada: el vencimiento exacto nunca sale del servidor. */
  heat: "cold" | "warm" | "hot";
  explosions: number;
  finished: boolean;
};

export type ImpostorPhase =
  | "ASSIGNMENT"
  | "CLUES"
  | "DISCUSSION"
  | "VOTING"
  | "REVEAL";

export type ImpostorReveal = {
  assignment: Record<string, PublicChampion>;
  impostorIds: string[];
  caught: boolean;
  winners: string[];
  scores: Record<string, number>;
};

export type ImpostorGameView = {
  mode: "impostor";
  phase: ImpostorPhase;
  phaseEndsAt: number;
  clueOrder: string[];
  clueIndex: number;
  clues: { playerId: string; text: string }[];
  votesSubmitted: string[];
  reveal: ImpostorReveal | null;
};

export type PictionaryPoint = { x: number; y: number; color?: string; width?: number };
export type PictionaryFill = { x: number; y: number; color: string };
export type PictionaryOperation = { type: "stroke"; points: PictionaryPoint[] } | { type: "fill"; fill: PictionaryFill };
export type PictionaryGameView = {
  mode: "pictionary";
  phase: "DRAWING" | "REVEAL";
  phaseEndsAt: number;
  drawerId: string;
  roundIndex: number;
  totalRounds: number;
  strokes: PictionaryPoint[][];
  guesses: string[];
  target: PublicChampion | null;
  backgroundColor: string;
  fills: PictionaryFill[];
  operations: PictionaryOperation[];
  scores: Record<string, number>;
};

export type QuienSoyRevealedTurn = {
  playerId: string;
  champion: PublicChampion | null;
  solved: boolean;
  attempts: number;
};
export type QuienSoyGameView = {
  mode: "quien-soy";
  phase: "TURN" | "REVEAL";
  phaseEndsAt: number;
  activePlayerId: string;
  order: string[];
  turnIndex: number;
  totalTurns: number;
  /** Intentos fallidos del jugador activo. Nunca incluye su campeón. */
  attempts: string[];
  /** Turnos ya cerrados: ahí sí se revela el campeón de cada jugador. */
  revealed: QuienSoyRevealedTurn[];
};
export type CarreraGameView = { mode: "carrera"; phase: "CLUES" | "REVEAL" | "FINISHED"; phaseEndsAt: number; round: number; totalRounds: number; clueIndex: number; clues: BombaPublicClue[]; winnerId: string | null; target: PublicChampion | null };
export type CarreraSonidoGameView = { mode: "carrera-sonido"; phase: "CLUES" | "REVEAL" | "FINISHED"; phaseEndsAt: number; round: number; totalRounds: number; clueIndex: number; clues: { clueId: string; audioUrl: string }[]; winnerId: string | null; target: PublicChampion | null; scores: Record<string, number> };
export type CarreraEmojisGameView = { mode: "carrera-emojis"; phase: "CLUES" | "REVEAL" | "FINISHED"; phaseEndsAt: number; round: number; totalRounds: number; clueIndex: number; clues: { clueId: string; emojis: string[] }[]; winnerId: string | null; target: PublicChampion | null; scores: Record<string, number> };
export type ImitacionRecordingView = { recordingId: string; audioData: string; mimeType: string; playerId: string | null; averageStars: number | null; votes: number };
export type ImitacionGameView = { mode: "imitacion"; phase: "RECORDING" | "VOTING" | "REVEAL" | "FINISHED"; phaseEndsAt: number; targetAudioUrl: string | null; recordings: ImitacionRecordingView[]; submitted: string[]; voted: string[]; winnerId: string | null };
export type PartyGameView = { mode: "party"; phase: "GUESSING" | "REVEAL" | "FINISHED"; phaseEndsAt: number; category: PartyCategory; activePlayerId: string; round: number; totalRounds: number; guesses: { playerId: string; correct: boolean }[] };

export type GameView = BombaGameView | ImpostorGameView | PictionaryGameView | QuienSoyGameView | CarreraGameView | CarreraSonidoGameView | CarreraEmojisGameView | ImitacionGameView | PartyGameView;

export type RoomView = {
  code: string;
  roomId: string;
  stateVersion: number;
  phase: "LOBBY" | "PLAYING" | "FINISHED";
  hostId: string | null;
  mode: ModeId;
  players: PlayerView[];
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
  game: GameView | null;
  serverTime: number;
};

/* ------------------------------------------------------------------ */
/* Vistas privadas (nunca se difunden a la sala)                       */
/* ------------------------------------------------------------------ */

export type BombaPrivateView = {
  mode: "bomba";
  youAreActive: boolean;
  clue: BombaPublicClue | null;
};

export type ImpostorPrivateView = {
  mode: "impostor";
  /** Solo el campeón propio. Nunca una etiqueta de "eres el impostor". */
  champion: PublicChampion | null;
  yourVote: string | null;
  hasVoted: boolean;
  mustSubmitClue: boolean;
};

export type PictionaryPrivateView = {
  mode: "pictionary";
  target: PublicChampion | null;
  youAreDrawer: boolean;
};

export type QuienSoyPrivateView = {
  mode: "quien-soy";
  /** Campeones de los demás. Incluye al jugador activo si no eres tú. */
  visible: Record<string, PublicChampion>;
  /** Tu campeón: null hasta que termina tu turno. */
  yourChampion: PublicChampion | null;
  isActive: boolean;
  hasSolved: boolean;
};
export type CarreraPrivateView = { mode: "carrera"; hasAnswered: boolean; answer: string | null };
export type CarreraSonidoPrivateView = { mode: "carrera-sonido"; hasAnswered: boolean; answer: string | null };
export type CarreraEmojisPrivateView = { mode: "carrera-emojis"; hasAnswered: boolean; answer: string | null };
export type ImitacionPrivateView = { mode: "imitacion"; isSubmitted: boolean; hasVoted: boolean; ownRecordingId: string | null };
export type PartyPrivateView = { mode: "party"; target: PublicChampion | null; isActive: boolean; hasGuessed: boolean };

export type PrivateView = BombaPrivateView | ImpostorPrivateView | PictionaryPrivateView | QuienSoyPrivateView | CarreraPrivateView | CarreraSonidoPrivateView | CarreraEmojisPrivateView | ImitacionPrivateView | PartyPrivateView | null;

/* ------------------------------------------------------------------ */
/* Efectos transitorios (animaciones, no estado)                       */
/* ------------------------------------------------------------------ */

export type GameEffect =
  | { type: "bomba:correct"; playerId: string }
  | { type: "bomba:wrong"; playerId: string }
  | { type: "bomba:explosion"; playerId: string; eliminated: boolean }
  | { type: "impostor:reveal"; caught: boolean };

export type JoinAck =
  | { ok: true; playerId: string; token: string; roomCode: string; roomId: string }
  | Reject;

export type SimpleAck = { ok: true } | Reject;
