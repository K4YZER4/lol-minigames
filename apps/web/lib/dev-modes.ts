import type { ModeId } from "@lolgames/protocol";

export const DEV_MODE_LABELS: Record<ModeId, string> = {
  bomba: "Bomba",
  impostor: "Impostor",
  pictionary: "Pictionary",
  unica: "Respuesta única",
  "quien-soy": "¿Quién soy?",
  carrera: "Carrera de pistas",
  descripcion: "Descripción",
  duo: "Dúo a ciegas",
  party: "Party",
};

export type DevModeInfo = {
  id: ModeId;
  players: number;
  blurb: string;
};

/** Jugadores por defecto para que cada modo pueda iniciar sin configuración. */
export const DEV_MODES: DevModeInfo[] = [
  { id: "bomba", players: 4, blurb: "Turnos con bomba y pistas visuales." },
  { id: "impostor", players: 5, blurb: "Un infiltrado entre todos." },
  { id: "pictionary", players: 4, blurb: "Dibujo en canvas con puntuación." },
  { id: "unica", players: 4, blurb: "Respuestas sin repetir campeón." },
  { id: "quien-soy", players: 4, blurb: "Preguntas para descubrir tu campeón." },
  { id: "carrera", players: 4, blurb: "Pistas progresivas y velocidad." },
  { id: "descripcion", players: 4, blurb: "Describe sin decir el nombre." },
  { id: "duo", players: 4, blurb: "Parejas con campeones cruzados." },
  { id: "party", players: 4, blurb: "Rondas rápidas para el grupo." },
];
