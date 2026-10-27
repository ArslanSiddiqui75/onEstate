import { NextResponse } from "next/server";
import { z } from "zod";
import { readBusinessProfile } from "@/lib/org/business-profile";
import {
  buyDomain,
  isNamecheapConfigured,
  pointDomainAtWebsite,
  publicNamecheapError,
  registrantFromProfile,
  searchDomains,
  type DomainMarket,
  type RegistrantContact,
} from "@/lib/namecheap/domains";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { attachVercelDomain, checkCustomDomain } from "@/lib/website/domain";
import { persistDomain } from "@/lib/website/persist-domain";

export const runtime = "nodejs";
export const maxDuration = 60;

const UNAVAILABLE = "Domain buying isn’t available yet.";

function marketFrom(value: string | null | undefined): DomainMarket {
  return value === "us" ? "us" : "uk";
}

async function assertOwner(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  const supabase = createServiceSupabaseClient();
  if (supabase && !profile) {
    return { profile: null, denied: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
  }
  if (profile && profile.role !== "owner") {
    return {
      profile,
      denied: NextResponse.json({ error: "Only the owner can buy or connect a domain." }, { status: 403 }),
    };
  }
  return { profile, denied: null };
}

export async function GET(request: Request) {
  const { denied } = await assertOwner(request);
  if (denied) return denied;
  if (!isNamecheapConfigured()) {
    return NextResponse.json({ configured: false, results: [], error: UNAVAILABLE });
  }
  const url = new URL(request.url);
  try {
    const results = await searchDomains(url.searchParams.get("q") || "", marketFrom(url.searchParams.get("market")));
    return NextResponse.json({ configured: true, results });
  } catch (error) {
    const message = error instanceof Error ? publicNamecheapError(error.message) : "Could not search domains.";
    const status = /enter a name/i.test(message) ? 400 : message === UNAVAILABLE ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

const contactSchema = z.object({
  fullName: z.string().max(120).optional().default(""),
  organization: z.string().max(120).optional().default(""),
  address: z.string().max(160).optional().default(""),
  city: z.string().max(80).optional().default(""),
  postcode: z.string().max(16).optional().default(""),
  phone: z.string().max(24).optional().default(""),
  email: z.string().max(160).optional().default(""),
  country: z.enum(["GB", "US"]).optional(),
});

const postSchema = z.object({
  action: z.enum(["buy", "connect"]),
  domain: z.string().min(3).max(253),
  legalType: z.enum(["IND", "FIND", "LTD", "PLC", "LLP", "STRA", "OTHER", "RCHAR"]).optional(),
  companyId: z.string().max(32).optional(),
  contact: contactSchema.optional(),
});

async function contactFor(
  profile: { userId: string; orgId: string } | null,
  body: z.infer<typeof contactSchema> | undefined,
  market: DomainMarket,
): Promise<RegistrantContact> {
  if (profile) {
    const supabase = createServiceSupabaseClient();
    if (!supabase) throw new Error(UNAVAILABLE);
    const [{ data: org }, { data: user }] = await Promise.all([
      supabase.from("organizations").select("business, market").eq("id", profile.orgId).maybeSingle(),
      supabase.from("profiles").select("full_name").eq("id", profile.userId).maybeSingle(),
    ]);
    const business = readBusinessProfile(org?.business);
    const country = org?.market === "us" ? "US" : "GB";
    return registrantFromProfile({
      fullName: String(user?.full_name || ""),
      organization: business?.tradingName || "",
      address: business?.address || "",
      city: business?.city || "",
      postcode: business?.postcode || "",
      phone: business?.phone || "",
      email: business?.email || "",
      country,
    });
  }
  return registrantFromProfile({
    fullName: body?.fullName || "",
    organization: body?.organization || "",
    address: body?.address || "",
    city: body?.city || "",
    postcode: body?.postcode || "",
    phone: body?.phone || "",
    email: body?.email || "",
    country: body?.country || (market === "us" ? "US" : "GB"),
  });
}

async function finishConnection(orgId: string | undefined, domain: string) {
  const check = await checkCustomDomain(domain);
  const names = [...new Set([check.host, check.lookupHost, domain].filter(Boolean))];
  for (const name of names) {
    const attached = await attachVercelDomain(name);
    if (attached?.attached && check.ssl !== "active") check.ssl = "provisioning";
  }
  if (orgId) {
    const persistError = await persistDomain(orgId, check, "namecheap");
    if (persistError) throw new Error(persistError);
  }
  return check;
}

export async function POST(request: Request) {
  const { profile, denied } = await assertOwner(request);
  if (denied) return denied;
  if (!isNamecheapConfigured()) {
    return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });
  }
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a domain such as northbridge.co.uk." }, { status: 400 });
  }
  try {
    if (parsed.data.action === "connect") {
      const domain = await pointDomainAtWebsite(parsed.data.domain);
      const check = await finishConnection(profile?.orgId, domain);
      return NextResponse.json({
        ok: true,
        domain,
        status: check.status,
        ssl: check.ssl,
        message: check.message,
      });
    }
    const contact = await contactFor(profile, parsed.data.contact, marketFrom(parsed.data.contact?.country === "US" ? "us" : "uk"));
    const bought = await buyDomain(contact, parsed.data.domain, {
      legalType: parsed.data.legalType,
      companyId: parsed.data.companyId,
    });
    const check = await finishConnection(profile?.orgId, bought.domain);
    return NextResponse.json({
      ok: true,
      domain: bought.domain,
      chargedAmount: bought.chargedAmount,
      currency: bought.currency,
      dnsReady: bought.dnsReady,
      status: check.status,
      ssl: check.ssl,
      message: bought.dnsReady
        ? check.message
        : bought.dnsError || "The domain is registered. Add the website records below.",
    });
  } catch (error) {
    const message = error instanceof Error ? publicNamecheapError(error.message) : "That domain request didn’t go through.";
    const status = /available yet/i.test(message)
      ? 503
      : /before buying|company number|enter a |enter the domain|isn.t available|premium price/i.test(message)
        ? 400
        : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
