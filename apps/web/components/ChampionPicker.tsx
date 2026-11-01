"use client";

import { useMemo, useState } from "react";
import { searchChampions, type Champion } from "@/lib/champions";

type Props = { champions: Champion[]; disabled?: boolean; placeholder?: string; submitLabel?: string; onPick: (championId: string) => void };

export function ChampionPicker({ champions, disabled, placeholder, submitLabel, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const results = useMemo(() => searchChampions(champions, query), [champions, query]);
  const open = focused && results.length > 0;
  function pick(id: string) { setQuery(""); setFocused(false); onPick(id); }
  return <form className="picker" onSubmit={(event) => { event.preventDefault(); const first = results[0]; if (first) pick(first.id); }}>
    <input className="input" value={query} disabled={disabled || champions.length === 0} placeholder={champions.length === 0 ? "Cargando campeones…" : (placeholder ?? "¿Qué campeón es?")} autoComplete="off" onChange={(event) => setQuery(event.target.value)} onFocus={() => setFocused(true)} onBlur={() => window.setTimeout(() => setFocused(false), 140)} onKeyDown={(event) => { if (event.key === "Escape") setFocused(false); }} />
    {open ? <div className="picker-list">{results.map((champion) => <button type="button" key={champion.id} className="picker-item" onMouseDown={(event) => { event.preventDefault(); pick(champion.id); }}><img src={champion.imageUrl} alt="" loading="lazy" /><span>{champion.name}</span></button>)}</div> : null}
    {submitLabel ? <button className="primary" type="submit" disabled={!query.trim() || disabled}>{submitLabel}</button> : null}
  </form>;
}
