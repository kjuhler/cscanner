#!/usr/bin/env node
/**
 * Verify CSRep partner API access.
 * Loads .env / .env.local from project root (same keys as the Next.js app).
 * Usage: pnpm test:csrep-api [steamId]
 */
import { readFile } from "node:fs/promises";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

async function loadDotEnv() {
  for (const name of [".env.local", ".env"]) {
    try {
      const raw = await readFile(path.join(process.cwd(), name), "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    } catch {
      /* missing file */
    }
  }
}

await loadDotEnv();

const steamId = process.argv[2] ?? "76561197991294686";
const base = (process.env.CSREP_API_BASE ?? "https://csrep.gg/api").replace(
  /\/$/,
  "",
);
const secret = process.env.CSREP_API_KEY?.trim();
const keyId = process.env.CSREP_API_KEY_ID?.trim();

if (!secret) {
  console.error("Set CSREP_API_KEY (and optionally CSREP_API_KEY_ID).");
  process.exit(1);
}

function authHeaders() {
  const h = { Accept: "application/json", "X-API-Key": secret };
  if (keyId) {
    h["X-API-Key-Id"] = keyId;
    h["X-API-Key-ID"] = keyId;
  }
  return h;
}

async function probe(label, url) {
  const res = await fetch(url, { headers: authHeaders() });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html / plain */
  }
  console.log(`\n=== ${label} ===`);
  console.log(`GET ${url}`);
  console.log(`HTTP ${res.status}`);
  if (json) {
    console.log(JSON.stringify(json, null, 2).slice(0, 2000));
  } else {
    console.log(text.slice(0, 400));
  }
  return { status: res.status, json, text };
}

const outDir = path.join(process.cwd(), ".data");
await mkdir(outDir, { recursive: true });

const player = await probe(
  "Player (documented)",
  `${base}/players/${encodeURIComponent(steamId)}`,
);
const stats = await probe(
  "Stats (undocumented)",
  `${base}/players/${encodeURIComponent(steamId)}/stats?from_match=0`,
);

await writeFile(
  path.join(outDir, "csrep-sample.json"),
  JSON.stringify(
    {
      steamId,
      base,
      testedAt: new Date().toISOString(),
      player: { status: player.status, body: player.json ?? player.text.slice(0, 500) },
      stats: { status: stats.status, body: stats.json ?? stats.text.slice(0, 500) },
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`\nSaved sample → .data/csrep-sample.json`);

if (player.status === 401 || player.status === 403) {
  console.error("\nPlayer endpoint unauthorized — check CSREP_API_KEY / Key ID.");
  process.exit(2);
}
if (stats.status === 403 || stats.status === 404) {
  console.warn(
    "\nStats endpoint not available with your partner key — ask CSRep to enable /players/{id}/stats.",
  );
}
