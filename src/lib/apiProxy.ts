/**
 * Optional Cloudflare Worker reverse proxy for Steam / FACEIT / Leetify.
 * When API_PROXY_URL + API_PROXY_TOKEN are set, outbound calls egress via CF.
 */

export type ApiProxyProvider =
  | "steam"
  | "faceit"
  | "leetify-public"
  | "leetify-site"
  | "csrep";

export function isApiProxyEnabled(): boolean {
  return Boolean(
    process.env.API_PROXY_URL?.trim() && process.env.API_PROXY_TOKEN?.trim(),
  );
}

export function apiProxyBaseUrl(): string {
  return process.env.API_PROXY_URL!.trim().replace(/\/$/, "");
}

/** Build Worker URL: /{provider}/{path}?query */
export function apiProxyUrl(
  provider: ApiProxyProvider,
  path: string,
  searchParams?: URLSearchParams | Record<string, string>,
): string {
  const raw = path.replace(/^\//, "");
  const q = raw.indexOf("?");
  const pathname = q >= 0 ? raw.slice(0, q) : raw;
  const fromPath = q >= 0 ? raw.slice(q + 1) : "";

  const url = new URL(`${apiProxyBaseUrl()}/${provider}/${pathname}`);
  if (fromPath) {
    new URLSearchParams(fromPath).forEach((v, k) => {
      url.searchParams.set(k, v);
    });
  }
  if (searchParams) {
    const entries =
      searchParams instanceof URLSearchParams
        ? searchParams.entries()
        : Object.entries(searchParams);
    for (const [k, v] of entries) {
      url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

export function apiProxyHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  return {
    ...(extra ?? {}),
    "x-proxy-token": process.env.API_PROXY_TOKEN!.trim(),
  };
}
