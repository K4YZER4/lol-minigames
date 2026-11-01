"use client";

type Props = {
  code: string;
  onClose: () => void;
  onHome: () => void;
};

export function RoomNotFoundModal({ code, onClose, onHome }: Props) {
  return (
    <div className="warning-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="glass warning-modal" role="alertdialog" aria-modal="true" aria-labelledby="room-not-found-title">
        <button className="warning-modal-close" aria-label="Cerrar" onClick={onClose}>×</button>
        <div className="warning-icon">!</div>
        <div className="eyebrow">Sala no disponible</div>
        <h2 id="room-not-found-title">Esta sala no existe</h2>
        <p className="muted">El código <strong className="mono">{code}</strong> no corresponde a una sala activa. Puede haber expirado o el servidor pudo reiniciarse.</p>
        <div className="warning-actions">
          <button className="primary" onClick={onHome}>Volver al inicio</button>
          <button className="textbutton" onClick={onClose}>Cerrar</button>
        </div>
      </section>
    </div>
  );
}
