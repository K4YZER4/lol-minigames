#!/usr/bin/env node
/**
 * Extrae 5 líneas de voz por campeón desde la instalación local de League of Legends.
 *
 * Flujo:
 *   <Champion>.es_MX.wad.client
 *     -> wadtools (solo el .wpk de VO de la skin base)
 *     -> parser r3d2 propio (contenedor de .wem de Riot)
 *     -> vgmstream (Wwise Vorbis -> wav)
 *     -> ffmpeg (silencio + loudness + Opus mono 24 kbps)
 *
 * Salida:
 *   apps/web/public/audio/vo/es-mx/<Champion>/01..05.ogg
 *   apps/web/public/audio/vo/es-mx/manifest.json
 *
 * Herramientas (variables de entorno o rutas por defecto):
 *   LOL_CHAMPIONS_DIR  carpeta ...\Game\DATA\FINAL\Champions
 *   WADTOOLS           ruta a wadtools.exe
 *   VGMSTREAM          ruta a vgmstream-cli.exe (usar build 32-bit en Windows)
 *   FFMPEG/FFPROBE     rutas o nombres en PATH
 *
 * Uso:
 *   node scripts/extract-vo.mjs                 # todos los campeones
 *   node scripts/extract-vo.mjs --only Aatrox,Ahri
 *   node scripts/extract-vo.mjs --force         # re-extrae aunque exista
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLIPS_PER_CHAMPION = 5;

const CHAMPIONS_DIR =
  process.env.LOL_CHAMPIONS_DIR ??
  "C:\\Riot Games\\League of Legends\\Game\\DATA\\FINAL\\Champions";
const WADTOOLS = process.env.WADTOOLS ?? path.join(ROOT, "tools", "wadtools.exe");
const VGMSTREAM = process.env.VGMSTREAM ?? path.join(ROOT, "tools", "vgmstream-cli.exe");
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const FFPROBE = process.env.FFPROBE ?? "ffprobe";

const TMP_ROOT = path.join(os.tmpdir(), "lolgames-vo");

const args = process.argv.slice(2);
const force = args.includes("--force");
const localeArg = args.find((a) => a.startsWith("--locale="))?.split("=")[1] ?? "es-mx";
const LOCALE_CONFIG = {
  "es-mx": { output: "es-mx", wad: "es_MX", label: "español mexicano" },
  "en-us": { output: "en-us", wad: "en_US", label: "inglés estadounidense" },
}[localeArg];
if (!LOCALE_CONFIG) throw new Error(`Locale no soportado: ${localeArg}. Usa es-mx o en-us.`);
const LOCALE = LOCALE_CONFIG.output;
const LOCALE_WAD = LOCALE_CONFIG.wad;
const OUT_DIR = path.join(ROOT, "apps", "web", "public", "audio", "vo", LOCALE);
const MANIFEST_PATH = path.join(OUT_DIR, "manifest.json");
const onlyIndex = args.indexOf("--only");
const onlyArg =
  args.find((a) => a.startsWith("--only="))?.split("=").slice(1).join("=") ??
  (onlyIndex >= 0 ? args[onlyIndex + 1] : undefined);
const only = onlyArg
  ? new Set(
      String(onlyArg)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    )
  : null;
const concurrency = Number(
  args.find((a) => a.startsWith("--concurrency="))?.split("=")[1] ?? 4,
);

const champions = JSON.parse(
  fs.readFileSync(path.join(ROOT, "packages", "content", "data", "champions.json"), "utf8"),
).filter((c) => !only || only.has(c.id));

// ---------------------------------------------------------------------------
// helpers

function run(cmd, cmdArgs, label) {
  const result = spawnSync(cmd, cmdArgs, { encoding: "utf8", windowsHide: true });
  if (result.error) {
    throw new Error(`${label}: no se pudo ejecutar ${cmd}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim().split(/\r?\n/).slice(-4).join(" | ");
    throw new Error(`${label}: ${cmd} salió con ${result.status}${detail ? ` (${detail})` : ""}`);
  }
  return result.stdout ?? "";
}

function md5(buffer) {
  return createHash("md5").update(buffer).digest("hex");
}

/** Contenedor r3d2 de Riot: count + tabla de offsets + registros con nombre UTF-16LE. */
function readWpk(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString("ascii", 0, 4) !== "r3d2") {
    throw new Error(`no es un .wpk r3d2: ${file}`);
  }
  const count = buf.readUInt32LE(8);
  const entries = [];
  for (let i = 0; i < count; i++) {
    const record = buf.readUInt32LE(12 + i * 4);
    const dataOffset = buf.readUInt32LE(record);
    const dataSize = buf.readUInt32LE(record + 4);
    const nameLength = buf.readUInt32LE(record + 8);
    const name = buf.toString("utf16le", record + 12, record + 12 + nameLength * 2).replace(/\0/g, "");
    if (!name.toLowerCase().endsWith(".wem")) continue;
    if (dataOffset + dataSize > buf.length) continue;
    entries.push({ name, data: buf.subarray(dataOffset, dataOffset + dataSize) });
  }
  return entries;
}

