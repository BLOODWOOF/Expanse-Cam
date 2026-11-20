import {
  mapLink, conePath, claimAt, worldName, closestZoom, claimLayers, badgeText, backendUrl,
  mergeChat, backendFromWorker,
} from "./map.js";

const $ = (id) => document.getElementById(id);
const video = $("video");

let site;
// where the PC is: the quick tunnel's address from the Worker, or "" for the dev site
let backend = null;
let status = null;
let backendUp = false;
let playing = false;
let lastMapKey = "";
let liveFails = 0;

const be = (path) => backendUrl(backend, path);

async function getJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

// --- finding the PC ---

// null = nothing running (or the Worker can't be reached)
async function findBackend() {
  if (!site.worker) return site.backend ?? "";
  try {
    const res = await fetch(site.worker, { cache: "no-store" });
    return res.ok ? backendFromWorker(await res.json()) : null;
  } catch {
    return null;
  }
}

function setMaintenance(on) {
  document.body.classList.toggle("maint", on);
  $("maint").hidden = !on;
}

// shown while nothing's running; reloads the page once the cam comes back
async function waitForCam() {
  setMaintenance(true);
  const found = await findBackend();
  if (found !== null) return location.reload();
  setTimeout(waitForCam, 30000);
}

// --- stream ---

function render() {
  const text = badgeText(status, backendUp);
  const live = text.startsWith("Live");
  $("status").textContent = text;
  $("status").className = "badge " + (live ? "live" : text === "Paused" ? "paused" : "off");
  const showing = live && playing;
  $("offline").hidden = showing;
  $("offline-title").textContent = text === "Paused" ? "Camera's paused" : "Camera's offline";
  $("offline-sub").textContent = text === "Paused" ? "it'll be back in a bit" : "leave this open, it reconnects by itself";
  $("unmute").hidden = !showing || !video.muted;
}

// MediaMTX serves the player script, so it's missing whenever MediaMTX is down. Keep trying.
function connect() {
  if (!window.MediaMTXWebRTCReader) {
    const s = document.createElement("script");
    s.src = be("cam/reader.js");
    s.onload = connect;
    s.onerror = () => {
      s.remove();
      setTimeout(connect, 10000);
    };
    document.head.append(s);
    return;
  }
  // once it's loaded the reader keeps retrying on its own, so this also picks up OBS starting later
  new MediaMTXWebRTCReader({
    url: new URL(be("cam/whep"), location.href).toString(),
    onError: () => {
      playing = false;
      render();
    },
    // fires once for video and once for audio, same stream both times
    onTrack: (evt) => {
      if (video.srcObject !== evt.streams[0]) video.srcObject = evt.streams[0];
    },
  });
}

video.addEventListener("click", unmute);
$("unmute").addEventListener("click", unmute);
function unmute() {
  video.muted = false;
  video.play();
  $("unmute").hidden = true;
}

video.addEventListener("playing", () => {
  playing = true;
  render();
});

// --- status, chat and where the camera is, one request every 3 s ---

let chatLines = [];
let lastChatId = 0;

function chatLine(line) {
  const li = document.createElement("li");
  li.className = line.kind === "game" ? "game" : "said";
  li.textContent = line.text;
  return li;
}

function showChat(incoming) {
  if (!incoming.length) return;
  const list = $("chat");
  // follow new lines unless someone scrolled up to read
  const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  chatLines = mergeChat(chatLines, incoming);
  list.replaceChildren(...chatLines.map(chatLine));
  $("nochat").hidden = chatLines.length > 0;
  if (atBottom) list.scrollTop = list.scrollHeight;
}

async function refreshLive() {
  if (document.body.classList.contains("maint")) return;
  try {
    const live = await getJson(be(`api/live?after=${lastChatId}`));
    status = live.status;
    backendUp = true;
    liveFails = 0;
    showChat(live.chat);
    lastChatId = live.lastId;
  } catch {
    status = null;
    backendUp = false;
    // the tunnel may have moved (restart) or everything stopped: ask the Worker again
    if (++liveFails >= 3 && site.worker) {
      const found = await findBackend();
      if (found === null) return waitForCam();
      if (found !== backend) return location.reload();
      liveFails = 0;
    }
  }
  render();
  await showCam(status?.cam);
}

