// Plain data logic for the backend, no I/O

export function createChat(max = 200) {
  const lines = [];
  let nextId = 1;
  return {
    add({ text, kind }) {
      // § codes are Minecraft colours/formatting, e.g. from the Discord bridge
      const clean = String(text).replace(/§[0-9a-fk-orx]/gi, "").trim();
      const line = { id: nextId++, text: clean, kind: kind === "game" ? "game" : "chat", time: Date.now() };
      lines.push(line);
      if (lines.length > max) lines.shift();
      return line;
    },
    after(id) {
      return lines.filter((l) => l.id > id);
    },
  };
}

// Ads that haven't run out, newest per slot, slot 1 first
export function activeAds(ads, now) {
  const bySlot = new Map();
  for (const ad of ads) {
    if (ad.ends <= now) continue;
    const cur = bySlot.get(ad.slot);
    if (!cur || ad.id > cur.id) bySlot.set(ad.slot, ad);
  }
  return [...bySlot.values()].sort((a, b) => a.slot - b.slot);
}

export const AD_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
const MAX_IMAGE = 2 * 1024 * 1024;

// null when fine, otherwise a message for the admin page
export function validateAd({ slot, text, ends, mime, size }) {
  // 1-2 left side, 3-4 right side, top to bottom
  if (![1, 2, 3, 4].includes(slot)) return "Pick a slot from 1 to 4";
  if (typeof text !== "string" || !text.trim() || text.length > 200) return "Ad text has to be 1-200 characters";
  if (!Number.isFinite(ends) || ends <= Date.now()) return "The end date has to be in the future";
  if (!AD_TYPES[mime]) return "The image has to be a png, jpg, webp or gif";
  if (!(size > 0) || size > MAX_IMAGE) return "The image has to be under 2 MB";
  return null;
}
