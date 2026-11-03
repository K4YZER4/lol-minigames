"use client";

import type { QuienSoyPrivateView, RoomView } from "@lolgames/protocol";
import type { Champion } from "@/lib/champions";
import { ChampionPicker } from "./ChampionPicker";
import { Timer } from "./Timer";

type Props = {
  room: RoomView;
  me: string | null;
  priv: QuienSoyPrivateView | null;
  champions: Champion[];
  onGuess: (championId: string) => void;
};

export function QuienSoyGame({ room, me, priv, champions, onGuess }: Props) {
  const game = room.game?.mode === "quien-soy" ? room.game : null;
  if (!game) return null;

  const names = new Map(room.players.map((player) => [player.playerId, player.name]));
  const avatars = new Map(room.players.map((player) => [player.playerId, player.avatar.imageUrl]));
  const scores = new Map(room.players.map((player) => [player.playerId, player.score]));
  const active = game.activePlayerId === me;
  const activeName = names.get(game.activePlayerId) ?? "otro jugador";
  const activeChampion = priv?.visible[game.activePlayerId] ?? null;
  const revealedByPlayer = new Map(game.revealed.map((turn) => [turn.playerId, turn]));
  const myTurn = me ? revealedByPlayer.get(me) ?? null : null;
  const myChampion = priv?.yourChampion ?? myTurn?.champion ?? null;
  const wrongGuesses = game.attempts
    .map((id) => champions.find((champion) => champion.id === id))
    .filter((champion): champion is Champion => Boolean(champion));

  const championOf = (playerId: string) => {
    if (playerId === me) return myChampion;
    return priv?.visible[playerId] ?? revealedByPlayer.get(playerId)?.champion ?? null;
  };

  return (
    <div className="game-shell hedbanz-layout">
      <section className="panel center hedbanz-heading">
        <div className="eyebrow">¿Quién soy? · Hedbanz</div>
        <h1>{active ? "¡Es tu turno!" : `Turno de ${activeName}`}</h1>
        <p className="muted">
          Todos ven tu campeón menos tú. Pregunta de sí/no por Discord y adivina aquí.
        </p>
        <div className="timerbox">
          <Timer
            endsAt={game.phaseEndsAt}
            serverTime={room.serverTime}
            totalMs={room.settings.quienSoy.turnSeconds * 1000}
            label={`Turno ${game.turnIndex + 1} de ${game.totalTurns}`}
          />
        </div>
      </section>

      <section className={`panel center hedbanz-mine${active ? " is-active" : ""}`}>
        <div className="eyebrow">Tu campeón</div>
        {myChampion ? (
          <>
            <div className="hedbanz-mine-img"><img src={myChampion.imageUrl} alt={myChampion.name} /></div>
            <h2>{myChampion.name}</h2>
            <span className={`tag ${myTurn?.solved ? "tag-green" : "tag-red"}`}>
              {myTurn?.solved ? "Acertaste +1" : "Turno terminado"}
            </span>
          </>
        ) : (
          <>
            <div className="hedbanz-mine-img is-hidden"><span>?</span></div>
            <h2>Secreto</h2>
            <p className="hint">
              {active
                ? "Nadie te lo va a decir. Pregunta y adivina."
                : "Se revela cuando termine tu turno."}
            </p>
          </>
        )}
      </section>

      <section className="panel hedbanz-board-panel">
        <h2>La mesa</h2>
        <p className="hint">Cada jugador tiene su campeón en la frente. Tú solo no ves el tuyo.</p>
        <div className="hedbanz-board">
          {game.order.map((playerId) => {
            const champion = championOf(playerId);
            const turn = revealedByPlayer.get(playerId);
            const isActive = playerId === game.activePlayerId;
            const isMe = playerId === me;
            const status = turn
              ? turn.solved
                ? "Acertó +1"
                : "No acertó"
              : isActive
                ? "Preguntando…"
                : "Pendiente";
            return (
              <div
                key={playerId}
                className={`hedbanz-player${isActive ? " is-active" : ""}${isMe ? " is-me" : ""}`}
              >
                <div className="hedbanz-player-head">
                  <div className="avatar"><img src={avatars.get(playerId)} alt="" /></div>
                  <div className="hedbanz-player-name">
                    <strong>{names.get(playerId) ?? "Jugador"}{isMe ? " · tú" : ""}</strong>
                    <small>{status} · {scores.get(playerId) ?? 0} pts</small>
                  </div>
                </div>
                <div className="hedbanz-player-champion">
                  {champion ? (
                    <>
                      <img src={champion.imageUrl} alt={champion.name} />
                      <span>{champion.name}</span>
                    </>
                  ) : (
                    <span className="hedbanz-unknown">?</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="hedbanz-action">
        {active ? (
          <section className="glass private hedbanz-guess">
            <div className="eyebrow">Tu turno</div>
            <h2>¿Quién crees que eres?</h2>
            <p className="hint">
              Acierto: +1 punto y termina tu turno. Fallo: puedes seguir intentando hasta que acabe el tiempo.
            </p>
            <ChampionPicker champions={champions} onPick={onGuess} submitLabel="Adivinar campeón" />
            {wrongGuesses.length > 0 ? (
              <div className="hedbanz-attempts">
                <span className="hint">Intentos fallidos</span>
                <div className="chips">
                  {wrongGuesses.map((champion) => (
                    <span className="chip" key={champion.id}>{champion.name}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="panel center hedbanz-watch">
            <div className="eyebrow">Todos lo ven menos {activeName}</div>
            {activeChampion ? (
              <>
                <div className="hedbanz-watch-img"><img src={activeChampion.imageUrl} alt={activeChampion.name} /></div>
                <h2>{activeChampion.name}</h2>
                <p className="muted">{activeName} tiene que descubrirlo con preguntas de sí/no.</p>
              </>
            ) : (
              <p className="hint">Esperando el campeón del turno…</p>
            )}
            {!myChampion ? (
              <p className="mini">Tu campeón sigue oculto. Lo verás al terminar tu turno.</p>
            ) : null}
          </section>
        )}
      </div>
    </div>
  );
}
