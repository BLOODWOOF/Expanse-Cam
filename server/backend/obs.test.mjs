import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { obsAuth, createObs } from "./obs.mjs";

const sha = (s) => createHash("sha256").update(s).digest("base64");

test("obsAuth follows the OBS WebSocket v5 recipe", () => {
  assert.equal(obsAuth("pass", "salt", "chal"), sha(sha("passsalt") + "chal"));
});

// Bare-bones WebSocket server pretending to be OBS
function fakeObs({ password, active = false }) {
  const got = [];
  const salt = "s4lt", challenge = "ch4l";
  const server = createServer();
  server.on("upgrade", (req, socket) => {
    const accept = createHash("sha1").update(req.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const sendText = (obj) => {
      const data = Buffer.from(JSON.stringify(obj));
      const head = data.length < 126 ? Buffer.from([0x81, data.length]) : Buffer.from([0x81, 126, data.length >> 8, data.length & 255]);
      socket.write(Buffer.concat([head, data]));
    };
    const close = (code) => socket.end(Buffer.from([0x88, 2, code >> 8, code & 255]));
    sendText({ op: 0, d: { obsWebSocketVersion: "5.5.0", rpcVersion: 1, authentication: { salt, challenge } } });
    let buf = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 2) {
        const opcode = buf[0] & 15;
        let len = buf[1] & 127, off = 2;
        if (len === 126) { len = buf.readUInt16BE(2); off = 4; }
        if (buf.length < off + 4 + len) return;
        const mask = buf.slice(off, off + 4);
        const payload = Buffer.from(buf.slice(off + 4, off + 4 + len).map((b, i) => b ^ mask[i % 4]));
        buf = buf.slice(off + 4 + len);
        if (opcode === 8) { socket.end(); return; }
        if (opcode !== 1) continue;
        const msg = JSON.parse(payload.toString());
        got.push(msg);
        if (msg.op === 1) {
          if (msg.d.authentication !== obsAuth(password, salt, challenge)) return close(4009);
          sendText({ op: 2, d: { negotiatedRpcVersion: 1 } });
        } else if (msg.op === 6) {
          const t = msg.d.requestType;
          if (t === "StartStream") active = true;
          if (t === "StopStream") active = false;
          sendText({ op: 7, d: { requestType: t, requestId: msg.d.requestId, requestStatus: { result: true, code: 100 }, responseData: t === "GetStreamStatus" ? { outputActive: active } : undefined } });
        }
      }
    });
    socket.on("error", () => {});
  });
  return { server, got, isActive: () => active };
}

const listen = (server) => new Promise((r) => server.listen(0, "127.0.0.1", () => r(`ws://127.0.0.1:${server.address().port}`)));
const until = async (fn, ms = 3000) => {
  const t0 = Date.now();
  while (!fn()) {
    if (Date.now() - t0 > ms) return false;
    await new Promise((r) => setTimeout(r, 20));
  }
  return true;
};

test("starts and stops the stream to match want()", async () => {
  const fake = fakeObs({ password: "secret" });
  const url = await listen(fake.server);
  const obs = createObs({ url, password: "secret", interval: 50, log: () => {} });
  obs.want(true);
  assert.ok(await until(() => fake.isActive()), "StartStream never arrived");
  assert.ok(await until(() => obs.state().streaming));
  obs.want(false);
  assert.ok(await until(() => !fake.isActive()), "StopStream never arrived");
  obs.close();
  fake.server.close();
});

test("wrong password: keeps retrying quietly, never throws", async () => {
  const fake = fakeObs({ password: "secret" });
  const url = await listen(fake.server);
  const logs = [];
  const obs = createObs({ url, password: "wrong", interval: 50, log: (m) => logs.push(m) });
  obs.want(true);
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(obs.state().connected, false);
  assert.equal(fake.isActive(), false);
  assert.ok(fake.got.filter((m) => m.op === 1).length >= 2, "should keep retrying");
  assert.equal(logs.length, 1, "logs the problem once");
  obs.close();
  fake.server.close();
});

test("password is read again on every attempt, so fixing it later works", async () => {
  const fake = fakeObs({ password: "secret" });
  const url = await listen(fake.server);
  let current = "old";
  const obs = createObs({ url, password: () => current, interval: 50, log: () => {} });
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(obs.state().connected, false);
  current = "secret";
  assert.ok(await until(() => obs.state().connected), "never connected after the fix");
  obs.close();
  fake.server.close();
});

test("leaves a running stream alone until it's been told what to do", async () => {
  const fake = fakeObs({ password: "secret", active: true });
  const url = await listen(fake.server);
  const obs = createObs({ url, password: "secret", interval: 50, log: () => {} });
  const connected = await until(() => obs.state().connected);
  await new Promise((r) => setTimeout(r, 300));
  obs.close();
  fake.server.close();
  assert.ok(connected);
  assert.equal(fake.isActive(), true, "stream was stopped before want() was ever called");
  assert.ok(!fake.got.some((m) => m.d?.requestType === "StopStream"));
});

test("stopNow stops the stream, then ignores want(true)", async () => {
  const fake = fakeObs({ password: "secret", active: true });
  const url = await listen(fake.server);
  const obs = createObs({ url, password: "secret", interval: 50, log: () => {} });
  assert.ok(await until(() => obs.state().connected));
  await obs.stopNow(3000);
  assert.equal(fake.isActive(), false);
  obs.want(true);
  await new Promise((r) => setTimeout(r, 300));
  obs.close();
  fake.server.close();
  assert.equal(fake.isActive(), false, "started again after stopNow");
});

test("OBS not running: no throw, not connected", async () => {
  const obs = createObs({ url: "ws://127.0.0.1:1", password: "x", interval: 50, log: () => {} });
  obs.want(true);
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(obs.state().connected, false);
  obs.close();
});