/**
 * Elige candidatos variados: deduplica por contenido y reparte la selección
 * entre las líneas más largas (más distintivas) y las medianas.
 */
function pickCandidates(entries, limit) {
  const seen = new Set();
  const unique = [];
  for (const entry of entries) {
    if (entry.data.length < 2_000) continue; // menos de ~0.2 s: ruido, no una línea
    const hash = md5(entry.data);
    if (seen.has(hash)) continue;
    seen.add(hash);
    unique.push({ ...entry, hash });
  }
  unique.sort((a, b) => b.data.length - a.data.length);

  const ranges = [
    [45_000, 160_000],
    [30_000, 220_000],
    [20_000, 320_000],
    [12_000, 320_000],
    [6_000, 320_000],
    [2_000, Number.POSITIVE_INFINITY],
  ];
  let pool = unique;
  for (const [min, max] of ranges) {
    const filtered = unique.filter((e) => e.data.length >= min && e.data.length <= max);
    if (filtered.length >= limit) {
      pool = filtered;
      break;
    }
    pool = filtered;
  }
  if (pool.length < limit) pool = unique;

  // Bancos pequeños: quedarse con las líneas más largas. Bancos grandes: repartir
  // la selección entre las más largas para no quedarse solo con monólogos.
  if (pool.length <= limit * 3) {
    return pool.slice(0, limit);
  }
  const slice = pool.slice(0, limit * 3);
  const picks = [];
  for (let i = 0; i < limit && slice.length > 0; i++) {
    const index = Math.round((slice.length - 1) * (i / Math.max(1, limit - 1)));
    const candidate = slice[index];
    if (candidate && !picks.includes(candidate)) picks.push(candidate);
  }
  return picks;
}

function wavDurationMs(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString("ascii", 0, 4) !== "RIFF") return 0;
  let offset = 12;
  let byteRate = 0;
  let dataSize = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "fmt ") byteRate = buf.readUInt32LE(offset + 12);
    if (id === "data") dataSize = size;
    offset += 8 + size + (size % 2);
  }
  return byteRate > 0 ? Math.round((dataSize / byteRate) * 1000) : 0;
}

function probeDurationMs(file) {
  const out = run(
    FFPROBE,
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    "ffprobe",
  );
  const seconds = Number.parseFloat(out.trim());
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : 0;
}

// ---------------------------------------------------------------------------
// extracción

function extractVoicePackages(champion, workDir) {
  const wad = path.join(CHAMPIONS_DIR, `${champion.id}.${LOCALE_WAD}.wad.client`);
  if (!fs.existsSync(wad)) throw new Error(`no existe ${wad}`);

  // wadtools 0.5.x cambió el formato de los filtros: extraer todo evita que
  // el filtro deje fuera los WPK aunque el paquete sí contenga la voz.
  const out = path.join(workDir, "wad");
  fs.mkdirSync(out, { recursive: true });
  run(WADTOOLS, ["extract", "-i", wad, "-o", out], `wadtools ${champion.id}`);
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.toLowerCase().endsWith("_vo_audio.wpk")) found.push(full);
    }
  };
  walk(out);
  if (found.length > 0) {
    const base = found.find((file) => file.toLowerCase().includes(`${path.sep}skins${path.sep}base${path.sep}`));
    return [base, ...found.filter((file) => file !== base)].filter(Boolean);
  }
  throw new Error(`sin .wpk de VO para ${champion.id}`);
}

