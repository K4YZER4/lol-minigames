import type { Metadata } from "next";
import Link from "next/link";
import styles from "./portafolio.module.css";

export const metadata: Metadata = {
  title: "Portafolio Técnico & Demo | LoL Party",
  description:
    "Case study de ingeniería Full-Stack: plataforma multijugador en tiempo real con Next.js 15, NestJS, Socket.IO, motor determinista en TypeScript, validación Zod y despliegue en Vercel, Render y Cloudflare R2.",
  alternates: { canonical: "/portafolio" },
  openGraph: {
    title: "LoL Party · Case Study Full-Stack en Tiempo Real",
    description:
      "Arquitectura, demo en video, WebSockets autoritativos, seguridad y stack completo de LoL Party.",
  },
};

const REPO_URL = "https://github.com/K4YZER4/lol-minigames";

const ARCHITECTURE_MODULES = [
  {
    pkg: "apps/web",
    title: "Frontend Reactivo",
    desc: "Aplicación Next.js 15 (App Router) con React 19 y TypeScript. Maneja estado en tiempo real vía Socket.IO, Canvas interactivo para dibujo colaborativo, grabación/reproducción con MediaRecorder y Web Audio API, internacionalización (ES/EN) y temas dinámicos.",
    tags: ["Next.js 15", "React 19", "Socket.IO Client", "HTML5 Canvas", "Web Audio"],
  },
  {
    pkg: "apps/server",
    title: "Backend Autoritativo & Gateway",
    desc: "Servidor NestJS 12 con WebSocket Gateway y API REST. Implementa locking por sala (withRoomLock) contra condiciones de carrera, proxy opaco de imágenes y audios para prevenir trampas desde DevTools, y arquitectura hexagonal con puertos y adaptadores.",
    tags: ["NestJS 12", "Socket.IO 4", "Ports & Adapters", "Room Locks", "Media Proxy"],
  },
  {
    pkg: "packages/engine",
    title: "Motor Puro de Reglas",
    desc: "Lógica de los 9 minijuegos escrita como funciones puras y deterministas (PRNG con semilla, tick del servidor cada 250ms y separación estricta entre vista pública y vista privada por jugador). Totalmente independiente de la capa de red.",
    tags: ["Pure Functions", "Deterministic PRNG", "Authoritative Tick", "Vitest"],
  },
  {
    pkg: "packages/protocol",
    title: "Contratos End-to-End con Zod",
    desc: "Esquemas de validación en tiempo de ejecución con Zod 4 y tipos TypeScript compartidos entre cliente y servidor. Garantiza que cada evento WebSocket, trazo, voto o clip de audio sea validado antes de tocar el estado de la sala.",
    tags: ["Zod 4", "Type-Safe Events", "Schema Validation", "Monorepo"],
  },
];

const STACK_GROUPS = [
  {
    title: "Frontend & UX",
    items: ["Next.js 15", "React 19", "TypeScript 5.9", "Socket.IO Client", "HTML5 Canvas", "MediaRecorder API", "CSS Glassmorphism"],
  },
  {
    title: "Backend & Real-Time",
    items: ["NestJS 12", "Socket.IO (WebSockets)", "Node.js", "Zod 4", "Arquitectura Hexagonal", "Idempotencia (requestId)"],
  },
  {
    title: "Seguridad & Calidad",
    items: ["Vitest (74+ tests)", "Rate Limiting multinivel", "Validación Cloudflare/Proxy IP", "CORS & Origin Allowlist", "Data URI Audio Sanitization"],
  },
  {
    title: "Infraestructura & Assets",
    items: ["Vercel (Frontend)", "Render (WebSocket Server)", "Cloudflare R2 (CDN Audio)", "Data Dragon Pipeline", "GitHub PR Workflow"],
  },
];

const ENGINEERING_CHALLENGES = [
  {
    title: "Sincronización autoritativa y concurrencia",
    desc: "Cada sala ejecuta mutaciones dentro de un lock asíncrono (withRoomLock) con versionado incremental (stateVersion) e historial de requestId para descartar eventos duplicados por reconexiones o doble clic.",
  },
  {
    title: "Anti-cheat y privacidad de estado por diseño",
    desc: "En modos con información oculta (Impostor, ¿Quién soy?, Pictionary), el servidor proyecta una vista privada individual por socket. Además, las pistas de imagen y voz pasan por endpoints con IDs opacos para no exponer nombres de campeones en Network.",
  },
  {
    title: "Hardening de WebSockets y abuso",
    desc: "Validación estricta de origen en el handshake, límite de conexiones simultáneas por IP, rate limiting por conexión/evento/acción, tope de operaciones de Canvas contra DoS de memoria y validación estricta Data URI en grabaciones de voz para evitar fugas de IP.",
  },
  {
    title: "Resiliencia ante cold starts (Render Free Tier)",
    desc: "Implementación de HealthGate: despierta el servidor silenciosamente al entrar a la web, mantiene la instancia viva con keep-alive inteligente (visibilitychange) y solo bloquea la UI bajo demanda si el usuario intenta crear o unirse antes de que esté listo.",
  },
];

