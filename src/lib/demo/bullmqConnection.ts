import "server-only";

import Redis from "ioredis";
import { getRedisUrl } from "./redis";

/**
 * BullMQ requires maxRetriesPerRequest: null.
 * Prefer `new Redis(url, opts)` — `{ url }` alone is flaky across ioredis versions.
 */
export function createBullmqConnection(): Redis {
  return new Redis(getRedisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}
