import { rmSync } from "node:fs";
import { join } from "node:path";

/**
 * Borra un directorio de salida de Next.
 * Sin argumentos limpia `.next` (desarrollo); con argumento limpia ese nombre,
 * por ejemplo `.next-build` antes de un build de producción.
 */
const target = process.argv[2] ?? ".next";
rmSync(join(process.cwd(), target), { recursive: true, force: true });
