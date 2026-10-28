/**
 * Coarse in-memory sliding window. Fine for form spam; resets on cold start.
 */
export function createSlidingWindowLimiter(input: {
  windowMs: number;
  max: number;
}) {
  const hitsByKey = new Map<string, number[]>();

  return function isRateLimited(key: string, now = Date.now()): boolean {
    const hits = (hitsByKey.get(key) || []).filter(
      (at) => now - at < input.windowMs,
    );
    hits.push(now);
    hitsByKey.set(key, hits);
    if (hitsByKey.size > 5000) {
      for (const [k, list] of hitsByKey) {
        if (!list.some((at) => now - at < input.windowMs)) hitsByKey.delete(k);
      }
    }
    return hits.length > input.max;
  };
}
