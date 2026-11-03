import { findMatchingContact } from "@/lib/crm/contact-match";
import { parseCsv, toCsv } from "@/lib/csv";
import { isE164 } from "@/lib/phone/e164";
import type { Contact, ContactCategory } from "@/types";

export const CONTACT_CSV_HEADERS = [
  "name",
  "email",
  "phone",
  "company",
  "category",
  "tags",
  "notes",
] as const;

export const CONTACT_CATEGORIES: ContactCategory[] = [
  "lead",
  "client",
  "past_client",
  "vendor",
  "partner",
  "other",
];

export type ContactImportRow = {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  category: ContactCategory;
  tags: string[];
  notes?: string;
};

export type ContactImportResult = {
  rows: ContactImportRow[];
  skipped: string[];
};

function parseTags(value: string | undefined): string[] {
  return (value || "")
    .split(/[|,;]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseCategory(value: string | undefined): ContactCategory {
  const raw = (value || "other").trim().toLowerCase().replace(/\s+/g, "_");
  if ((CONTACT_CATEGORIES as string[]).includes(raw)) return raw as ContactCategory;
  if (raw === "active_client" || raw === "active") return "client";
  if (raw === "past" || raw === "pastclient") return "past_client";
  return "other";
}

function headerIndex(header: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  header.forEach((cell, index) => {
    const key = cell.trim().toLowerCase();
    if (key) map[key] = index;
  });
  return map;
}

function looksLikeHeader(row: string[] | undefined): boolean {
  if (!row?.length) return false;
  const joined = row.map((cell) => cell.toLowerCase()).join(" ");
  return joined.includes("name") && (joined.includes("email") || joined.includes("phone"));
}

/** Parse CSV / paste text into contact payloads. Skips invalid and duplicate rows. */
export function parseContactImportCsv(
  text: string,
  existing: Contact[],
): ContactImportResult {
  const parsed = parseCsv(text);
  if (!parsed.length) return { rows: [], skipped: [] };

  const hasHeader = looksLikeHeader(parsed[0]);
  const data = hasHeader ? parsed.slice(1) : parsed;
  const index = hasHeader
    ? headerIndex(parsed[0])
    : Object.fromEntries(CONTACT_CSV_HEADERS.map((key, i) => [key, i]));

  const col = (row: string[], key: string, fallback = 0) =>
    row[index[key] ?? fallback] || "";

  const known = [...existing];
  const rows: ContactImportRow[] = [];
  const skipped: string[] = [];

  for (const raw of data) {
    const name = col(raw, "name", 0).trim();
    if (!name) continue;

    const email = col(raw, "email", 1).trim().toLowerCase();
    const phone = col(raw, "phone", 2).trim();
    const company = col(raw, "company", 3).trim();
    const category = parseCategory(col(raw, "category", 4));
    const tags = parseTags(col(raw, "tags", 5));
    const notes = col(raw, "notes", 6).trim();

    if (!email && !phone) {
      skipped.push(`${name} (no email or phone)`);
      continue;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      skipped.push(`${name} (invalid email)`);
      continue;
    }
    if (phone && !isE164(phone)) {
      skipped.push(`${name} (phone needs a country code)`);
      continue;
    }
    if (findMatchingContact(known, { email, phone })) {
      skipped.push(`${name} (already a contact)`);
      continue;
    }

    const row: ContactImportRow = {
      name,
      email: email || undefined,
      phone: phone || undefined,
      company: company || undefined,
      category,
      tags,
      notes: notes || undefined,
    };
    rows.push(row);
    known.push({
      id: `import-${known.length}`,
      name,
      email,
      phone,
      category,
      tags,
      market: "uk",
      createdAt: "",
      updatedAt: "",
    });
  }

  return { rows, skipped };
}

export function contactImportTemplateCsv(): string {
  return toCsv([
    [...CONTACT_CSV_HEADERS],
    [
      "Jane Smith",
      "jane@brokerage.com",
      "+447700900111",
      "Northbridge",
      "lead",
      "buyer, hot",
      "Met at open house",
    ],
    [
      "Sam Vendor",
      "sam@trades.example",
      "+15551234567",
      "Acme Plumbing",
      "vendor",
      "preferred",
      "",
    ],
  ]);
}

export function contactsToCsv(contacts: Contact[]): string {
  return toCsv([
    [...CONTACT_CSV_HEADERS],
    ...contacts.map((contact) => [
      contact.name,
      contact.email || "",
      contact.phone || "",
      contact.company || "",
      contact.category,
      contact.tags.join("|"),
      contact.notes || "",
    ]),
  ]);
}

export function mergeTags(existing: string[], incoming: string[]): string[] {
  const next = new Set(existing.map((tag) => tag.trim()).filter(Boolean));
  for (const tag of incoming) {
    const cleaned = tag.trim();
    if (cleaned) next.add(cleaned);
  }
  return Array.from(next);
}

export function removeTags(existing: string[], remove: string[]): string[] {
  const drop = new Set(remove.map((tag) => tag.trim().toLowerCase()).filter(Boolean));
  return existing.filter((tag) => !drop.has(tag.trim().toLowerCase()));
}
