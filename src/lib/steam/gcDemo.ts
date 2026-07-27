/**
 * Steam Game Coordinator client for resolving CS2 match share codes to demo URLs.
 * Server-only — loaded dynamically from the share-code API route.
 */
import GlobalOffensive from "globaloffensive";
import SteamUser from "steam-user";

const CS2_APPID = 730;
const LOGIN_TIMEOUT_MS = 60_000;
const GC_CONNECT_TIMEOUT_MS = 45_000;
const MATCH_TIMEOUT_MS = 30_000;

type MatchRoundStats = {
  map?: string | null;
};

type MatchInfo = {
  roundstatsall?: MatchRoundStats[] | null;
  roundstats_legacy?: MatchRoundStats | null;
};

type GcSession = {
  user: SteamUser;
  csgo: GlobalOffensive;
  ready: Promise<void>;
};

type Emitter = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  once: (event: string, cb: (...args: any[]) => void) => unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off: (event: string, cb: (...args: any[]) => void) => unknown;
};

let session: GcSession | null = null;
let chain: Promise<unknown> = Promise.resolve();

function refreshToken(): string {
  const token = process.env.STEAM_REFRESH_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "STEAM_REFRESH_TOKEN is not set. Generate one (see README) and set it on the web service (or local .env).",
    );
  }
  return token;
}

function extractDemoUrl(matches: MatchInfo[]): string | null {
  for (const match of matches) {
    const rounds = match.roundstatsall ?? [];
    for (let i = rounds.length - 1; i >= 0; i--) {
      const url = rounds[i]?.map;
      if (typeof url === "string" && /^https?:\/\//i.test(url)) {
        return url;
      }
    }
    const legacy = match.roundstats_legacy?.map;
    if (typeof legacy === "string" && /^https?:\/\//i.test(legacy)) {
      return legacy;
    }
  }
  return null;
}

function waitForEvent(
  emitter: Emitter,
  event: string,
  timeoutMs: number,
  label: string,
): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    const onEvent = (...args: unknown[]) => {
      cleanup();
      resolve(args);
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    function cleanup() {
      clearTimeout(timer);
      emitter.off(event, onEvent);
      emitter.off("error", onError);
    }

    emitter.once(event, onEvent);
    emitter.once("error", onError);
  });
}

async function ensureSession(): Promise<GcSession> {
  if (session) {
    const { csgo } = session;
    if (csgo.haveGCSession) return session;
    await session.ready.catch(() => undefined);
    if (csgo.haveGCSession) return session;
    try {
      session.user.logOff();
    } catch {
      // ignore
    }
    session = null;
  }

  const user = new SteamUser();
  const csgo = new GlobalOffensive(user);

  const ready = (async () => {
    const loggedOn = waitForEvent(
      user as unknown as Emitter,
      "loggedOn",
      LOGIN_TIMEOUT_MS,
      "Steam login",
    );
    user.logOn({ refreshToken: refreshToken() });
    await loggedOn;

    user.setPersona(SteamUser.EPersonaState.Online);
    user.gamesPlayed(CS2_APPID);

    if (!csgo.haveGCSession) {
      await waitForEvent(
        csgo as unknown as Emitter,
        "connectedToGC",
        GC_CONNECT_TIMEOUT_MS,
        "CS2 Game Coordinator connect",
      );
    }
  })();

  session = { user, csgo, ready };

  user.on("error", (err) => {
    console.error("[gcDemo] steam-user error:", err.message);
  });
  user.on("disconnected", (eresult, msg) => {
    console.warn("[gcDemo] disconnected:", eresult, msg ?? "");
    session = null;
  });
  csgo.on("disconnectedFromGC", (reason) => {
    console.warn("[gcDemo] disconnectedFromGC:", reason);
  });

  try {
    await ready;
  } catch (err) {
    session = null;
    try {
      user.logOff();
    } catch {
      // ignore
    }
    throw err;
  }

  return session;
}

/**
 * Resolve a match share code to a Valve CDN demo URL via the Game Coordinator.
 * Serialized so concurrent jobs share one GC session safely.
 */
export function fetchDemoUrlFromShareCode(shareCode: string): Promise<string> {
  const run = async (): Promise<string> => {
    const { csgo } = await ensureSession();
    if (!csgo.haveGCSession) {
      throw new Error("Not connected to the CS2 Game Coordinator.");
    }

    const matchListPromise = waitForEvent(
      csgo as unknown as Emitter,
      "matchList",
      MATCH_TIMEOUT_MS,
      "Match list response",
    );

    csgo.requestGame(shareCode);
    const [matches] = await matchListPromise;

    if (!Array.isArray(matches) || matches.length === 0) {
      throw new Error(
        "Match not found. The share code may be invalid or the demo expired (~30 days).",
      );
    }

    const url = extractDemoUrl(matches as MatchInfo[]);
    if (!url) {
      throw new Error(
        "No demo download URL for this match. Valve may have expired the replay (~30 days).",
      );
    }
    return url;
  };

  const next = chain.then(run, run);
  chain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
