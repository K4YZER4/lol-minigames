#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const accountId = process.env.R2_ACCOUNT_ID;
const accessKey = process.env.R2_ACCESS_KEY_ID;
const secretKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;
const publicBase = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
const audioRoot = path.join(ROOT, "apps", "web", "public", "audio", "vo");
const locales = ["es-mx", "en-us"];

for (const [name, value] of Object.entries({ R2_ACCOUNT_ID: accountId, R2_ACCESS_KEY_ID: accessKey, R2_SECRET_ACCESS_KEY: secretKey, R2_BUCKET: bucket, R2_PUBLIC_BASE_URL: publicBase })) {
  if (!value) throw new Error(`Falta ${name} en .env.local`);
}

const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
const region = "auto";
const service = "s3";

function hmac(key, value) { return crypto.createHmac("sha256", key).update(value).digest(); }
function hash(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function encodePath(value) { return value.split("/").map((part) => encodeURIComponent(part)).join("/"); }
function contentType(file) {
  if (file.endsWith(".json")) return "application/json; charset=utf-8";
  if (file.endsWith(".ogg")) return "audio/ogg";
  return "application/octet-stream";
}

function authorization(method, key, body, type) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const date = amzDate.slice(0, 8);
  const payloadHash = hash(body);
  const host = new URL(endpoint).host;
  const canonicalUri = `/${encodePath(bucket)}/${encodePath(key)}`;
  const headers = {
    "content-type": type,
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const signedHeaders = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaders.map((name) => `${name}:${headers[name].trim()}\n`).join("");
  const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaders.join(";"), payloadHash].join("\n");
  const scope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, hash(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, date), region), service), "aws4_request");
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return {
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders.join(";")}, Signature=${signature}`,
    ...headers,
  };
}

async function upload(key, body) {
  const type = contentType(key);
  const response = await fetch(`${endpoint}/${encodePath(bucket)}/${encodePath(key)}`, {
    method: "PUT",
    headers: { ...authorization("PUT", key, body, type), "content-length": String(body.byteLength) },
    body,
  });
  if (!response.ok) throw new Error(`R2 rechazó ${key}: HTTP ${response.status} ${await response.text()}`);
}

function filesIn(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesIn(full);
    return [full];
  });
}

for (const locale of locales) {
  const dir = path.join(audioRoot, locale);
  const manifestPath = path.join(dir, "manifest.json");
  if (!fs.existsSync(dir) || !fs.existsSync(manifestPath)) throw new Error(`Falta el catálogo ${locale} en ${dir}`);
}

let uploaded = 0;
for (const locale of locales) {
  const dir = path.join(audioRoot, locale);
  const original = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  for (const champion of Object.values(original.champions ?? {})) {
    for (const clip of champion.clips ?? []) {
      if (clip.file) clip.url = `${publicBase}/${locale}/${clip.file}`;
    }
  }
  const manifest = Buffer.from(JSON.stringify(original, null, 2));
  await upload(`${locale}/manifest.json`, manifest);
  uploaded += 1;

  for (const file of filesIn(dir)) {
    if (path.basename(file) === "manifest.json") continue;
    const relative = path.relative(dir, file).replaceAll(path.sep, "/");
    await upload(`${locale}/${relative}`, fs.readFileSync(file));
    uploaded += 1;
    if (uploaded % 100 === 0) console.log(`Subidos ${uploaded} objetos…`);
  }
  console.log(`${locale}: catálogo subido`);
}

console.log(`Listo: ${uploaded} objetos subidos a R2.`);
