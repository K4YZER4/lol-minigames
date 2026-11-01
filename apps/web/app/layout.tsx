import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "LoL Party",
  description: "Minijuegos de League of Legends para jugar con amigos en sala privada.",
};

/**
 * Aplica la paleta guardada antes del primer paint para que no haya destello.
 */
const THEME_SCRIPT = `try{if(localStorage.getItem("lolparty:theme")==="lila")document.documentElement.classList.add("lila")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <SiteHeader />
        {children}
        <footer className="site-footer">
          <span>Hecho para jugar entre amigos</span>
          <span>LoL Party · Glass</span>
        </footer>
      </body>
    </html>
  );
}
