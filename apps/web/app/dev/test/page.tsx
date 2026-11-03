import Link from "next/link";
import { notFound } from "next/navigation";
import { DEV_MODES, DEV_MODE_LABELS } from "@/lib/dev-modes";

export const dynamic = "force-dynamic";

export default function DevTestHubPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="container dev-test">
      <div className="top">
        <div>
          <div className="eyebrow">Solo desarrollo</div>
          <h1>Pruebas rápidas</h1>
          <p className="muted">
            Cada enlace crea una sala nueva con jugadores automáticos ya listos y
            arranca la partida. Abre el que quieras en otra pestaña.
          </p>
        </div>
      </div>

      <section className="dev-test-grid">
        {DEV_MODES.map((mode) => (
          <Link className="panel dev-test-mode" href={`/dev/test/${mode.id}`} key={mode.id}>
            <strong>{DEV_MODE_LABELS[mode.id]}</strong>
            <span className="hint">{mode.blurb}</span>
            <span className="dev-test-players">{mode.players} jugadores →</span>
          </Link>
        ))}
      </section>

      <p className="hint">
        También puedes fijar la cantidad:{" "}
        <code>/dev/test/pictionary?players=8</code>
      </p>
    </main>
  );
}
