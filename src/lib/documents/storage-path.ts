/** A file path that belongs to one workspace and cannot climb out of it. */
export function isOrgOwnedStoragePath(orgId: string, path: string) {
  if (!orgId || !path) return false;
  if (path.includes("\\") || path.includes("\0")) return false;
  const parts = path.split("/");
  if (parts.some((part) => part.length === 0 || part === "." || part === "..")) return false;
  return parts[0] === orgId && parts.length >= 2;
}
