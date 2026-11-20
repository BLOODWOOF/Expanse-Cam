// Two servers: public (only ever reached through Caddy) and local (admin page + mod, this PC only)
import { createServer } from "node:http";

const JSON_LIMIT = 64 * 1024;
const UPLOAD_LIMIT = 3 * 1024 * 1024;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, "Too big"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJson(req) {
  try {
    return JSON.parse((await readBody(req, JSON_LIMIT)).toString("utf8"));
  } catch (e) {
    throw e instanceof HttpError ? e : new HttpError(400, "Bad JSON");
  }
}

// Just enough multipart/form-data for the admin form: text fields + one file
export function parseMultipart(body, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? "");
  if (!m) throw new HttpError(400, "Not a form upload");
  const boundary = Buffer.from("--" + (m[1] ?? m[2]).trim());
  const fields = {};
  let file = null;
  let pos = body.indexOf(boundary);
  while (pos !== -1) {
    const start = pos + boundary.length;
    if (body.slice(start, start + 2).toString() === "--") break;
    const next = body.indexOf(boundary, start);
    if (next === -1) break;
    const part = body.slice(start + 2, next - 2); // skip CRLF after boundary and before the next one
    const split = part.indexOf("\r\n\r\n");
    if (split !== -1) {
      const head = part.slice(0, split).toString("utf8");
      const data = part.slice(split + 4);
      const name = /name="([^"]*)"/i.exec(head)?.[1];
      const filename = /filename="([^"]*)"/i.exec(head)?.[1];
      const type = /content-type:\s*([^\r\n]+)/i.exec(head)?.[1]?.trim();
      if (filename !== undefined) {
        if (data.length) file = { name, filename, type, data };
      } else if (name) {
        fields[name] = data.toString("utf8");
      }
    }
    pos = next;
  }
  return { fields, file };
}

function send(res, status, body, type = "application/json") {
  const data = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(data);
}

// The local port only listens on 127.0.0.1, but a website open in a browser on this PC could
// still send it requests. Refuse other sites, and names other than localhost (DNS rebinding).
function fromThisPc(req) {
  const host = req.headers.host ?? "";
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return false;
  const origin = req.headers.origin;
  if (!origin) return true; // the mod, curl
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function handler(routes, { localOnly = false } = {}) {
  return async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (localOnly && !fromThisPc(req)) return send(res, 403, { error: "Forbidden" });
    try {
      for (const [method, pattern, fn] of routes) {
        if (method !== req.method) continue;
        const match = typeof pattern === "string" ? (url.pathname === pattern ? [] : null) : pattern.exec(url.pathname);
        if (match) return await fn(req, res, url, match);
      }
      send(res, 404, { error: "Not found" });
    } catch (e) {
      if (!res.headersSent) send(res, e.status ?? 500, { error: e.status ? e.message : "Server error" });
      if (!e.status) console.error(e);
    }
  };
}

export function createServers({ chat, ads, getStatus, onCamera, onChat = () => {}, onStop = async () => {}, adminHtml }) {
  const publicRoutes = [
    ["GET", "/api/status", async (req, res) => send(res, 200, await getStatus())],
    ["GET", "/api/ads", (req, res) => send(res, 200, ads.active().map(({ id, slot, text }) => ({ id, slot, text, image: `api/ads/img/${id}` })))],
    ["GET", /^\/api\/ads\/img\/(\d+)$/, (req, res, url, m) => {
      const img = ads.active().some((a) => a.id === Number(m[1])) && ads.image(Number(m[1]));
      if (!img) return send(res, 404, { error: "Not found" });
      send(res, 200, img.body, img.mime);
    }],
    ["GET", "/api/chat", (req, res, url) => send(res, 200, chat.after(Number(url.searchParams.get("after")) || 0))],
  ];

  const localRoutes = [
    ["GET", "/", (req, res) => send(res, 200, adminHtml, "text/html; charset=utf-8")],
    ["GET", "/admin/ads", (req, res) => send(res, 200, ads.all())],
    ["GET", /^\/admin\/ads\/img\/(\d+)$/, (req, res, url, m) => {
      const img = ads.image(Number(m[1]));
      if (!img) return send(res, 404, { error: "Not found" });
      send(res, 200, img.body, img.mime);
    }],
    ["POST", "/admin/ads", async (req, res) => {
      const { fields, file } = parseMultipart(await readBody(req, UPLOAD_LIMIT), req.headers["content-type"]);
      const result = ads.add(
        { slot: Number(fields.slot), text: fields.text ?? "", ends: Date.parse(fields.ends ?? "") },
        file?.data,
        file?.type,
      );
      if (result.error) return send(res, 400, { error: result.error });
      res.writeHead(303, { location: "/" });
      res.end();
    }],
    ["POST", /^\/admin\/ads\/(\d+)\/delete$/, (req, res, url, m) => {
      ads.remove(Number(m[1]));
      res.writeHead(303, { location: "/" });
      res.end();
    }],
    // stop.ps1: stop the stream for good, answers once OBS has stopped
    ["POST", "/admin/stop", async (req, res) => {
      await onStop();
      res.writeHead(204).end();
    }],
    ["POST", "/mod/camera", async (req, res) => {
      onCamera(await readJson(req));
      res.writeHead(204).end();
    }],
    ["POST", "/mod/chat", async (req, res) => {
      const { text, kind } = await readJson(req);
      if (typeof text !== "string" || !text.trim()) throw new HttpError(400, "No text");
      onChat(chat.add({ text: text.slice(0, 500), kind }));
      res.writeHead(204).end();
    }],
  ];

  return {
    publicServer: createServer(handler(publicRoutes)),
    localServer: createServer(handler(localRoutes, { localOnly: true })),
  };
}
