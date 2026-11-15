// Global cache of decoded images: once an image is here, showing it is instant (no network, no decode jank).
// Keeping the HTMLImageElement alive pins the decoded bitmap in the browser's memory cache.

const cache = new Map<string, Promise<HTMLImageElement | null>>();
const ready = new Set<string>();

export function preloadImage(url: string): Promise<HTMLImageElement | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  let p = cache.get(url);
  if (!p) {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    p = img
      .decode()
      .then(() => {
        ready.add(url);
        return img;
      })
      .catch(() => null);
    cache.set(url, p);
  }
  return p;
}

/** Load a list, `parallel` at a time, in order (first ones first). */
export async function preloadImages(urls: string[], parallel = 3) {
  const queue = [...new Set(urls)];
  const worker = async () => {
    while (queue.length) await preloadImage(queue.shift()!);
  };
  await Promise.all(Array.from({ length: parallel }, worker));
}

export const isImageReady = (url?: string | null) => !!url && ready.has(url);
