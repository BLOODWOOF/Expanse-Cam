import { test } from "node:test";
import assert from "node:assert/strict";
import { createChat, activeAds, validateAd } from "./state.mjs";

test("chat keeps only the newest lines", () => {
  const chat = createChat(3);
  for (const text of ["a", "b", "c", "d"]) chat.add({ text, kind: "chat" });
  assert.deepEqual(chat.after(0).map((l) => l.text), ["b", "c", "d"]);
  assert.deepEqual(chat.after(3).map((l) => l.text), ["d"]);
  assert.deepEqual(chat.after(4), []);
});

test("chat drops Minecraft colour codes", () => {
  const chat = createChat();
  assert.equal(chat.add({ text: "§9[Discord]§r BLOODWOLF: testing again ", kind: "game" }).text, "[Discord] BLOODWOLF: testing again");
  assert.equal(chat.add({ text: "§x§f§f§0§0§0§0red hex§r", kind: "chat" }).text, "red hex");
});

test("chat lines get ids and times", () => {
  const chat = createChat();
  const line = chat.add({ text: "hi", kind: "chat" });
  assert.equal(line.id, 1);
  assert.equal(typeof line.time, "number");
});

test("activeAds drops expired ones", () => {
  assert.deepEqual(activeAds([{ id: 1, slot: 1, ends: 999 }, { id: 2, slot: 2, ends: 2000 }], 1000).map((a) => a.id), [2]);
});

test("activeAds keeps the newest ad per slot, sorted by slot", () => {
  const ads = [{ id: 4, slot: 2, ends: 2000 }, { id: 1, slot: 1, ends: 2000 }, { id: 3, slot: 1, ends: 2000 }];
  assert.deepEqual(activeAds(ads, 1000).map((a) => a.id), [3, 4]);
});

test("validateAd", () => {
  const ok = { slot: 1, text: "Buy diamonds", ends: Date.now() + 1e6, mime: "image/png", size: 1000 };
  assert.equal(validateAd(ok), null);
  assert.equal(validateAd({ ...ok, slot: 4 }), null);
  assert.match(validateAd({ ...ok, slot: 5 }), /slot/);
  assert.match(validateAd({ ...ok, slot: 0 }), /slot/);
  assert.match(validateAd({ ...ok, mime: "text/html" }), /image/);
  assert.match(validateAd({ ...ok, size: 3e6 }), /2 MB/);
  assert.match(validateAd({ ...ok, text: "" }), /text/);
  assert.match(validateAd({ ...ok, text: "x".repeat(201) }), /text/);
  assert.match(validateAd({ ...ok, ends: Date.now() - 1 }), /end/);
});
