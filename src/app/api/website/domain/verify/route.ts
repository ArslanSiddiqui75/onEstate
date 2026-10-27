import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { forbiddenIfNoModule } from "@/lib/server/require-module";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { persistDomain } from "@/lib/website/persist-domain";
import {
  attachVercelDomain,
  checkCustomDomain,
  dnsInstructions,
} from "@/lib/website/domain";

export const runtime = "nodejs";
export const maxDuration = 30;

const schema = z.object({
  domain: z.string().min(3).max(253),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid domain payload" }, { status: 400 });
  }

  const profile = await resolveProfileFromRequest(request);
  const supabase = createServiceSupabaseClient();
  if (supabase && !profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (profile) {
    const denied = forbiddenIfNoModule(profile, "website", "edit");
    if (denied) return denied;
  }
  const check = await checkCustomDomain(parsed.data.domain);

  if (check.dnsOk) {
    const names = [...new Set([check.host, check.lookupHost].filter(Boolean))];
    let vercel: Awaited<ReturnType<typeof attachVercelDomain>> = null;
    for (const name of names) {
      const result = await attachVercelDomain(name);
      if (!result) continue;
      if (!vercel || result.attached) vercel = result;
    }
    if (vercel) {
      check.vercel = vercel;
      if (vercel.attached && check.ssl !== "active") {
        check.ssl = "provisioning";
      }
    }
  }

  if (profile && check.host) {
    const persistError = await persistDomain(profile.orgId, check);
    if (persistError) {
      return NextResponse.json(
        {
          error: persistError,
          domain: check.host,
          status: "failed",
          ssl: "none",
          message: persistError,
          apex: check.apex,
          instructions: check.instructions,
        },
        { status: persistError.includes("already connected") ? 409 : 500 },
      );
    }
  }

  return NextResponse.json({
    domain: check.host,
    status: check.status,
    ssl: check.ssl,
    message: check.message,
    apex: check.apex,
    instructions: check.instructions.length
      ? check.instructions
      : dnsInstructions(check.host),
    vercel: check.vercel || undefined,
  });
}
