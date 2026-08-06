/**
 * Cloudflare Worker — reverse proxy for Steam / FACEIT / Leetify / CSRep.
 *
 * Deploy: wrangler deploy (set secrets: PROXY_TOKEN, STEAM_API_KEY, FACEIT_API_KEY,
 * LEETIFY_API_KEY, CSREP_API_KEY, optional CSREP_API_KEY_ID)
 *
 * Routes: GET/POST /{provider}/{path...}
 * Auth: header x-proxy-token must match PROXY_TOKEN
 */

const UPSTREAM = {
  steam: "https://api.steampowered.com",
  faceit: "https://open.faceit.com/data/v4",
  "leetify-public": "https://api-public.cs-prod.leetify.com",
  "leetify-site": "https://api.leetify.com",
  csrep: "https://csrep.gg/api",
};

export default {
  async fetch(request, env) {
    const token = request.headers.get("x-proxy-token");
    if (!token || token !== env.PROXY_TOKEN) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const parts = url.pathname.replace(/^\//, "").split("/");
    const provider = parts.shift();
    const upstreamBase = UPSTREAM[provider];
    if (!upstreamBase) {
      return new Response("Unknown provider", { status: 404 });
    }

    const targetPath = parts.join("/");
    const target = new URL(
      targetPath ? `${upstreamBase}/${targetPath}` : upstreamBase,
    );
    url.searchParams.forEach((v, k) => target.searchParams.set(k, v));

    const headers = new Headers();
    headers.set("Accept", request.headers.get("Accept") || "application/json");

    if (provider === "steam" && env.STEAM_API_KEY) {
      target.searchParams.set("key", env.STEAM_API_KEY);
    } else if (provider === "faceit" && env.FACEIT_API_KEY) {
      headers.set("Authorization", `Bearer ${env.FACEIT_API_KEY}`);
    } else if (
      (provider === "leetify-public" || provider === "leetify-site") &&
      env.LEETIFY_API_KEY
    ) {
      headers.set("Authorization", `Bearer ${env.LEETIFY_API_KEY}`);
    } else if (provider === "csrep" && env.CSREP_API_KEY) {
      headers.set("X-API-Key", env.CSREP_API_KEY);
      if (env.CSREP_API_KEY_ID) {
        headers.set("X-API-Key-Id", env.CSREP_API_KEY_ID);
      }
    }

    const init = {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : request.body,
    };

    return fetch(target.toString(), init);
  },
};
