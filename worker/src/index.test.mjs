import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./index.js";

// stand-in for a KV namespace
function kv() {
  const m = new Map();
  return {
    get: async (k) => m.get(k) ?? null,
    put: async (k, v) => { m.set(k, v); },
    delete: async (k) => { m.delete(k); },
  };
}

const env = () => ({ CAM: kv(), WORKER_KEY: "s3cret", ALLOWED_ORIGIN: "https://bloodwoof.github.io" });
const call = (e, method, body, headers = {}) =>
  worker.fetch(new Request("https://expanse-cam.example.workers.dev/backend", { method, body, headers }), e);
const auth = { authorization: "Bearer s3cret", "content-type": "application/json" };

test("nothing stored -> 404, with CORS for the page", async () => {
  const res = await call(env(), "GET", undefined, { origin: "https://bloodwoof.github.io" });
  assert.equal(res.status, 404);
  assert.equal(res.headers.get("access-control-allow-origin"), "https://bloodwoof.github.io");
});

test("start.ps1 stores the tunnel url, the page reads it", async () => {
  const e = env();
  assert.equal((await call(e, "PUT", JSON.stringify({ url: "https://some-words.trycloudflare.com" }), auth)).status, 204);
  const res = await call(e, "GET");
  assert.equal(res.status, 200);
  assert.equal((await res.json()).url, "https://some-words.trycloudflare.com");
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("stop.ps1 clears it", async () => {
  const e = env();
  await call(e, "PUT", JSON.stringify({ url: "https://some-words.trycloudflare.com" }), auth);
  assert.equal((await call(e, "DELETE", undefined, auth)).status, 204);
  assert.equal((await call(e, "GET")).status, 404);
});

test("writes need the key", async () => {
  const e = env();
  const body = JSON.stringify({ url: "https://evil.trycloudflare.com" });
  assert.equal((await call(e, "PUT", body, { authorization: "Bearer wrong" })).status, 401);
  assert.equal((await call(e, "PUT", body)).status, 401);
  assert.equal((await call(e, "DELETE", undefined, { authorization: "Bearer nope" })).status, 401);
  assert.equal((await call(e, "GET")).status, 404);
});

test("only trycloudflare https urls are accepted", async () => {
  const e = env();
  for (const url of ["http://some-words.trycloudflare.com", "https://evil.com", "https://trycloudflare.com.evil.com", "javascript:alert(1)", 42]) {
    assert.equal((await call(e, "PUT", JSON.stringify({ url }), auth)).status, 400, String(url));
  }
});

test("other paths and the CORS preflight", async () => {
  const e = env();
  const other = await worker.fetch(new Request("https://x.workers.dev/"), e);
  assert.equal(other.status, 404);
  const pre = await call(e, "OPTIONS", undefined, { origin: "https://bloodwoof.github.io" });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-methods"), "GET");
});
