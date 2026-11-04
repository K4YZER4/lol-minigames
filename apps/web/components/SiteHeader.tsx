"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "lolparty:theme";

export function SiteHeader() {
  const [lila, setLila] = useState(false);

  useEffect(() => {
    setLila(document.documentElement.classList.contains("lila"));
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
      <Link href="/" className="logo" aria-label="LoL Party, ir al inicio">
        <img src="/images/logo-lol-party.png" alt="" className="logo-image" />
        LOL<span>PARTY</span>
      </Link>

      <nav aria-label="Navegación principal">
        <Link className="ghost" href="/">Inicio</Link>
        <Link className="ghost" href="/#modos">Modos</Link>
        <button
          type="button"
          className={`dot${lila ? "" : " active"}`}
          style={{ background: "#72d9ff" }}
          aria-label="Paleta azul"
          aria-pressed={!lila}
          onClick={() => apply(false)}
        />
        <button
          type="button"
          className={`dot${lila ? " active" : ""}`}
          style={{ background: "#8350c4" }}
          aria-label="Paleta lila"
          aria-pressed={lila}
          onClick={() => apply(true)}
        />
      </nav>
    </header>
  );
}
