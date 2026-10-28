import { NextResponse } from "next/server";
import { z } from "zod";
import {
  checkDomainDns,
  normalizeDomain,
  normalizeMailbox,
  recordsForDomain,
} from "@/lib/email/domain";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  domain: z.string().min(1),
  fromLocal: z.string().min(1),
  fromName: z.string().min(1).max(80),
});

export async function POST(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  const supabase = createServiceSupabaseClient();
  if (supabase && !profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (profile && profile.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can connect a domain." }, { status: 403 });
  }
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the domain, mailbox, and from name." }, { status: 400 });
  }
  const domain = normalizeDomain(parsed.data.domain);
  const fromLocal = normalizeMailbox(parsed.data.fromLocal);
  const fromName = parsed.data.fromName.trim();
  if (!domain || !fromLocal || fromName.length < 2) {
    return NextResponse.json(
      { error: "Use a real domain, such as northbridge.co.uk, and a mailbox such as hello." },
      { status: 400 },
    );
  }
  const records = recordsForDomain(domain);
  const dns = await checkDomainDns(domain);
  return NextResponse.json({
    domain,
    fromLocal,
    fromName,
    records,
    missing: dns.missing,
    verified: dns.verified,
  });
}
