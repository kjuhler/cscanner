/**
 * Shared data root for uploads / job results.
 * Docker: DATA_DIR=/data (volume mounted on web + worker).
 * Local: defaults to <cwd>/.data
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export function getDataDir(): string {
  const fromEnv = process.env.DATA_DIR?.trim();
  if (fromEnv) return fromEnv;
  return join(process.cwd(), ".data");
}

export function ensureDataSubdir(...parts: string[]): string {
  const dir = join(getDataDir(), ...parts);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function uploadsRoot(): string {
  return ensureDataSubdir("uploads");
}

export function resultsRoot(): string {
  return ensureDataSubdir("results");
}

export function demosRoot(): string {
  return ensureDataSubdir("demos");
}

export function jobResultPath(jobId: string): string {
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(jobId)) {
    throw new Error("Invalid job id.");
  }
  return join(resultsRoot(), `${jobId}.json`);
}
