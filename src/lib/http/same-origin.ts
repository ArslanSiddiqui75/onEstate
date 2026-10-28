function bareHost(value: string) {
  return value.trim().toLowerCase().split(",")[0]?.trim().replace(/:\d+$/, "") || "";
}

function isProductHost(host: string) {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "0nestreet.co.uk" ||
    host === "0nestreet.com" ||
    host.endsWith(".0nestreet.co.uk") ||
    host.endsWith(".0nestreet.com")
  );
}

/**
 * Build a redirect on this app. A forged `x-forwarded-host` must not send
 * the browser to another site. The request host and the product domains are
 * the only names we will follow.
 */
export function appRedirectUrl(request: Request, path: string): URL {
  const current = new URL(request.url);
  const forwarded = (request.headers.get("x-forwarded-host") || "").split(",")[0]?.trim() || "";
  const host = bareHost(request.headers.get("host") || "");
  const candidate = bareHost(forwarded);
  const safeName = /^[a-z0-9.-]+$/.test(candidate);
  if (candidate && safeName && (candidate === host || isProductHost(candidate))) {
    const protoHeader = (request.headers.get("x-forwarded-proto") || "").split(",")[0]?.trim();
    const proto =
      protoHeader === "http" || protoHeader === "https"
        ? protoHeader
        : current.protocol.replace(":", "");
    return new URL(path, `${proto}://${forwarded}`);
  }
  return new URL(path, current);
}

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
