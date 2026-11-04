"use client";

type Props = {
  code: string;
  onHome: () => void;
};

export function RoomNotFoundModal({ code, onHome }: Props) {
  return (
    <div className="warning-modal-backdrop" role="presentation">
      <section className="glass warning-modal" role="alertdialog" aria-modal="true" aria-labelledby="room-not-found-title">
        <div className="warning-icon">!</div>
        <div className="eyebrow">Sala no disponible</div>
        <h2 id="room-not-found-title">Esta sala no existe</h2>
        <p className="muted">El código <strong className="mono">{code}</strong> no corresponde a una sala activa. Puede haber expirado o el servidor pudo reiniciarse.</p>
        <div className="warning-actions">
          <button className="back-button" type="button" onClick={onHome}>← Volver al inicio</button>
        </div>
      </section>
    </div>
  );
}
