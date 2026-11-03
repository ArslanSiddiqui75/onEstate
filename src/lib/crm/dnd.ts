import { findMatchingContact } from "@/lib/crm/contact-match";
import type { Contact, Lead } from "@/types";

const STORAGE_PREFIX = "onestreet:contact-dnd:";

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function loadLocalContactDnd(userId: string): string[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

export function saveLocalContactDnd(userId: string, contactIds: string[]) {
  if (typeof window === "undefined" || !userId) return;
  const unique = Array.from(new Set(contactIds.filter(Boolean)));
  window.localStorage.setItem(storageKey(userId), JSON.stringify(unique));
}

export function contactIsDnd(contactId: string, dndContactIds: Iterable<string>) {
  const set = dndContactIds instanceof Set ? dndContactIds : new Set(dndContactIds);
  return set.has(contactId);
}

/** Resolve the contact this lead maps to, then check the current user's DND list. */
export function leadIsDndForUser(
  lead: Pick<Lead, "id" | "email" | "phone" | "phones">,
  contacts: Contact[],
  dndContactIds: Iterable<string>,
): Contact | null {
  const set = dndContactIds instanceof Set ? dndContactIds : new Set(dndContactIds);
  if (set.size === 0) return null;
  const matched = findMatchingContact(contacts, {
    leadId: lead.id,
    email: lead.email,
    phone: lead.phone,
    phones: lead.phones,
  });
  if (matched && set.has(matched.id)) return matched;
  return null;
}

export const DND_BLOCK_MESSAGE =
  "You have this contact on Do Not Disturb. Turn DND off on the contact to message them from your account.";
