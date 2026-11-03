"use client";

import { useMemo, useState, type FormEvent } from "react";
import { normalize, searchChampions, type Champion } from "@/lib/champions";

type Props = { champions: Champion[]; disabled?: boolean; placeholder?: string; submitLabel?: string; onPick: (championId: string) => void };

export function ChampionPicker({ champions, disabled, placeholder, submitLabel, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const results = useMemo(() => searchChampions(champions, query), [champions, query]);
  const open = focused && results.length > 0;

  // Enter solo confirma cuando no hay ambigüedad: coincidencia exacta o un único resultado.
  const preview = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return null;
    const exact = results.find((champion) => normalize(champion.name) === needle);
    if (exact) return exact;
    return results.length === 1 ? results[0]! : null;
  }, [query, results]);

  function pick(id: string) {
    setQuery("");
    setFocused(false);
    onPick(id);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled) return;
    if (preview) pick(preview.id);
  }

  return (
    <form className="picker" onSubmit={submit}>
      <input
        className="input"
        value={query}
        disabled={disabled || champions.length === 0}
        placeholder={champions.length === 0 ? "Cargando campeones…" : (placeholder ?? "¿Qué campeón es?")}
        autoComplete="off"
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 140)}
        onKeyDown={(event) => { if (event.key === "Escape") setFocused(false); }}
      />
      {open ? (
        <div className="picker-list" role="listbox">
          {results.map((champion) => (
            <button type="button" role="option" aria-selected="false" key={champion.id} className="picker-item" onMouseDown={(event) => { event.preventDefault(); pick(champion.id); }}>
              <img src={champion.imageUrl} alt="" loading="lazy" />
              <span>{champion.name}</span>
            </button>
          ))}
        </div>
      ) : null}
      {preview && !open ? (
        <div className="picker-preview">
          <img src={preview.imageUrl} alt="" />
          <span>{preview.name}</span>
          <small>Enter para confirmar</small>
        </div>
      ) : null}
      {submitLabel ? <button className="primary" type="submit" disabled={!preview || disabled}>{submitLabel}</button> : null}
    </form>
  );
}
