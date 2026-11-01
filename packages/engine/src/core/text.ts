/**
 * Normalización para comparar texto libre.
 * NFD separa los acentos, el rango 0300-036f los quita.
 */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Clave de unicidad de apodos: insensible a mayúsculas, acentos y espacios. */
export function nameKey(value: string): string {
  return normalizeText(value);
}

/**
 * ¿La pista escrita contiene el nombre del campeón?
 * Se compara normalizado para que "Kai'Sa", "kaisa" y "KAISA" cuenten igual.
 */
export function containsChampionName(text: string, championName: string): boolean {
  const needle = normalizeText(championName);
  if (needle.length < 3) return false;
  return normalizeText(text).includes(needle);
}
