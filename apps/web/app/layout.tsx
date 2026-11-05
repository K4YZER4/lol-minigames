import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://lol-minigames.vercel.app"),
  title: {
    default: "LoL Party | Impostor y minijuegos de League of Legends",
    template: "%s | LoL Party",
  },
  description: "Juega LoL Impostor y minijuegos de League of Legends con tus amigos. Crea una sala privada, invita a tu equipo y descubre quién sabe más de LoL. Play League of Legends party games with friends.",
  keywords: ["LoL Impostor", "League of Legends impostor game", "minijuegos de LoL", "League of Legends party games", "juegos de LoL con amigos"],
  applicationName: "LoL Party",
  category: "games",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "LoL Party",
    title: "LoL Party | Impostor y minijuegos de League of Legends",
    description: "Minijuegos de League of Legends para jugar con amigos. LoL Impostor, Pictionary, carreras y más.",
    locale: "es_MX",
    alternateLocale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "LoL Party | League of Legends party games",
    description: "Play LoL Impostor and League of Legends minigames with your friends.",
  },
  icons: { icon: "/images/logo-lol-party.png", apple: "/images/logo-lol-party.png" },
};

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "LoL Party",
      alternateName: "LoL Impostor and League of Legends Party Games",
      url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://lol-minigames.vercel.app",
      inLanguage: ["es-MX", "en-US"],
    },
    {
      "@type": "VideoGame",
      name: "LoL Party",
      description: "A collection of League of Legends party minigames, including an impostor game, for friends to play in private rooms.",
      applicationCategory: "Game",
      genre: ["Party game", "Social deduction", "Trivia"],
      gamePlatform: "Web browser",
      isAccessibleForFree: true,
      url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://lol-minigames.vercel.app",
    },
  ],
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }} />
      </head>
      <body>
        <video className="site-video-bg" autoPlay muted loop playsInline aria-hidden="true">
          <source src="/video/agua-neon-pingpong-loop.mp4" type="video/mp4" />
        </video>
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
