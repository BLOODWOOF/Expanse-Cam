// Ads kept in <dir>/ads.json with images next to it
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, renameSync } from "node:fs";
import { join } from "node:path";
import { activeAds, validateAd, AD_TYPES } from "./state.mjs";

export function createAdStore(dir) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "ads.json");
  let ads = [];
  try {
    ads = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    ads = [];
  }

  function save() {
    writeFileSync(file + ".tmp", JSON.stringify(ads, null, 2));
    renameSync(file + ".tmp", file);
  }

  return {
    all() {
      return ads;
    },
    active(now = Date.now()) {
      return activeAds(ads, now);
    },
    // returns { ad } or { error }
    add({ slot, text, ends }, image, mime) {
      const error = validateAd({ slot, text, ends, mime, size: image?.length ?? 0 });
      if (error) return { error };
      const id = ads.reduce((m, a) => Math.max(m, a.id), 0) + 1;
      const name = `ad-${id}.${AD_TYPES[mime]}`;
      writeFileSync(join(dir, name), image);
      const ad = { id, slot, text: text.trim(), ends, image: name, mime };
      ads.push(ad);
      save();
      return { ad };
    },
    remove(id) {
      const ad = ads.find((a) => a.id === id);
      if (!ad) return false;
      ads = ads.filter((a) => a.id !== id);
      save();
      const img = join(dir, ad.image);
      if (existsSync(img)) unlinkSync(img);
      return true;
    },
    image(id) {
      const ad = ads.find((a) => a.id === id);
      if (!ad) return null;
      try {
        return { body: readFileSync(join(dir, ad.image)), mime: ad.mime };
      } catch {
        return null;
      }
    },
  };
}
