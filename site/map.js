// Pl3xmap bits that don't touch the page, so they can be tested with node

// minecraft:overworld -> minecraft-overworld, that's how Pl3xmap names its world folders
export function worldName(dimension) {
  return dimension.replace(":", "-");
}

// The page lives on GitHub Pages while everything live comes from the PC through
// its tunnel. Empty base = same site as the page (the dev site, served by Caddy).
export function backendUrl(base, path) {
  if (!base) return path;
  return base.replace(/\/?$/, "/") + path;
}

// The Worker says where the PC's tunnel is. Only ever trust a trycloudflare address from it.
export function backendFromWorker(answer) {
  const url = answer?.url;
  if (typeof url !== "string" || !/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(url)) return null;
  return url + "/";
}

// new chat lines onto the old ones. Ids going backwards means the backend restarted.
export function mergeChat(current, incoming) {
  if (!incoming.length) return current;
  if (current.length && incoming[0].id <= current.at(-1).id) return trimChat(incoming);
  return trimChat([...current, ...incoming]);
}

// can't reach the PC at all = everything's shut down
export function maintenance(backendUp) {
  return !backendUp;
}

// only keep the newest chat lines on the page
export function trimChat(lines, max = 150) {
  return lines.length > max ? lines.slice(-max) : lines;
}

export function badgeText(status, backendUp) {
  if (!backendUp || !status) return "Offline";
  if (status.live) return status.viewers > 0 ? `Live · ${status.viewers} watching` : "Live";
  return status.paused ? "Paused" : "Offline";
}

// Every claim area layer from a world's markers.json. pl3xclaims_markers is just signs, skip it
export function claimLayers(layers) {
  if (!Array.isArray(layers)) return [];
  return layers.map((l) => l.key).filter((k) => k?.startsWith("pl3xclaims_") && k !== "pl3xclaims_markers");
}

// Pl3xmap's url zoom counts backwards (0 = default, -maxIn = all the way in)
export function closestZoom(worldSettings) {
  const maxIn = worldSettings?.zoom?.maxIn;
  return Number.isFinite(maxIn) ? -maxIn || 0 : null;
}

// base defaults to the real map; the page's iframe uses "map/" (Caddy's copy) so it works over https
export function mapLink(site, cam, base = site.mapUrl) {
  if (!cam) return base;
  const q = new URLSearchParams({
    world: worldName(cam.dimension),
    renderer: site.renderer,
    zoom: site.mapZoom,
    x: cam.x,
    z: cam.z,
  });
  return `${base}?${q}`;
}

// Wedge pointing up (north), swingDeg each side. Rotated into place by the caller.
export function conePath(swingDeg, radius) {
  const a = (swingDeg * Math.PI) / 180;
  const x = (radius * Math.sin(a)).toFixed(2);
  const y = (-radius * Math.cos(a)).toFixed(2);
  const large = swingDeg > 90 ? 1 : 0;
  return `M 0 0 L ${-x} ${y} A ${radius} ${radius} 0 ${large} 1 ${x} ${y} Z`;
}

function outline(marker) {
  const lines = marker?.data?.polylines;
  if (marker?.type !== "poly" || !Array.isArray(lines) || !lines[0]?.points?.length) return null;
  return lines[0].points;
}

function contains(points, x, z) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

function area(points) {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    sum += (points[j].x + points[i].x) * (points[j].z - points[i].z);
  }
  return Math.abs(sum / 2);
}

const entities = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'" };

// claim name is the bold bit at the start of the popup, e.g. "<b>Lyyn Industrial</b><br>Owner: Lyyn"
function claimName(marker) {
  const html = marker?.options?.popup?.content ?? marker?.options?.tooltip?.content ?? "";
  const m = html.match(/<b>(.*?)<\/b>/i);
  if (!m) return null;
  const name = m[1].replace(/<[^>]*>/g, "").replace(/&[#a-z0-9]+;/gi, (e) => entities[e] ?? e).trim();
  // "Spawn Area" -> "Spawn", "Shopping District Area" -> "Shopping District"
  return name.replace(/\s+Area$/i, "") || null;
}

// Name of the smallest claim containing x/z, or null
export function claimAt(markers, x, z) {
  let best = null;
  let bestArea = Infinity;
  for (const marker of markers) {
    const points = outline(marker);
    if (!points || !contains(points, x, z)) continue;
    const name = claimName(marker);
    const size = area(points);
    if (name && size < bestArea) {
      best = name;
      bestArea = size;
    }
  }
  return best;
}
