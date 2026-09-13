import type { Contact } from "@/types";

function digits(value: string | undefined): string {
  return (value || "").replace(/\D/g, "");
}

function emailsMatch(a: string | undefined, b: string | undefined): boolean {
  const left = a?.trim().toLowerCase();
  const right = b?.trim().toLowerCase();
  return Boolean(left && right && left === right);
}

function phoneSet(contact: {
  phone?: string;
  phones?: Array<{ number: string }>;
}): Set<string> {
  const values = [contact.phone, ...(contact.phones || []).map((p) => p.number)]
    .map(digits)
    .filter((n) => n.length >= 7);
  return new Set(values);
}

/** Find an existing org contact by email or phone so lead create does not duplicate. */
export function findMatchingContact(
  contacts: Contact[],
  input: {
    email?: string;
    phone?: string;
    phones?: Array<{ number: string }>;
    leadId?: string;
  },
): Contact | undefined {
  if (input.leadId) {
    const linked = contacts.find((c) => c.leadId === input.leadId);
    if (linked) return linked;
  }
  const incomingPhones = phoneSet(input);
  return contacts.find((contact) => {
    if (emailsMatch(contact.email, input.email)) return true;
    const existing = phoneSet(contact);
    for (const n of incomingPhones) {
      if (existing.has(n)) return true;
    }
    return false;
  });
}
