/**
 * Validates a post-login redirect target. Only in-app paths are allowed so a
 * crafted link can never bounce a user to an external site after sign-in.
 */
export function sanitizeRedirectTo(raw: string | null | undefined): string {
  const fallback = "/app";
  if (!raw) return fallback;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return fallback;
  }
  if (!decoded.startsWith("/app")) return fallback;
  // Reject protocol-relative ("//evil.com") and backslash tricks.
  if (decoded.startsWith("//") || decoded.includes("\\")) return fallback;
  // Never bounce back into the auth pages themselves.
  if (
    decoded.startsWith("/app/login") ||
    decoded.startsWith("/app/signup") ||
    decoded.startsWith("/app/reset-password")
  ) {
    return fallback;
  }
  return decoded;
}
