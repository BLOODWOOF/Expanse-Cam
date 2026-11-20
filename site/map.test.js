import { test } from "node:test";
import assert from "node:assert/strict";
import { mapLink, worldName, conePath, claimAt, closestZoom, claimLayers, badgeText, trimChat, backendUrl, maintenance } from "./map.js";

test("backendUrl points at the PC when the page is hosted elsewhere", () => {
  const base = "https://expanse-cam.korat-hoki.ts.net/";
  assert.equal(backendUrl(base, "api/status"), "https://expanse-cam.korat-hoki.ts.net/api/status");
  assert.equal(backendUrl("https://expanse-cam.korat-hoki.ts.net", "cam/whep"), "https://expanse-cam.korat-hoki.ts.net/cam/whep");
  // served by Caddy itself: stay relative
  assert.equal(backendUrl("", "api/ads/img/1"), "api/ads/img/1");
  assert.equal(backendUrl(undefined, "map/"), "map/");
});

test("maintenance only when the PC can't be reached at all", () => {
  assert.equal(maintenance(false), true);
  assert.equal(maintenance(true), false);
});

test("trimChat keeps the newest lines", () => {
  const lines = Array.from({ length: 200 }, (_, i) => ({ id: i + 1 }));
  const kept = trimChat(lines, 150);
  assert.equal(kept.length, 150);
  assert.equal(kept[0].id, 51);
  assert.equal(kept.at(-1).id, 200);
  assert.deepEqual(trimChat([{ id: 1 }], 150), [{ id: 1 }]);
});

test("badgeText", () => {
  assert.equal(badgeText({ live: true, paused: false, viewers: 3 }, true), "Live · 3 watching");
  assert.equal(badgeText({ live: true, paused: false, viewers: 0 }, true), "Live");
  assert.equal(badgeText({ live: false, paused: true, viewers: 0 }, true), "Paused");
  assert.equal(badgeText({ live: false, paused: false, viewers: 0 }, true), "Offline");
  assert.equal(badgeText(null, false), "Offline");
});

const site = { mapUrl: "http://185.206.150.11:8117/", mapZoom: 2, renderer: "vintage_story" };
const cam = { dimension: "minecraft:overworld", x: 120, z: -340 };

// shapes copied from the server's real claim layers
const spawn = {
  type: "poly",
  data: { key: "spawn-1", polylines: [{ points: [
    { x: -1018, z: 171 }, { x: -824, z: 171 }, { x: -824, z: 381 }, { x: -1018, z: 381 }, { x: -1018, z: 171 },
  ] }] },
  options: { popup: { content: "<b>Spawn Area</b>" } },
};
const lyyn = {
  type: "poly",
  data: { key: "player_claims-15", polylines: [{ points: [
    { x: -2152, z: 82 }, { x: -1949, z: 82 }, { x: -1949, z: 346 }, { x: -2152, z: 346 }, { x: -2152, z: 82 },
  ] }] },
  options: { popup: { content: "<b>Lyyn Industrial</b><br>Owner: Lyyn" } },
};
// made up: a small claim inside spawn, to check the smaller one wins
const shop = {
  type: "poly",
  data: { key: "player_claims-99", polylines: [{ points: [
    { x: -950, z: 200 }, { x: -900, z: 200 }, { x: -900, z: 250 }, { x: -950, z: 250 },
  ] }] },
  options: { popup: { content: "<b>Shop &amp; Co</b><br>Owner: Someone" } },
};

test("worldName turns the dimension id into Pl3xmap's folder name", () => {
  assert.equal(worldName("minecraft:overworld"), "minecraft-overworld");
  assert.equal(worldName("minecraft:the_nether"), "minecraft-the_nether");
});

test("mapLink points the map at the camera", () => {
  assert.equal(mapLink(site, cam),
    "http://185.206.150.11:8117/?world=minecraft-overworld&renderer=vintage_story&zoom=2&x=120&z=-340");
});

test("mapLink can point at the proxied copy of the map", () => {
  assert.equal(mapLink(site, cam, "map/"),
    "map/?world=minecraft-overworld&renderer=vintage_story&zoom=2&x=120&z=-340");
});

test("mapLink without a camera is just the map", () => {
  assert.equal(mapLink(site, null), "http://185.206.150.11:8117/");
});

test("closestZoom is the most zoomed in the world allows", () => {
  // Pl3xmap's url zoom counts backwards: 0 is default, negative is zoomed in
  assert.equal(closestZoom({ zoom: { default: 0, maxOut: 3, maxIn: 2 } }), -2);
  assert.equal(closestZoom({ zoom: { default: 0, maxOut: 3, maxIn: 0 } }), 0);
  assert.equal(closestZoom(null), null);
});

test("conePath draws a wedge from the middle", () => {
  assert.match(conePath(45, 40), /^M 0 0 L /);
  assert.match(conePath(45, 40), / Z$/);
});

test("claimLayers picks every claim area layer, not signs or players", () => {
  // the server's real layer list
  const layers = [
    { key: "pl3xclaims_player_claims" }, { key: "pl3xclaims_minigames" }, { key: "pl3xmap_spawn" },
    { key: "pl3xclaims_markers" }, { key: "pl3xclaims_spawn" }, { key: "pl3xmap_players" },
    { key: "pl3xmap_worldborder" }, { key: "pl3xclaims_shopping" },
  ];
  assert.deepEqual(claimLayers(layers),
    ["pl3xclaims_player_claims", "pl3xclaims_minigames", "pl3xclaims_spawn", "pl3xclaims_shopping"]);
  assert.deepEqual(claimLayers(null), []);
});

test("claimAt finds the claim the camera is in", () => {
  assert.equal(claimAt([spawn, lyyn], -2000, 200), "Lyyn Industrial");
  assert.equal(claimAt([spawn, lyyn], -914, 285), "Spawn");
});

test("claimAt picks the smaller claim when they overlap", () => {
  assert.equal(claimAt([spawn, shop], -920, 220), "Shop & Co");
});

test("claimAt gives null outside every claim", () => {
  assert.equal(claimAt([spawn, lyyn], 5000, 5000), null);
  assert.equal(claimAt([], 0, 0), null);
});

test("claimAt skips markers it can't read", () => {
  assert.equal(claimAt([{ type: "icon", data: { point: { x: 0, z: 0 } } }, spawn], -914, 285), "Spawn");
});
