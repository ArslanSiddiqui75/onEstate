import { NextResponse } from "next/server";
import { z } from "zod";
import dns from "node:dns/promises";

const schema = z.object({
  domain: z.string().min(3).max(253),
  orgId: z.string().min(1),
});

/** The CNAME target tenants must point their domain to. */
export const CNAME_TARGET = "sites.0nestate.app";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid domain payload" }, { status: 400 });
  }

  const { domain } = parsed.data;

  // Basic sanity — strip protocol / trailing slashes / www prefix
  const clean = domain
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/^www\./, "")
    .trim()
    .toLowerCase();

  if (!clean || clean.includes(" ") || !clean.includes(".")) {
    return NextResponse.json(
      { error: "Please enter a valid domain (e.g. myagency.com)" },
      { status: 400 },
    );
  }

  try {
    // Attempt CNAME resolution first
    let cnameVerified = false;
    try {
      const cnames = await dns.resolveCname(clean);
      cnameVerified = cnames.some(
        (c) => c.toLowerCase().replace(/\.$/, "") === CNAME_TARGET,
      );
    } catch {
      // CNAME lookup can fail if the record doesn't exist yet — that's fine.
    }

    if (cnameVerified) {
      return NextResponse.json({
        domain: clean,
        status: "connected",
        message: `CNAME verified — ${clean} points to ${CNAME_TARGET}.`,
        ssl: "provisioning",
      });
    }

    // If CNAME isn't set, try an A-record / general resolve to give feedback
    let resolves = false;
    try {
      const records = await dns.resolve(clean);
      resolves = records.length > 0;
    } catch {
      // Domain may not resolve at all yet
    }

    if (resolves) {
      return NextResponse.json({
        domain: clean,
        status: "pending",
        message: `${clean} resolves, but the CNAME record is not pointing to ${CNAME_TARGET} yet. Add a CNAME record for ${clean} → ${CNAME_TARGET} and try again.`,
        ssl: "none",
      });
    }

    return NextResponse.json({
      domain: clean,
      status: "pending",
      message: `${clean} does not resolve yet. Add a CNAME record pointing ${clean} → ${CNAME_TARGET} in your domain registrar's DNS settings, then verify again. DNS changes can take up to 48 hours to propagate.`,
      ssl: "none",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "DNS verification failed";
    return NextResponse.json(
      { domain: clean, status: "failed", message, ssl: "none" },
      { status: 500 },
    );
  }
}
