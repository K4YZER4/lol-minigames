"use client";

import type { CarreraSonidoPrivateView, RoomView } from "@lolgames/protocol";
import type { Champion } from "@/lib/champions";
import { AudioDistortionPlayer } from "./AudioDistortionPlayer";
import { CarreraAnswerStatus } from "./CarreraAnswerStatus";
import { CarreraRevealCard } from "./CarreraRevealCard";
import { ChampionPicker } from "./ChampionPicker";
import { PlayerScoreRow } from "./PlayerScoreRow";
import { Timer } from "./Timer";
import { useLanguage } from "@/lib/useLanguage";
import { useTranslation } from "@/lib/i18n";

type Props = { room: RoomView; priv: CarreraSonidoPrivateView | null; champions: Champion[]; isHost: boolean; resetting: boolean; onAnswer: (id: string) => void; onReset: (mode?: "carrera-sonido") => void };

export function CarreraSonidoGame({ room, priv, champions, isHost, resetting, onAnswer, onReset }: Props) {
  const language = useLanguage();
  const { t } = useTranslation();
  const game = room.game?.mode === "carrera-sonido" ? room.game : null;
  if (!game) return null;
  const answered = priv?.hasAnswered ?? false;
  const winner = room.players.find((player) => player.playerId === game.winnerId);
  const privateTarget = priv?.revealedTarget ?? null;
  const publicTarget = game.phase !== "CLUES" ? game.target : null;
  const revealTarget = publicTarget ?? privateTarget;
  const showPrivateReveal = !publicTarget && Boolean(privateTarget);
  const current = game.clues[game.clueIndex];
  return <div className={`game-shell carrera-layout carrera-sonido-layout${revealTarget ? " has-reveal" : ""}`}>
     <div className="center carrera-heading"><div className="eyebrow">{t.soundRaceRound(game.round + 1, game.totalRounds)}</div><h1>{game.phase === "CLUES" ? t.listenAndGuess : game.phase === "FINISHED" ? t.raceFinished : t.answerRevealed}</h1><div className="timerbox"><Timer endsAt={game.phaseEndsAt} serverTime={room.serverTime} totalMs={room.settings.carreraSonido.clueSeconds * 1000} label={t.soundClue(game.clueIndex + 1, game.clues.length)} /></div></div>
    {revealTarget ? <CarreraRevealCard champion={revealTarget} eyebrow={t.was(revealTarget.name)} note={showPrivateReveal ? t.correct : undefined} /> : null}
     <section className="glass carrera-sonido-clues"><div className="audio-clue-list">{game.clues.map((clue, index) => <div className={`audio-clue-card${index === game.clueIndex ? " is-current" : ""}${index > game.clueIndex && game.phase === "CLUES" ? " is-locked" : ""}`} key={clue.clueId}><span className="audio-clue-number">{index + 1}</span><span>{index <= game.clueIndex || game.phase !== "CLUES" ? t.level(index + 1) : t.locked}</span>{index <= game.clueIndex && game.phase === "CLUES" ? <AudioDistortionPlayer src={language === "en-us" ? clue.audioUrlEn ?? clue.audioUrl : clue.audioUrl} level={index + 1} label={index === game.clueIndex ? t.currentClue : t.repeatClue} /> : null}</div>)}</div>{game.phase === "CLUES" && !answered ? <ChampionPicker champions={champions} onPick={onAnswer} placeholder={t.whatChampion} /> : showPrivateReveal ? null : <CarreraAnswerStatus answered={answered} winnerName={winner?.name ?? null} targetName={game.target?.name ?? null} />}</section>
     <aside className="panel carrera-sidebar"><div className="eyebrow">{t.score}</div>{room.players.slice().sort((a, b) => b.score - a.score).map((player) => <PlayerScoreRow player={player} key={player.playerId} />)}{game.phase === "FINISHED" && isHost ? <div className="result-actions"><button className="primary" disabled={resetting} onClick={() => onReset("carrera-sonido")}>{t.repeatSoundRace}</button></div> : null}</aside>
  </div>;
}
