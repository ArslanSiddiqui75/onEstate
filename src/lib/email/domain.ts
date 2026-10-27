import { Resolver } from "node:dns/promises";
import { mailHost, missingDns, recordsForDomain } from "@/lib/email/domain-model";

export type { DnsRecord, EmailDomain } from "@/lib/email/domain-model";
export {
  formatFromAddress,
  mailHost,
  missingDns,
  normalizeDomain,
  normalizeMailbox,
  readEmailDomain,
  recordsForDomain,
} from "@/lib/email/domain-model";

export async function checkDomainDns(domain: string, host = mailHost()) {
  const records = recordsForDomain(domain, host);
  const resolver = new Resolver();
  const found = { cname: {} as Record<string, string[]>, txt: {} as Record<string, string[]> };
  await Promise.all(
    records.map(async (record) => {
      try {
        if (record.type === "CNAME") {
          found.cname[record.host] = await resolver.resolveCname(record.host);
        } else {
          const rows = await resolver.resolveTxt(record.host);
          found.txt[record.host] = rows.map((parts) => parts.join(""));
        }
      } catch {
        // Absent records stay missing.
      }
    }),
  );
  const missing = missingDns(domain, found, host);
  return { records, missing, verified: missing.length === 0 };
}

export function smtpConfigured() {
  return Boolean((process.env.SMTP_HOST || "").trim());
}

export async function sendDomainEmail(input: {
  from: string;
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}) {
  if (!smtpConfigured()) {
    throw new Error("Email can’t be sent yet. Check the sending domain in Settings.");
  }
  const nodemailer = await import("nodemailer");
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" }
      : undefined,
  });
  const info = await transport.sendMail({
    from: input.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
  });
  return {
    sid: info.messageId || `mail_${Date.now()}`,
    status: "sent",
    mode: "live" as const,
  };
}
