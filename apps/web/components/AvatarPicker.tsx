"use client";

import { useState } from "react";
import type { Avatar } from "@/lib/avatars";

type Props = {
  avatars: Avatar[];
  selectedId: string | null;
  onChange: (id: string) => void;
};

export function AvatarPicker({ avatars, selectedId, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const selected = avatars.find((avatar) => avatar.id === selectedId) ?? avatars[0];
  return (
    <div className="avatar-picker">
      <div className="avatar-current">
        {selected ? <img src={selected.imageUrl} alt="Foto de perfil" /> : <span>✦</span>}
        <button type="button" className="avatar-edit" aria-label={editing ? "Cerrar selector de foto" : "Editar foto de perfil"} onClick={() => setEditing((value) => !value)}>
          {editing ? "×" : "✎"}
        </button>
      </div>
      {editing ? <div className="avatar-picker-grid">
        {avatars.slice(0, 24).map((avatar) => (
          <button key={avatar.id} type="button" className={`avatar-option${selectedId === avatar.id ? " selected" : ""}`} aria-label="Elegir emote" aria-pressed={selectedId === avatar.id} onClick={() => { onChange(avatar.id); setEditing(false); }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatar.imageUrl} alt="" />
          </button>
        ))}
      </div> : null}
    </div>
  );
}