function processChampion(champion) {
  const workDir = path.join(TMP_ROOT, champion.id);
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  try {
    const wpks = extractVoicePackages(champion, workDir);
    const entries = wpks.flatMap((wpk) => readWpk(wpk));
    // Algunos campeones tienen WEM que no decodifican a la primera; ampliar el
    // banco de candidatos permite completar siempre las cinco pistas.
    const candidates = pickCandidates(entries, 60);
    if (candidates.length === 0) throw new Error(`el .wpk no tiene .wem utilizables`);

    const wemDir = path.join(workDir, "wem");
    const wavDir = path.join(workDir, "wav");
    fs.mkdirSync(wemDir, { recursive: true });
    fs.mkdirSync(wavDir, { recursive: true });

    const championOut = path.join(OUT_DIR, champion.id);
    fs.mkdirSync(championOut, { recursive: true });

    const clips = [];
    const audioSeen = new Set();

    for (const candidate of candidates) {
      if (clips.length >= CLIPS_PER_CHAMPION) break;

      const wemPath = path.join(wemDir, candidate.name);
      fs.writeFileSync(wemPath, candidate.data);
      const wavPath = path.join(wavDir, `${candidate.hash}.wav`);
      try {
        run(VGMSTREAM, ["-o", wavPath, wemPath], `vgmstream ${candidate.name}`);
      } catch {
        continue;
      }

      const audioHash = md5(fs.readFileSync(wavPath));
      if (audioSeen.has(audioHash)) continue;
      audioSeen.add(audioHash);

      const index = String(clips.length + 1).padStart(2, "0");
      const oggPath = path.join(championOut, `${index}.ogg`);
      try {
        run(
          FFMPEG,
          [
            "-hide_banner",
            "-loglevel", "error",
            "-y",
            "-i", wavPath,
            "-af",
            "silenceremove=start_periods=1:start_silence=0.05:start_threshold=-45dB," +
              "areverse,silenceremove=start_periods=1:start_silence=0.05:start_threshold=-45dB,areverse," +
              "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-t", "10",
            "-ac", "1",
            "-ar", "24000",
            "-c:a", "libopus",
            "-b:a", "24k",
            "-application", "audio",
            "-map_metadata", "-1",
            oggPath,
          ],
          `ffmpeg ${champion.id}`,
        );
      } catch {
        fs.rmSync(oggPath, { force: true });
        continue;
      }

      const durationMs = probeDurationMs(oggPath);
      if (durationMs < 400) {
        fs.rmSync(oggPath, { force: true });
        continue;
      }

      clips.push({
        file: `${champion.id}/${index}.ogg`,
        url: `/audio/vo/${LOCALE}/${champion.id}/${index}.ogg`,
        durationMs,
        bytes: fs.statSync(oggPath).size,
        sourceWem: candidate.name,
      });
    }

    if (clips.length === 0) throw new Error("no se pudo convertir ningún clip");
    return clips;
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// manifest + ejecución

function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return {
      locale: LOCALE_WAD,
      generatedAt: new Date().toISOString(),
      source:
        "Voces extraídas de la instalación local de League of Legends (paquetes es_MX). Uso local.",
      champions: {},
    };
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}

function writeManifest(manifest) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  manifest.generatedAt = new Date().toISOString();
  const totalClips = Object.values(manifest.champions).reduce((n, c) => n + c.clips.length, 0);
  const totalBytes = Object.values(manifest.champions).reduce(
    (n, c) => n + c.clips.reduce((m, clip) => m + clip.bytes, 0),
    0,
  );
  manifest.stats = {
    champions: Object.keys(manifest.champions).length,
    clips: totalClips,
    totalBytes,
  };
  const tmp = `${MANIFEST_PATH}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, MANIFEST_PATH);
}

async function main() {
  for (const tool of [WADTOOLS, VGMSTREAM]) {
    if (!fs.existsSync(tool)) {
      throw new Error(`falta la herramienta: ${tool}\nDefínela con WADTOOLS / VGMSTREAM.`);
    }
  }
  if (!fs.existsSync(CHAMPIONS_DIR)) {
    throw new Error(`no existe LOL_CHAMPIONS_DIR: ${CHAMPIONS_DIR}`);
  }

  const manifest = readManifest();
  const failures = [];
  let done = 0;
  const startedAt = Date.now();

  const queue = [...champions];
  async function worker() {
    while (queue.length > 0) {
      const champion = queue.shift();
      if (!champion) return;
      done += 1;
      const existing = manifest.champions[champion.id];
      if (!force && existing?.clips?.length === CLIPS_PER_CHAMPION) {
        console.log(`[${done}/${champions.length}] ${champion.id}: ya existe, se omite`);
        continue;
      }
      try {
        const clips = processChampion(champion);
        manifest.champions[champion.id] = {
          id: champion.id,
          name: champion.name,
          clips,
        };
        writeManifest(manifest);
        const kib = Math.round(clips.reduce((n, c) => n + c.bytes, 0) / 1024);
        console.log(
          `[${done}/${champions.length}] ${champion.id}: ${clips.length} clips, ${kib} KiB`,
        );
      } catch (error) {
        failures.push({ champion: champion.id, error: error.message });
        console.error(`[${done}/${champions.length}] ${champion.id}: ERROR ${error.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));
  writeManifest(manifest);

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  const { stats } = readManifest();
  console.log(
    `\nListo en ${seconds}s: ${stats.champions} campeones, ${stats.clips} clips, ` +
      `${(stats.totalBytes / 1024 / 1024).toFixed(1)} MiB`,
  );
  if (failures.length > 0) {
    console.log(`\nFallos (${failures.length}):`);
    for (const failure of failures) console.log(`  - ${failure.champion}: ${failure.error}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
