"use client";

import type { PublicChampion } from "@lolgames/protocol";

type Props = {
  champion: PublicChampion;
  /** Texto pequeño superior: "El campeón era" o "¡Correcto!". */
  eyebrow: string;
  /** Aclaración opcional debajo del nombre. */
  note?: string;
};

/** Tarjeta grande de revelación, compartida por el final de ronda y el acierto privado. */
export function CarreraRevealCard({ champion, eyebrow, note }: Props) {
  return <section className="panel carrera-reveal-card">
    <div className="eyebrow">{eyebrow}</div>
    <img src={champion.imageUrl} alt={champion.name} />
    <h2>{champion.name}</h2>
    {note ? <p className="hint">{note}</p> : null}
  </section>;
}
