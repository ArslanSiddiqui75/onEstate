/** Keep billing return URLs on this app. A client-supplied URL must not leave the origin. */
export function sameOriginUrl(candidate: string | undefined, fallback: string, origin: string) {
  if (!candidate) return fallback;
  try {
    const url = new URL(candidate);
    if (url.origin !== origin) return fallback;
    if (url.username || url.password) return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}
