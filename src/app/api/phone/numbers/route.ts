import { NextResponse } from "next/server";
import { z } from "zod";
import { isE164 } from "@/lib/phone/e164";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import {
  buyNumber,
  countryForMarket,
  hasTwilioAccount,
  searchNumbers,
  type NumberCountry,
} from "@/lib/twilio/numbers";

function countryFrom(value: string | null): NumberCountry {
  return value === "US" ? "US" : "GB";
}

async function assertOwner(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  const supabase = createServiceSupabaseClient();
  if (supabase && !profile) {
    return {
      profile: null,
      denied: NextResponse.json({ error: "Sign in required" }, { status: 401 }),
    };
  }
  if (profile && profile.role !== "owner") {
    return {
      profile,
      denied: NextResponse.json({ error: "Only the owner can buy a number." }, { status: 403 }),
    };
  }
  return { profile, denied: null };
}

export async function GET(request: Request) {
  const { denied } = await assertOwner(request);
  if (denied) return denied;
  if (!hasTwilioAccount()) {
    return NextResponse.json({
      configured: false,
      numbers: [],
      error: "Number search isn’t available yet.",
    });
  }
  const url = new URL(request.url);
  const country = countryFrom(
    url.searchParams.get("country") || countryForMarket(url.searchParams.get("market")),
  );
  try {
    const result = await searchNumbers(country, url.searchParams.get("contains") || "");
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Could not search numbers." }, { status: 500 });
  }
}

const buySchema = z.object({
  phoneNumber: z.string().refine((value) => isE164(value), "Choose a number from the list."),
});

export async function POST(request: Request) {
  const { denied } = await assertOwner(request);
  if (denied) return denied;
  const json = await request.json().catch(() => null);
  const parsed = buySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a number from the list." }, { status: 400 });
  }
  try {
    const phoneNumber = await buyNumber(parsed.data.phoneNumber);
    return NextResponse.json({ ok: true, phoneNumber });
  } catch {
    return NextResponse.json({ error: "Could not buy that number." }, { status: 500 });
  }
}
