/**
 * Un candado por sala.
 *
 * Con estado en memoria Node ya serializa, pero en cuanto el repositorio sea
 * asíncrono (Postgres) dos operaciones pueden intercalarse entre leer y
 * escribir. Este candado mantiene la garantía hoy y mañana.
 */
const chains = new Map<string, Promise<unknown>>();

export function withRoomLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = chains.get(key) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  const tail = run.catch(() => undefined);
  chains.set(key, tail);
  void tail.then(() => {
    if (chains.get(key) === tail) chains.delete(key);
  });
  return run;
}
