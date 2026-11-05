import type { Result, Rng } from "../core/rng";

export type ImitacionAudioClip = { clueId: string; championId: string; audioUrl: string; audioUrlEn?: string };
export type ImitacionSettings = { recordingSeconds: number; votingSeconds: number };
export type ImitacionRecording = { recordingId: string; playerId: string; audioData: string; mimeType: string; votes: Record<string, number> };
export type ImitacionState = {
  phase: "RECORDING" | "VOTING" | "REVEAL" | "FINISHED";
  settings: ImitacionSettings;
  players: string[];
  targetId: string;
  targetAudioUrl: string;
  targetAudioUrlEn: string | null;
  recordings: Record<string, ImitacionRecording>;
  scores: Record<string, number>;
  phaseEndsAt: number;
  winnerId: string | null;
};
export type ImitacionInit = { playerIds: string[]; settings: ImitacionSettings; clips: ImitacionAudioClip[]; now: number; rng: Rng };
export type ImitacionContext = { now: number; rng: Rng };
const reject = (code: string, message: string) => ({ code, message });

export function createImitacion(init: ImitacionInit): ImitacionState {
  const clip = init.rng.pick(init.clips);
  const scores: Record<string, number> = {};
  for (const playerId of init.playerIds) scores[playerId] = 0;
  return { phase: "RECORDING", settings: init.settings, players: [...init.playerIds], targetId: clip.championId, targetAudioUrl: clip.audioUrl, targetAudioUrlEn: clip.audioUrlEn ?? null, recordings: {}, scores, phaseEndsAt: init.now + init.settings.recordingSeconds * 1000, winnerId: null };
}

function enterVoting(state: ImitacionState, now: number): ImitacionState {
  return { ...state, phase: "VOTING", phaseEndsAt: now + state.settings.votingSeconds * 1000 };
}

export function imitacionSubmit(state: ImitacionState, playerId: string, audioData: string, mimeType: string, ctx: ImitacionContext): Result<ImitacionState> {
  if (state.phase !== "RECORDING") return { state, effects: [], reject: reject("WRONG_PHASE", "La grabación ya terminó") };
  if (!state.players.includes(playerId)) return { state, effects: [], reject: reject("NOT_IN_ROOM", "No estás en esta partida") };
  if (state.recordings[playerId]) return { state, effects: [], reject: reject("ALREADY_ANSWERED", "Ya enviaste tu imitación") };
  const recordings = { ...state.recordings, [playerId]: { recordingId: `recording-${Object.keys(state.recordings).length + 1}`, playerId, audioData, mimeType, votes: {} } };
  const next = Object.keys(recordings).length >= state.players.length ? enterVoting({ ...state, recordings }, ctx.now) : { ...state, recordings };
  return { state: next, effects: [] };
}

export function imitacionVote(state: ImitacionState, playerId: string, recordingId: string, stars: number, ctx: ImitacionContext): Result<ImitacionState> {
  if (state.phase !== "VOTING") return { state, effects: [], reject: reject("WRONG_PHASE", "La votación no está abierta") };
  const recording = Object.values(state.recordings).find((item) => item.recordingId === recordingId);
  if (!recording) return { state, effects: [], reject: reject("INVALID_TARGET", "Esa grabación no existe") };
  if (recording.playerId === playerId) return { state, effects: [], reject: reject("INVALID_TARGET", "No puedes votar tu propia grabación") };
  if (Object.values(state.recordings).some((item) => item.votes[playerId] !== undefined)) return { state, effects: [], reject: reject("ALREADY_VOTED", "Ya votaste") };
  const recordings = Object.fromEntries(Object.entries(state.recordings).map(([id, item]) => [id, id === recording.playerId ? { ...item, votes: { ...item.votes, [playerId]: stars } } : item]));
  const voters = Object.values(recordings).reduce((total, item) => total + Object.keys(item.votes).length, 0);
  const next = voters >= state.players.length ? finishVoting({ ...state, recordings }, ctx.now) : { ...state, recordings };
  return { state: next, effects: [] };
}

function finishVoting(state: ImitacionState, now: number): ImitacionState {
  const averages = Object.values(state.recordings).filter((recording) => Object.keys(recording.votes).length > 0).map((recording) => ({ playerId: recording.playerId, average: Object.values(recording.votes).reduce((sum, value) => sum + value, 0) / Object.keys(recording.votes).length }));
  const winner = averages.slice().sort((a, b) => b.average - a.average)[0]?.playerId ?? null;
  const scores = { ...state.scores };
  for (const { playerId, average } of averages) scores[playerId] = Math.round(average * 200);
  return { ...state, phase: "REVEAL", phaseEndsAt: now + 2_000, winnerId: winner, scores };
}

export function imitacionTick(state: ImitacionState, ctx: ImitacionContext): Result<ImitacionState> {
  if (ctx.now < state.phaseEndsAt) return { state, effects: [] };
  if (state.phase === "RECORDING") return { state: enterVoting(state, ctx.now), effects: [] };
  if (state.phase === "VOTING") return { state: finishVoting(state, ctx.now), effects: [] };
  if (state.phase === "REVEAL") return { state: { ...state, phase: "FINISHED", phaseEndsAt: ctx.now }, effects: [] };
  return { state, effects: [] };
}

export function imitacionPublicView(state: ImitacionState) {
  const reveal = state.phase === "REVEAL" || state.phase === "FINISHED";
  return { mode: "imitacion" as const, phase: state.phase, phaseEndsAt: state.phaseEndsAt, targetAudioUrl: state.targetAudioUrl, targetAudioUrlEn: state.targetAudioUrlEn, recordings: Object.values(state.recordings).map((recording) => ({ recordingId: recording.recordingId, audioData: recording.audioData, mimeType: recording.mimeType, playerId: reveal ? recording.playerId : null, averageStars: Object.keys(recording.votes).length ? Object.values(recording.votes).reduce((sum, value) => sum + value, 0) / Object.keys(recording.votes).length : null, votes: Object.keys(recording.votes).length })), submitted: Object.keys(state.recordings), voted: [...new Set(Object.values(state.recordings).flatMap((recording) => Object.keys(recording.votes)))], winnerId: reveal ? state.winnerId : null };
}
export function imitacionPrivateView(state: ImitacionState, playerId: string) { return { mode: "imitacion" as const, isSubmitted: Boolean(state.recordings[playerId]), hasVoted: Object.values(state.recordings).some((recording) => recording.votes[playerId] !== undefined), ownRecordingId: state.recordings[playerId]?.recordingId ?? null }; }
export function imitacionResults(state: ImitacionState) { return { scores: state.scores }; }
