import { normalizeShareCode } from "./shareCode";

export type DemoLinkSource =
  | { type: "example" }
  | { type: "code"; shareCode: string }
  | { type: "run"; runId: string }
  | { type: "import" };

/** Legacy query params on /demo — used for redirects and share-code analyze entry. */
export function parseDemoLink(
  params: URLSearchParams,
): { source: DemoLinkSource; playerId: string | null } | null {
  const playerId = params.get("player")?.trim() || null;

  const runId = params.get("run")?.trim();
  if (runId) {
    return { source: { type: "run", runId }, playerId };
  }

  if (params.get("example") === "1") {
    return { source: { type: "example" }, playerId };
  }

  const rawCode = params.get("code")?.trim();
  if (rawCode) {
    return {
      source: { type: "code", shareCode: normalizeShareCode(rawCode) },
      playerId,
    };
  }

  return null;
}

export function buildRunPath(runId: string, playerId?: string | null): string {
  const params = new URLSearchParams();
  if (playerId && playerId !== "all") {
    params.set("player", playerId);
  }
  const qs = params.toString();
  return qs ? `/demo/r/${runId}?${qs}` : `/demo/r/${runId}`;
}

export function buildRunUrl(runId: string, playerId?: string | null): string {
  if (typeof window === "undefined") return buildRunPath(runId, playerId);
  return `${window.location.origin}${buildRunPath(runId, playerId)}`;
}

export function buildExamplePath(playerId?: string | null): string {
  const params = new URLSearchParams();
  if (playerId && playerId !== "all") {
    params.set("player", playerId);
  }
  const qs = params.toString();
  return qs ? `/demo/example?${qs}` : "/demo/example";
}

export function buildExampleUrl(playerId?: string | null): string {
  if (typeof window === "undefined") return buildExamplePath(playerId);
  return `${window.location.origin}${buildExamplePath(playerId)}`;
}

export function buildDemoPath(
  source: DemoLinkSource,
  playerId?: string | null,
): string {
  if (source.type === "run") return buildRunPath(source.runId, playerId);
  if (source.type === "example") return buildExamplePath(playerId);
  if (source.type === "code") {
    const params = new URLSearchParams();
    params.set("code", normalizeShareCode(source.shareCode));
    if (playerId && playerId !== "all") {
      params.set("player", playerId);
    }
    return `/demo?${params.toString()}`;
  }
  return "/demo";
}

export function buildDemoUrl(
  source: DemoLinkSource,
  playerId?: string | null,
): string {
  if (typeof window === "undefined") return buildDemoPath(source, playerId);
  return `${window.location.origin}${buildDemoPath(source, playerId)}`;
}
