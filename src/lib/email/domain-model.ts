/** Brokerage domain that conversation email is sent from. Safe to import in the browser. */

export interface EmailDomain {
  domain: string;
  fromLocal: string;
  fromName: string;
  status: "pending" | "verified";
  checkedAt?: string;
}

export interface DnsRecord {
  type: "CNAME" | "TXT";
  host: string;
  value: string;
  purpose: string;
}

export interface DnsLookups {
  cname: Record<string, string[]>;
  txt: Record<string, string[]>;
}

export function mailHost() {
  return (process.env.MAIL_HOST || "mail.onestreet.app").trim().replace(/\.+$/, "").toLowerCase();
}

export function normalizeDomain(raw: string) {
  const domain = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .replace(/\.+$/, "");
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain)) {
    return null;
  }
  return domain;
}

export function normalizeMailbox(raw: string) {
  const local = raw.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,62}$/.test(local)) return null;
  return local;
}

export function recordsForDomain(domain: string, host = mailHost()): DnsRecord[] {
  return [
    {
      type: "CNAME",
      host: `mail.${domain}`,
      value: host,
      purpose: "Sends mail for this domain through the app.",
    },
    {
      type: "CNAME",
      host: `s1._domainkey.${domain}`,
      value: `s1._domainkey.${host}`,
      purpose: "DKIM signature so inboxes trust the sender.",
    },
    {
      type: "TXT",
      host: domain,
      value: `v=spf1 include:${host} ~all`,
      purpose: "Authorises the app to send from this domain.",
    },
    {
      type: "TXT",
      host: `_dmarc.${domain}`,
      value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}`,
      purpose: "Tells inboxes how to handle mail that fails checks.",
    },
  ];
}

function hostMatches(actual: string, expected: string) {
  return actual.trim().replace(/\.+$/, "").toLowerCase() === expected.trim().replace(/\.+$/, "").toLowerCase();
}

/** Mail CNAME, DKIM CNAME, and SPF are required. DMARC is shown but does not block sending. */
export function missingDns(domain: string, found: DnsLookups, host = mailHost()) {
  const records = recordsForDomain(domain, host);
  const missing: string[] = [];
  for (const record of records) {
    if (record.host.startsWith("_dmarc.")) continue;
    if (record.type === "CNAME") {
      const values = found.cname[record.host] || [];
      if (!values.some((value) => hostMatches(value, record.value))) missing.push(record.host);
      continue;
    }
    const values = found.txt[record.host] || [];
    const needle = `include:${host}`.toLowerCase();
    if (!values.some((value) => value.toLowerCase().includes(needle))) missing.push(record.host);
  }
  return missing;
}

export function formatFromAddress(domain: Pick<EmailDomain, "fromName" | "fromLocal" | "domain">) {
  const name = domain.fromName.replace(/[<>"]/g, "").trim() || domain.domain;
  return `${name} <${domain.fromLocal}@${domain.domain}>`;
}

export function readEmailDomain(raw: unknown): EmailDomain | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const row = raw as Partial<EmailDomain>;
  const domain = normalizeDomain(String(row.domain || ""));
  const fromLocal = normalizeMailbox(String(row.fromLocal || ""));
  const fromName = String(row.fromName || "").trim().slice(0, 80);
  if (!domain || !fromLocal || !fromName) return undefined;
  return {
    domain,
    fromLocal,
    fromName,
    status: row.status === "verified" ? "verified" : "pending",
    checkedAt: row.checkedAt ? String(row.checkedAt) : undefined,
  };
}
