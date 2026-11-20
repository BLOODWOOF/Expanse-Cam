import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createChat } from "./state.mjs";
import { createAdStore } from "./ads.mjs";
import { createServers } from "./http.mjs";

let pub, local, dir, servers, cam = null, stopped = 0;

after(() => {
  servers.publicServer.close();
  servers.localServer.close();
  rmSync(dir, { recursive: true, force: true });
});

before(async () => {
  dir = mkdtempSync(join(tmpdir(), "expansecam-"));
  servers = createServers({
    chat: createChat(),
    ads: createAdStore(dir),
    getStatus: async () => ({ live: false, paused: !cam?.online, viewers: 0, cam }),
    onCamera: (c) => { cam = c; },
    onStop: async () => { stopped++; },
    adminHtml: "<h1>admin</h1>",
  });
  await new Promise((r) => servers.publicServer.listen(0, "127.0.0.1", r));
  await new Promise((r) => servers.localServer.listen(0, "127.0.0.1", r));
  pub = `http://127.0.0.1:${servers.publicServer.address().port}`;
  local = `http://127.0.0.1:${servers.localServer.address().port}`;
});

const json = (body) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

test("mod and admin paths don't exist on the public port", async () => {
  assert.equal((await fetch(`${pub}/mod/chat`, json({ text: "x", kind: "chat" }))).status, 404);
  assert.equal((await fetch(`${pub}/mod/camera`, json({ online: true }))).status, 404);
  assert.equal((await fetch(`${pub}/admin/ads`, { method: "POST" })).status, 404);
  assert.equal((await fetch(`${pub}/`)).status, 404);
});

test("chat posted locally shows up publicly", async () => {
  assert.equal((await fetch(`${local}/mod/chat`, json({ text: "hi", kind: "chat" }))).status, 204);
  const lines = await (await fetch(`${pub}/api/chat?after=0`)).json();
  assert.deepEqual(lines.map((l) => l.text), ["hi"]);
});

test("camera state reaches status", async () => {
  assert.equal((await fetch(`${local}/mod/camera`, json({ online: true, dimension: "minecraft:overworld", x: 1, y: 2, z: 3, yaw: 0, swing: 45 }))).status, 204);
  const status = await (await fetch(`${pub}/api/status`)).json();
  assert.equal(status.cam.online, true);
  assert.equal(status.paused, false);
});

test("other websites can't post to the local port", async () => {
  const evil = { "content-type": "text/plain", origin: "https://evil.example" };
  assert.equal((await fetch(`${local}/mod/chat`, { method: "POST", headers: evil, body: JSON.stringify({ text: "fake", kind: "chat" }) })).status, 403);
  assert.equal((await fetch(`${local}/admin/ads/1/delete`, { method: "POST", headers: evil, redirect: "manual" })).status, 403);
  // the admin page itself still works
  const own = { "content-type": "application/json", origin: local };
  assert.equal((await fetch(`${local}/mod/chat`, { method: "POST", headers: own, body: JSON.stringify({ text: "ok", kind: "chat" }) })).status, 204);
  const lines = await (await fetch(`${pub}/api/chat?after=0`)).json();
  assert.ok(!lines.some((l) => l.text === "fake"));
});

test("stop request is local only and waits for onStop", async () => {
  assert.equal((await fetch(`${pub}/admin/stop`, { method: "POST" })).status, 404);
  assert.equal(stopped, 0);
  assert.equal((await fetch(`${local}/admin/stop`, { method: "POST" })).status, 204);
  assert.equal(stopped, 1);
});

test("bad json is a 400, not a crash", async () => {
  const res = await fetch(`${local}/mod/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: "{nope" });
  assert.equal(res.status, 400);
});

test("admin page is on the local port", async () => {
  const res = await fetch(`${local}/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /admin/);
});

test("ads list starts empty", async () => {
  assert.deepEqual(await (await fetch(`${pub}/api/ads`)).json(), []);
});

// 1x1 transparent png
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

function adForm(fields, file) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (file) form.append("image", new Blob([file.data], { type: file.type }), file.name);
  return { method: "POST", body: form, redirect: "manual" };
}

test("uploading an ad, seeing it, removing it", async () => {
  const ends = new Date(Date.now() + 86400e3).toISOString();
  const res = await fetch(`${local}/admin/ads`, adForm({ slot: "1", text: "Diamonds at Bob's", ends }, { data: PNG, type: "image/png", name: "a.png" }));
  assert.equal(res.status, 303);
  const ads = await (await fetch(`${pub}/api/ads`)).json();
  assert.equal(ads.length, 1);
  assert.equal(ads[0].text, "Diamonds at Bob's");
  const img = await fetch(`${pub}/${ads[0].image}`);
  assert.equal(img.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await img.arrayBuffer()), PNG);
  assert.equal((await fetch(`${local}/admin/ads/${ads[0].id}/delete`, { method: "POST", redirect: "manual" })).status, 303);
  assert.deepEqual(await (await fetch(`${pub}/api/ads`)).json(), []);
  assert.equal((await fetch(`${pub}/${ads[0].image}`)).status, 404);
});

test("non-image upload is refused", async () => {
  const ends = new Date(Date.now() + 86400e3).toISOString();
  const res = await fetch(`${local}/admin/ads`, adForm({ slot: "1", text: "x", ends }, { data: Buffer.from("<script>"), type: "text/html", name: "a.html" }));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /image/);
});

test("upload over 3 MB is refused", async () => {
  const ends = new Date(Date.now() + 86400e3).toISOString();
  const res = await fetch(`${local}/admin/ads`, adForm({ slot: "1", text: "x", ends }, { data: Buffer.alloc(3.5e6), type: "image/png", name: "big.png" })).catch((e) => ({ status: "reset" }));
  assert.ok(res.status === 413 || res.status === "reset");
  assert.deepEqual(await (await fetch(`${pub}/api/ads`)).json(), []);
});