const MODES_SHOWCASE = [
  { icon: "◕", name: "Bomba", desc: "Identifica la habilidad antes de que se apague la mecha.", tech: "Tick autoritativo + penalización dinámica" },
  { icon: "◈", name: "LoL Impostor", desc: "Deducción social por turnos con pistas y votaciones.", tech: "Proyección de vistas privadas por jugador" },
  { icon: "〰", name: "Pictionary", desc: "Dibuja al campeón en vivo mientras el resto adivina.", tech: "Sincronización de trazos, flood-fill y undo" },
  { icon: "?", name: "¿Quién soy?", desc: "Estilo Hedbanz: todos ven tu campeón menos tú.", tech: "Filtrado de secretos en servidor" },
  { icon: "➜", name: "Carrera de Pistas", desc: "Revelación progresiva de pistas contra el reloj.", tech: "Proxy opaco de imágenes con caché LRU" },
  { icon: "♫", name: "Carrera de Sonido", desc: "Reconoce campeones por sus líneas de voz (ES/EN).", tech: "Clips servidos desde Cloudflare R2" },
  { icon: "😀", name: "Carrera de Emojis", desc: "Descifra al campeón a partir de secuencias de emojis.", tech: "Puntuación escalonada por rapidez" },
  { icon: "★", name: "Imitación de Voz", desc: "Graba tu imitación y vota anónimamente con estrellas.", tech: "MediaRecorder + Data URI validado con Zod" },
  { icon: "✦", name: "Modo Party", desc: "Maratón que rota minijuegos con marcador global.", tech: "Orquestación de sub-motores en una sola sala" },
];

