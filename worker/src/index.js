// Remembers where the PC's quick tunnel is right now, so the page on GitHub Pages can find it.
//   GET    /backend  -> {"url": "https://<words>.trycloudflare.com"}, or 404 when the cam is off
//   PUT    /backend  -> start.ps1 stores a new url (needs the key)
//   DELETE /backend  -> stop.ps1 clears it (needs the key)

const KEY = "backend";
const TUNNEL = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/;

function cors(env) {
  return {
    "access-control-allow-origin": env.ALLOWED_ORIGIN,
    "access-control-allow-methods": "GET",
    vary: "Origin",
  };
}

function reply(env, status, body) {
  const headers = { ...cors(env), "cache-control": "no-store" };
  if (body === undefined) return new Response(null, { status, headers });
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "content-type": "application/json" } });
}

// compare without bailing out early, so the key can't be guessed by timing
function sameKey(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !b) return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i % b.length);
  return diff === 0;
}

function authorised(request, env) {
  const header = request.headers.get("authorization") ?? "";
  return sameKey(header.replace(/^Bearer /, ""), env.WORKER_KEY);
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname !== "/backend") return reply(env, 404, { error: "Not found" });

    switch (request.method) {
      case "OPTIONS":
        return new Response(null, { status: 204, headers: cors(env) });

      case "GET": {
        const url = await env.CAM.get(KEY);
        return url ? reply(env, 200, { url }) : reply(env, 404, { error: "Nothing running" });
      }

      case "PUT": {
        if (!authorised(request, env)) return reply(env, 401, { error: "Wrong key" });
        let url;
        try {
          url = (await request.json()).url;
        } catch {
          return reply(env, 400, { error: "Bad JSON" });
        }
        if (typeof url !== "string" || !TUNNEL.test(url)) return reply(env, 400, { error: "Not a trycloudflare url" });
        await env.CAM.put(KEY, url);
        return reply(env, 204);
      }

      case "DELETE":
        if (!authorised(request, env)) return reply(env, 401, { error: "Wrong key" });
        await env.CAM.delete(KEY);
        return reply(env, 204);

      default:
        return reply(env, 405, { error: "Method not allowed" });
    }
  },
};
