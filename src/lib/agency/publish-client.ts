import type { PortalRecord } from "@/lib/agency/types";
import { copyToClipboard } from "@/lib/utils";

const published = new Set<string>();
const inflight = new Map<string, Promise<void>>();

export function markPortalsPublished(tokens: Iterable<string>) {
  for (const token of tokens) {
    if (token) published.add(token);
  }
}

/** Tell the public site about a client link. Safe to call more than once. */
export function publishPortalRecord(
  portal: Pick<PortalRecord, "token" | "role" | "name" | "address" | "listingId" | "leadId" | "lettingsToken">,
): Promise<void> {
  const token = portal.token.trim();
  if (published.has(token)) return Promise.resolve();
  const existing = inflight.get(token);
  if (existing) return existing;

  const job = (async () => {
    const res = await fetch("/api/agency", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "register",
        token,
        role: portal.role,
        name: portal.name,
        address: portal.address,
        listingId: portal.listingId,
        leadId: portal.leadId,
        lettingsToken: portal.lettingsToken,
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || "The public link could not be published.");
    }
    published.add(token);
  })().finally(() => {
    if (!published.has(token)) inflight.delete(token);
  });

  inflight.set(token, job);
  return job;
}

export async function publishMissingPortals(portals: PortalRecord[], alreadyOnServer: Iterable<string>) {
  markPortalsPublished(alreadyOnServer);
  const missing = portals.filter(
    (portal) =>
      portal.token.trim().length >= 4 &&
      portal.name.trim().length >= 2 &&
      portal.address.trim().length > 0 &&
      !published.has(portal.token),
  );
  await Promise.all(missing.map((portal) => publishPortalRecord(portal).catch(() => undefined)));
}

export function clientPortalPath(token: string) {
  return `/portal/${encodeURIComponent(token)}`;
}

/** Open the public page only after the server will recognise the token. */
export async function openClientPortal(portal: PortalRecord) {
  const tab = window.open("about:blank", "_blank");
  try {
    await publishPortalRecord(portal);
    const url = clientPortalPath(portal.token);
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
      return;
    }
    window.location.assign(url);
  } catch (err) {
    tab?.close();
    throw err;
  }
}

export async function copyClientPortal(portal: PortalRecord) {
  const url = `${window.location.origin}${clientPortalPath(portal.token)}`;
  const copied = copyToClipboard(url);
  await publishPortalRecord(portal);
  return copied;
}