export default function PortafolioPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.badge}>Case Study · Full-Stack Real-Time Multiplayer</span>
        <h1 className={styles.title}>
          LoL <span className={styles.titleAccent}>Party</span>
        </h1>
        <p className={styles.lead}>
          Plataforma web multijugador en tiempo real construida desde cero como monorepo TypeScript.
          Permite crear salas privadas sin registro y jugar 9 minijuegos sincronizados vía WebSockets
          con servidor autoritativo, motor de reglas puro y medidas de seguridad listas para producción.
        </p>

        <div className={styles.actions}>
          <Link href="/" className={styles.btnPrimary}>
            Probar la app en vivo →
          </Link>
          <a href="#demo" className={styles.btnSecondary}>
            Ver demo en video ↓
          </a>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className={styles.btnGhost}>
            Repositorio en GitHub ↗
          </a>
        </div>

        <div className={styles.kpis}>
          <div className={styles.kpi}>
            <span className={styles.kpiValue}>9</span>
            <span className={styles.kpiLabel}>Minijuegos en tiempo real</span>
          </div>
          <div className={styles.kpi}>
            <span className={styles.kpiValue}>4</span>
            <span className={styles.kpiLabel}>Paquetes en Monorepo TS</span>
          </div>
          <div className={styles.kpi}>
            <span className={styles.kpiValue}>74+</span>
            <span className={styles.kpiLabel}>Tests (Engine + Seguridad)</span>
          </div>
          <div className={styles.kpi}>
            <span className={styles.kpiValue}>250 ms</span>
            <span className={styles.kpiLabel}>Tick autoritativo en servidor</span>
          </div>
        </div>
      </section>

      <section id="demo" className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.eyebrow}>Demostración en vivo · 3 ventanas simultáneas</div>
          <h2 className={styles.sectionTitle}>Sincronización real en WebSockets con 3 jugadores</h2>
          <p className={styles.sectionDesc}>
            Grabación real de ~48 segundos contra el backend de NestJS + Socket.IO con 3 navegadores
            aislados (temas Azul y Lila): creación de sala con avatares reales, cartas privadas en
            Impostor, dibujo en vivo en Pictionary, vistas ocultas en ¿Quién soy?, Bomba y Carrera de Emojis.
          </p>
        </div>

        <div className={styles.videoCard}>
          <div className={styles.videoWrap}>
            <video
              className={styles.video}
              controls
              playsInline
              preload="metadata"
              poster="/video/demo-portafolio-poster.png"
            >
              <source src="/video/demo-portafolio.mp4" type="video/mp4" />
              Tu navegador no soporta la reproducción de video HTML5.
            </video>
          </div>
          <div className={styles.videoFooter}>
            <div className={styles.chapterList}>
              <span className={styles.chapter}>Salas sin registro</span>
              <span className={styles.chapter}>Bomba</span>
              <span className={styles.chapter}>Impostor</span>
              <span className={styles.chapter}>Pictionary Canvas</span>
              <span className={styles.chapter}>Carrera de Pistas & Emojis</span>
              <span className={styles.chapter}>¿Quién soy? & Party</span>
            </div>
            <a href="/video/demo-portafolio.mp4" download="lol-party-demo.mp4" className={styles.btnSecondary}>
              Descargar MP4 ↓
            </a>
          </div>
        </div>
      </section>

      <section id="arquitectura" className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.eyebrow}>Arquitectura del sistema</div>
          <h2 className={styles.sectionTitle}>Monorepo modular con servidor autoritativo</h2>
          <p className={styles.sectionDesc}>
            Separación estricta entre interfaz, transporte WebSocket, validación de contratos y lógica
            pura de juego para facilitar testing determinista y escalabilidad.
          </p>
        </div>

        <div className={styles.grid2}>
          {ARCHITECTURE_MODULES.map((mod) => (
            <article key={mod.pkg} className={styles.card}>
              <div className={styles.cardHead}>
                <h3 className={styles.cardTitle}>{mod.title}</h3>
                <span className={styles.codeTag}>{mod.pkg}</span>
              </div>
              <p className={styles.cardText}>{mod.desc}</p>
              <div className={styles.tags}>
                {mod.tags.map((tag) => (
                  <span key={tag} className={styles.tag}>{tag}</span>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className={styles.flowBox} aria-label="Flujo de comunicación en tiempo real">
          <span className={styles.flowNode}>Cliente (Next.js + Socket.IO)</span>
          <span className={styles.flowArrow}>⇄</span>
          <span className={styles.flowNode}>Gateway (NestJS + Rate Limit + Zod)</span>
          <span className={styles.flowArrow}>⇄</span>
          <span className={styles.flowNode}>RoomService (Lock + Session Token)</span>
          <span className={styles.flowArrow}>⇄</span>
          <span className={styles.flowNode}>Engine Puro (Estado + Vistas Privadas)</span>
        </div>
      </section>

      <section id="stack" className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.eyebrow}>Stack tecnológico</div>
          <h2 className={styles.sectionTitle}>Tecnologías y herramientas utilizadas</h2>
        </div>

        <div className={styles.grid2}>
          {STACK_GROUPS.map((group) => (
            <article key={group.title} className={styles.card}>
              <h3 className={styles.cardTitle}>{group.title}</h3>
              <div className={styles.tags}>
                {group.items.map((item) => (
                  <span key={item} className={styles.tag}>{item}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="retos" className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.eyebrow}>Decisiones de ingeniería</div>
          <h2 className={styles.sectionTitle}>Retos técnicos resueltos en producción</h2>
        </div>

        <div className={styles.grid2}>
          {ENGINEERING_CHALLENGES.map((item) => (
            <article key={item.title} className={styles.card}>
              <h3 className={styles.cardTitle} style={{ marginBottom: 8 }}>{item.title}</h3>
              <p className={styles.cardText}>{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="modos-tech" className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.eyebrow}>Mecánicas implementadas</div>
          <h2 className={styles.sectionTitle}>Los 9 minijuegos y su base técnica</h2>
        </div>

        <div className={styles.grid3}>
          {MODES_SHOWCASE.map((mode) => (
            <article key={mode.name} className={styles.modeCard}>
              <div className={styles.modeTop}>
                <span className={styles.modeIcon} aria-hidden="true">{mode.icon}</span>
                <h3 className={styles.modeName}>{mode.name}</h3>
              </div>
              <p className={styles.cardText}>{mode.desc}</p>
              <div className={styles.modeTech}>{mode.tech}</div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.ctaBanner}>
        <h2>¿Quieres verlo funcionando en tiempo real?</h2>
        <p>
          Abre una sala privada en segundos, invita a alguien o prueba la aplicación en dos pestañas
          para comprobar la sincronización por WebSockets en vivo.
        </p>
        <div className={styles.actions} style={{ marginBottom: 0 }}>
          <Link href="/" className={styles.btnPrimary}>
            Ir a jugar ahora →
          </Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className={styles.btnSecondary}>
            Explorar código en GitHub ↗
          </a>
        </div>
      </section>
    </main>
  );
}
