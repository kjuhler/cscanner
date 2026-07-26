import "server-only";

import Redis from "ioredis";

let client: Redis | null = null;

export function getRedisUrl(): string {
  return process.env.REDIS_URL?.trim() || "redis://127.0.0.1:6379";
}

/** Shared ioredis client for Next.js route handlers. */
export function getRedis(): Redis {
  if (client) return client;
  client = new Redis(getRedisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });
  client.on("error", (err) => {
    console.error("[redis]", err.message);
  });
  return client;
}

export async function pingRedis(): Promise<boolean> {
  try {
    const pong = await getRedis().ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}
