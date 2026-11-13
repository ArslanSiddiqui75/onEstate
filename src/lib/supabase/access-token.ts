// The workspace stays on screen from the last successful hydrate, but
// getSession() can come back empty (refresh in progress, lock timeout, or a
// token inside the expiry margin). Connect and other API calls then omit the
// Bearer header and the server answers "Sign in required" for someone who is
// still signed in. Keep the last access token the auth client actually handed
// us, and only use it while it is still inside its real expiry.

const EXPIRY_SKEW_MS = 30_000;

let remembered: string | null = null;

function decodeJwtPayload(segment: string): string | null {
  try {
    const pad = segment.length % 4 === 0 ? "" : "=".repeat(4 - (segment.length % 4));
    const b64 = segment.replace(/-/g, "+").replace(/_/g, "/") + pad;
    return atob(b64);
  } catch {
    return null;
  }
}

/** Epoch ms when this access token expires, or null if it has no exp claim. */
export function accessTokenExpiresAt(token: string): number | null {
  const segment = token.split(".")[1];
  if (!segment) return null;
  const json = decodeJwtPayload(segment);
  if (!json) return null;
  try {
    const payload = JSON.parse(json) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isAccessTokenUsable(token: string, now = Date.now()): boolean {
  if (!token) return false;
  const exp = accessTokenExpiresAt(token);
  if (exp === null) return true;
  return exp - now > EXPIRY_SKEW_MS;
}

export function rememberAccessToken(token: string | null) {
  if (!token) {
    remembered = null;
    return;
  }
  if (isAccessTokenUsable(token)) remembered = token;
}

export function rememberedAccessToken(now = Date.now()): string | null {
  if (remembered && isAccessTokenUsable(remembered, now)) return remembered;
  remembered = null;
  return null;
}

/** Read the Supabase JS session from localStorage without taking the auth lock. */
export function readStoredAccessToken(
  storage: Pick<Storage, "getItem">,
  supabaseUrl: string,
  now = Date.now(),
): string | null {
  try {
    const ref = new URL(supabaseUrl).hostname.split(".")[0];
    const raw = storage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      access_token?: unknown;
      currentSession?: { access_token?: unknown };
    };
    const token =
      typeof parsed.access_token === "string"
        ? parsed.access_token
        : typeof parsed.currentSession?.access_token === "string"
          ? parsed.currentSession.access_token
          : null;
    return token && isAccessTokenUsable(token, now) ? token : null;
  } catch {
    return null;
  }
}
