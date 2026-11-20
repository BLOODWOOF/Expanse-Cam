// Backend for the cam page. Started by start.ps1:
//   127.0.0.1:8090  public API, only reached through Caddy
//   127.0.0.1:8081  ads admin page + where the mod posts camera state and chat
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createChat } from "./backend/state.mjs";
import { createAdStore } from "./backend/ads.mjs";
import { createServers } from "./backend/http.mjs";
import { createObs } from "./backend/obs.mjs";
import { readPath } from "./backend/viewers.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

function secret(name) {
  try {
    return new RegExp(`^${name}:[ \\t]*(\\S+)`, "m").exec(readFileSync(join(here, "secrets.yml"), "utf8"))?.[1] ?? "";
  } catch {
    return "";
  }
}

const obs = createObs({ password: () => secret("obsWsPass"), log: (m) => console.log(new Date().toISOString(), m) });
let cam = null;

const { publicServer, localServer } = createServers({
  chat: createChat(200),
  ads: createAdStore(join(root, "data", "ads")),
  adminHtml: readFileSync(join(here, "backend", "admin.html"), "utf8"),
  onCamera(state) {
    cam = state;
    obs.want(state?.online === true);
  },
  async onStop() {
    await obs.stopNow(10000);
    cam = null;
    // stop.ps1 closes OBS and the rest right after this answers
    setTimeout(() => process.exit(0), 200);
  },
  async getStatus() {
    const path = await readPath();
    const paused = !cam?.online;
    return { live: path.ready && !paused, paused, viewers: path.ready ? path.viewers : 0, cam };
  },
});

publicServer.listen(8090, "127.0.0.1");
localServer.listen(8081, "127.0.0.1");
console.log("Backend up: api on 127.0.0.1:8090, admin on http://localhost:8081");