async function loadClaims(world) {
  const layers = claimLayers(await getJson(be(`map/tiles/${world}/markers.json`)));
  const lists = await Promise.all(layers.map((layer) =>
    getJson(be(`map/tiles/${world}/markers/${layer}.json`)).catch(() => [])));
  return lists.flat();
}

async function showCam(cam) {
  const on = !!cam?.online;
  $("nomap").hidden = on;
  $("map").hidden = !on;
  // an svg, so .hidden does nothing on it
  document.querySelector(".marker").toggleAttribute("hidden", !on);

  if (!on) {
    $("maplink").href = mapLink(site, null);
    $("spot").textContent = site.fallbackSpot;
    lastMapKey = "";
    return;
  }

  // only reload the map and claim name when the camera actually moved
  const key = `${cam.dimension} ${cam.x} ${cam.z}`;
  if (key === lastMapKey) return;
  lastMapKey = key;

  // zoom all the way in, whatever the world allows
  const world = await getJson(be(`map/tiles/${worldName(cam.dimension)}/settings.json`)).catch(() => null);
  const zoom = closestZoom(world);
  const zoomed = zoom === null ? site : { ...site, mapZoom: zoom };
  $("map").src = mapLink(zoomed, cam, be("map/"));
  $("maplink").href = mapLink(zoomed, cam);

  // Minecraft yaw 0 is south, the map has north up
  $("cone").setAttribute("d", conePath(cam.swing, 45));
  $("cone").setAttribute("transform", `rotate(${cam.yaw + 180})`);

  try {
    const claims = await loadClaims(worldName(cam.dimension));
    $("spot").textContent = claimAt(claims, cam.x, cam.z) ?? site.fallbackSpot;
  } catch {
    $("spot").textContent = site.fallbackSpot;
  }
}

// --- ads ---

function adsHidden() {
  try {
    return localStorage.getItem("expansecam.hideAds") === "1";
  } catch {
    return false;
  }
}

function setAdsHidden(hide) {
  try {
    localStorage.setItem("expansecam.hideAds", hide ? "1" : "0");
  } catch {
    // private window etc, just don't remember it
  }
  document.body.classList.toggle("no-ads", hide);
  $("adtoggle").textContent = hide ? "Show ads" : "Hide ads";
}

function adCard(ad) {
  const card = document.createElement("figure");
  card.className = "ad";
  const img = document.createElement("img");
  img.src = be(ad.image);
  img.alt = "";
  img.loading = "lazy";
  // if the image is gone (ad just ran out), drop the whole card
  img.onerror = () => card.remove();
  const text = document.createElement("figcaption");
  text.textContent = ad.text;
  card.append(img, text);
  return card;
}

async function refreshAds() {
  let ads = [];
  try {
    ads = await getJson(be("api/ads"));
  } catch {
    // backend down, show none
  }
  $("ads-left").replaceChildren(...ads.filter((a) => a.slot <= 2).map(adCard));
  $("ads-right").replaceChildren(...ads.filter((a) => a.slot >= 3).map(adCard));
  document.body.classList.toggle("has-ads", ads.length > 0);
}

$("adtoggle").addEventListener("click", () => setAdsHidden(!document.body.classList.contains("no-ads")));

// --- footer ---

function setLink(id, href) {
  const a = $(id);
  if (href) a.href = href;
  else a.closest("li").remove();
}

// --- start ---

site = await getJson("site.json");
$("title").textContent = site.title;
document.title = `${site.title} - Live`;
$("info").textContent = site.info;
$("spot").textContent = site.fallbackSpot;
setLink("f-map", site.mapUrl);
setLink("f-discord", site.discord);
setLink("f-source", site.repo);
setLink("f-licence", site.repo && `${site.repo}/blob/main/LICENSE`);
setLink("f-issues", site.repo && `${site.repo}/issues`);
setAdsHidden(adsHidden());

backend = await findBackend();
if (backend === null) {
  waitForCam();
} else {
  setMaintenance(false);
  render();
  connect();
  refreshLive();
  refreshAds();
  setInterval(refreshLive, 3000);
  setInterval(refreshAds, 60000);
}
