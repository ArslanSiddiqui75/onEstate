const DEFAULT_APEX_IP = "76.76.21.21";

/** Lowercase host, no protocol/path/port. Keeps `www.` so DNS instructions stay accurate. */
export function cleanHost(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

export function cnameTarget(): string {
  return (
    process.env.WEBSITE_CNAME_TARGET ||
    process.env.NEXT_PUBLIC_WEBSITE_CNAME_TARGET ||
    "sites.0nestate.app"
  ).toLowerCase();
}

export function apexARecord(): string {
  return (
    process.env.WEBSITE_APEX_IPS?.split(",")[0]?.trim() ||
    process.env.NEXT_PUBLIC_WEBSITE_APEX_IP ||
    DEFAULT_APEX_IP
  ).trim();
}

export function isApexHost(host: string): boolean {
  const parts = host.split(".").filter(Boolean);
  const multiPartTlds = ["co.uk", "org.uk", "ac.uk", "com.au", "net.au", "co.nz", "co.za"];
  const lastTwo = parts.slice(-2).join(".");
  if (parts[0] === "www") return false;
  if (multiPartTlds.includes(lastTwo)) return parts.length <= 3;
  return parts.length <= 2;
}

export interface DnsInstruction {
  type: "CNAME" | "A";
  host: string;
  value: string;
  note: string;
}

export function dnsInstructions(rawDomain: string): DnsInstruction[] {
  const host = cleanHost(rawDomain);
  if (!host) return [];
  const target = cnameTarget();
  if (isApexHost(host)) {
    return [
      {
        type: "A",
        host: "@",
        value: apexARecord(),
        note: "Apex domains cannot use a CNAME. Point the root A record here (Vercel).",
      },
      {
        type: "CNAME",
        host: "www",
        value: target,
        note: "Recommended: also send www to the same site.",
      },
    ];
  }
  const labels = host.split(".");
  const recordHost = labels.length > 2 ? labels[0] : "www";
  return [
    {
      type: "CNAME",
      host: recordHost,
      value: target,
      note: `Create this CNAME at your registrar. Value must be ${target} (or cname.vercel-dns.com).`,
    },
  ];
}
