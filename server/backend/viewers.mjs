// Asks MediaMTX's API (localhost only) whether the cam path has a stream and how many are watching
export async function readPath(api = "http://127.0.0.1:9997") {
  try {
    const res = await fetch(`${api}/v3/paths/get/cam`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return { ready: false, viewers: 0 };
    const path = await res.json();
    return { ready: path.ready === true, viewers: Array.isArray(path.readers) ? path.readers.length : 0 };
  } catch {
    return { ready: false, viewers: 0 };
  }
}
