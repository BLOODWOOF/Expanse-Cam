import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readPath } from "./viewers.mjs";

test("readPath counts readers from MediaMTX's API", async () => {
  const server = createServer((req, res) => {
    assert.equal(req.url, "/v3/paths/get/cam");
    res.end(JSON.stringify({ name: "cam", ready: true, readers: [{ type: "webRTCSession", id: "a" }, { type: "webRTCSession", id: "b" }] }));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  assert.deepEqual(await readPath(`http://127.0.0.1:${server.address().port}`), { ready: true, viewers: 2 });
  server.close();
});

test("readPath is zero when MediaMTX isn't answering", async () => {
  assert.deepEqual(await readPath("http://127.0.0.1:1"), { ready: false, viewers: 0 });
});
