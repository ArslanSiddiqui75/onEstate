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

export type ContactImportIssue = {
  line: number;
  identifier: string;
  kind: "error" | "warning";
  reason: string;
};

export type ContactImportAccepted = ContactImportRow & { line: number };

export type ContactImportResult = {
  rows: ContactImportRow[];
  /** Accepted rows with source line numbers for stats reports. */
  accepted: ContactImportAccepted[];
  skipped: string[];
  issues: ContactImportIssue[];
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
  if (!parsed.length) return { rows: [], accepted: [], skipped: [], issues: [] };

  const hasHeader = looksLikeHeader(parsed[0]);
  const data = hasHeader ? parsed.slice(1) : parsed;
  const lineOffset = hasHeader ? 2 : 1;
  const index = hasHeader
    ? headerIndex(parsed[0])
    : Object.fromEntries(CONTACT_CSV_HEADERS.map((key, i) => [key, i]));

  const col = (row: string[], key: string, fallback = 0) =>
    row[index[key] ?? fallback] || "";

  const known = [...existing];
  const rows: ContactImportRow[] = [];
  const accepted: ContactImportAccepted[] = [];
  const skipped: string[] = [];
  const issues: ContactImportIssue[] = [];

  data.forEach((raw, indexInData) => {
    const line = indexInData + lineOffset;
    const name = col(raw, "name", 0).trim();
    if (!name) return;

    const email = col(raw, "email", 1).trim().toLowerCase();
    const phone = col(raw, "phone", 2).trim();
    const company = col(raw, "company", 3).trim();
    const category = parseCategory(col(raw, "category", 4));
    const tags = parseTags(col(raw, "tags", 5));
    const notes = col(raw, "notes", 6).trim();
    const identifier = email || phone || name;

    const reject = (kind: "error" | "warning", reason: string) => {
      skipped.push(`${name} (${reason})`);
      issues.push({ line, identifier, kind, reason });
    };

    if (!email && !phone) {
      reject("error", "no email or phone");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      reject("error", "invalid email");
      return;
    }
    if (phone && !isE164(phone)) {
      reject("error", "phone needs a country code");
      return;
    }
    if (findMatchingContact(known, { email, phone })) {
      reject("warning", "already a contact");
      return;
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
    accepted.push({ ...row, line });
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
  });

  return { rows, accepted, skipped, issues };
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
