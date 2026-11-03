import { NextResponse } from "next/server";
import { z } from "zod";
import { isE164 } from "@/lib/phone/e164";
import {
  MAX_ORG_PHONE_NUMBERS,
  addOrgPhoneNumber,
  listOrgPhoneNumbers,
  setDefaultOrgPhoneNumber,
} from "@/lib/phone/org-numbers";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { workspaceBlocked } from "@/lib/server/require-module";
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
      denied: NextResponse.json({ error: "Only the owner can manage phone numbers." }, { status: 403 }),
    };
  }
  return { profile, denied: null };
}

export async function GET(request: Request) {
  const { profile, denied } = await assertOwner(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const ownedOnly = url.searchParams.get("owned") === "1";
  const db = createServiceSupabaseClient();

  if (ownedOnly) {
    if (!profile || !db) {
      return NextResponse.json({ numbers: [], defaultPhoneNumber: null });
    }
    const numbers = await listOrgPhoneNumbers(db, profile.orgId);
    const defaultPhoneNumber =
      numbers.find((row) => row.isDefault)?.phoneNumber || numbers[0]?.phoneNumber || null;
    return NextResponse.json({ numbers, defaultPhoneNumber });
  }

  if (!hasTwilioAccount()) {
    return NextResponse.json({
      configured: false,
      numbers: [],
      error: "Number search isn’t available yet.",
    });
  }
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

const defaultSchema = z.object({
  phoneNumber: z.string().refine((value) => isE164(value), "Choose a number this workspace owns."),
  isDefault: z.literal(true),
});

export async function POST(request: Request) {
  const { profile, denied } = await assertOwner(request);
  if (denied) return denied;
  if (profile && workspaceBlocked(profile)) {
    return NextResponse.json({ error: "Update billing before buying a number." }, { status: 402 });
  }
  const db = createServiceSupabaseClient();
  const json = await request.json().catch(() => null);
  const parsed = buySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a number from the list." }, { status: 400 });
  }

  if (profile && db) {
    const current = await listOrgPhoneNumbers(db, profile.orgId);
    if (current.length >= MAX_ORG_PHONE_NUMBERS) {
      return NextResponse.json(
        { error: `Each workspace can hold up to ${MAX_ORG_PHONE_NUMBERS} numbers.` },
        { status: 409 },
      );
    }
    if (current.some((row) => row.phoneNumber === parsed.data.phoneNumber)) {
      return NextResponse.json(
        { error: "This workspace already owns that number." },
        { status: 409 },
      );
    }
  }

  try {
    const purchased = await buyNumber(parsed.data.phoneNumber);
    let numbers =
      profile && db
        ? await addOrgPhoneNumber(db, {
            orgId: profile.orgId,
            phoneNumber: purchased.phoneNumber,
            twilioSid: purchased.sid,
          })
        : [
            {
              id: "local",
              phoneNumber: purchased.phoneNumber,
              label: "",
              isDefault: true,
            },
          ];
    const defaultPhoneNumber =
      numbers.find((row) => row.isDefault)?.phoneNumber || purchased.phoneNumber;
    return NextResponse.json({
      ok: true,
      phoneNumber: purchased.phoneNumber,
      defaultPhoneNumber,
      numbers,
    });
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Could not buy that number.";
    const status = /already|up to \d+ numbers/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  const { profile, denied } = await assertOwner(request);
  if (denied) return denied;
  const db = createServiceSupabaseClient();
  if (!profile || !db) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const json = await request.json().catch(() => null);
  const parsed = defaultSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a number this workspace owns." }, { status: 400 });
  }
  try {
    const numbers = await setDefaultOrgPhoneNumber(db, profile.orgId, parsed.data.phoneNumber);
    return NextResponse.json({
      ok: true,
      phoneNumber: parsed.data.phoneNumber,
      defaultPhoneNumber: parsed.data.phoneNumber,
      numbers,
    });
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Could not update the default number.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
