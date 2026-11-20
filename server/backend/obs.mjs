// Keeps OBS streaming (or not) to match what we want, over OBS's built-in WebSocket (v5)
import { createHash } from "node:crypto";

const sha = (s) => createHash("sha256").update(s).digest("base64");

export function obsAuth(password, salt, challenge) {
  return sha(sha(password + salt) + challenge);
}

export function createObs({ url = "ws://127.0.0.1:4455", password = "", interval = 3000, log = console.log }) {
  let ws = null;
  let connected = false;
  let streaming = false;
  let wanted = null; // null until the mod has said anything, so a backend restart never stops a running stream
  let busy = false;
  let stopping = false;
  let lastProblem = null;
  let nextId = 1;
  const pending = new Map();
  // a function means "look it up again each time", so fixing the password doesn't need a restart
  const currentPassword = () => (typeof password === "function" ? password() : password);

  function problem(kind, message) {
    if (lastProblem === kind) return;
    lastProblem = kind;
    log(message);
  }

  function request(requestType) {
    return new Promise((resolve, reject) => {
      const requestId = String(nextId++);
      pending.set(requestId, { resolve, reject });
      ws.send(JSON.stringify({ op: 6, d: { requestType, requestId } }));
      setTimeout(() => {
        if (pending.delete(requestId)) reject(new Error(`${requestType} timed out`));
      }, 5000);
    });
  }

  function connect() {
    let sock;
    try {
      sock = new WebSocket(url);
    } catch {
      return problem("down", "OBS isn't reachable, will keep trying");
    }
    ws = sock;
    sock.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.op === 0) {
        const a = msg.d.authentication;
        sock.send(JSON.stringify({
          op: 1,
          d: { rpcVersion: 1, eventSubscriptions: 0, ...(a ? { authentication: obsAuth(currentPassword(), a.salt, a.challenge) } : {}) },
        }));
      } else if (msg.op === 2) {
        connected = true;
        if (lastProblem) log("Connected to OBS");
        lastProblem = null;
      } else if (msg.op === 7) {
        const p = pending.get(msg.d.requestId);
        if (!p) return;
        pending.delete(msg.d.requestId);
        if (msg.d.requestStatus?.result) p.resolve(msg.d.responseData ?? {});
        else p.reject(new Error(msg.d.requestStatus?.comment ?? `${msg.d.requestType} failed`));
      }
    };
    sock.onerror = () => problem("down", "OBS isn't reachable, will keep trying");
    sock.onclose = (e) => {
      if (ws === sock) ws = null;
      connected = false;
      for (const p of pending.values()) p.reject(new Error("OBS connection closed"));
      pending.clear();
      if (e.code === 4009) problem("auth", "OBS rejected the WebSocket password (obsWsPass in server/secrets.yml)");
    };
  }

  async function tick() {
    if (busy) return;
    busy = true;
    try {
      if (!ws) return connect();
      if (!connected || stopping) return;
      streaming = (await request("GetStreamStatus")).outputActive === true;
      if (wanted !== null && wanted !== streaming) {
        await request(wanted ? "StartStream" : "StopStream");
        streaming = wanted;
      }
    } catch (e) {
      problem("request", `OBS: ${e.message}`);
    } finally {
      busy = false;
    }
  }

  const timer = setInterval(tick, interval);
  tick();

  return {
    want(on) {
      if (stopping) return;
      wanted = !!on;
      tick();
    },
    // for stop.ps1: stop the stream and stay stopped no matter what the mod says,
    // so OBS can then be closed without its "stream still running" prompt
    async stopNow(timeout = 10000) {
      stopping = true;
      wanted = false;
      const until = Date.now() + timeout;
      while (busy && Date.now() < until) await new Promise((r) => setTimeout(r, 50));
      while (connected && Date.now() < until) {
        try {
          const status = await request("GetStreamStatus");
          if (!status.outputActive) break;
          await request("StopStream");
        } catch {
          // OBS went away mid-way, nothing left to stop
          break;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      streaming = false;
    },
    state() {
      return { connected, streaming };
    },
    close() {
      clearInterval(timer);
      ws?.close();
    },
  };
}
