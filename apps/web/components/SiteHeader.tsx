"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getUiVolume, playUiSound, setUiVolume } from "@/lib/sounds";
import { getLanguage, setLanguage, type AppLanguage } from "@/lib/language";
import { useTranslation } from "@/lib/i18n";

const STORAGE_KEY = "lolparty:theme";

export function SiteHeader() {
  const [lila, setLila] = useState(false);
  const [volume, setVolume] = useState(1);
  const [language, setCurrentLanguage] = useState<AppLanguage>("es-mx");
  const [languageLocked, setLanguageLocked] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    setLila(document.documentElement.classList.contains("lila"));
    setVolume(getUiVolume());
    setCurrentLanguage(getLanguage());
  }, []);

  useEffect(() => {
    const onButtonClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("button, a")) playUiSound("click");
    };
    document.addEventListener("click", onButtonClick, true);
    return () => document.removeEventListener("click", onButtonClick, true);
  }, []);

  function apply(next: boolean) {
    setLila(next);
    document.documentElement.classList.toggle("lila", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "lila" : "azul");
    } catch {
      /* modo privado: la paleta no persiste, no es grave */
    }
  }

  return (
    <header className="site-header">
      <a href="/" className="logo" aria-label="LoL Party, ir al inicio" title="Volver al inicio">
        <img src="/images/logo-lol-party.png" alt="" className="logo-image" />
        LOL<span>PARTY</span>
      </a>

      <nav aria-label="Navegación principal">
        <Link className="ghost" href="/#modos">{t.modes}</Link>
        <button
          type="button"
          className="language-toggle"
          disabled={languageLocked}
          aria-label={`${t.audioLanguage}: ${language === "es-mx" ? "Español" : "English"}. Cambiar idioma`}
          title={`${t.audioLanguage}: ${language === "es-mx" ? "Español" : "English"}`}
          onClick={() => {
            if (languageLocked) return;
            const next = language === "es-mx" ? "en-us" : "es-mx";
            setCurrentLanguage(next);
            setLanguage(next);
            setLanguageLocked(true);
            window.setTimeout(() => setLanguageLocked(false), 3000);
          }}
        >
          {language === "es-mx" ? "Español" : "English"}
        </button>
        <label className="volume-control" title={`Volumen ${Math.round(volume * 100)}%`}>
          <span aria-hidden="true">{volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
           aria-label={t.volume(Math.round(volume * 100))}
            onChange={(event) => {
              const next = Number(event.target.value);
              setVolume(next);
              setUiVolume(next);
            }}
          />
        </label>
        <button
          type="button"
          className={`dot${lila ? "" : " active"}`}
          style={{ background: "#72d9ff" }}
          aria-label={t.bluePalette}
          aria-pressed={!lila}
          onClick={() => apply(false)}
        />
        <button
          type="button"
          className={`dot${lila ? " active" : ""}`}
          style={{ background: "#8350c4" }}
          aria-label={t.purplePalette}
          aria-pressed={lila}
          onClick={() => apply(true)}
        />
      </nav>
    </header>
  );
}
