import type { SupabaseClient } from "@supabase/supabase-js";
import { isE164 } from "@/lib/phone/e164";
import { normalizePhoneNumber } from "@/lib/utils";

/** Soft cap so one workspace cannot exhaust the shared Twilio inventory. */
export const MAX_ORG_PHONE_NUMBERS = 10;

function lookupVariants(raw: string): string[] {
  const normalized = normalizePhoneNumber(raw);
  if (!normalized) return [];
  const digits = normalized.replace(/\D/g, "");
  const variants = new Set<string>([normalized]);
  if (digits) {
    variants.add(digits);
    variants.add(`+${digits}`);
  }
  return [...variants];
}

export interface OrgPhoneNumber {
  id: string;
  phoneNumber: string;
  label: string;
  isDefault: boolean;
  createdAt?: string;
}

export function mapOrgPhoneRow(row: Record<string, unknown>): OrgPhoneNumber {
  return {
    id: String(row.id),
    phoneNumber: String(row.phone_number),
    label: String(row.label || ""),
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

export async function listOrgPhoneNumbers(
  supabase: SupabaseClient,
  orgId: string,
): Promise<OrgPhoneNumber[]> {
  const { data, error } = await supabase
    .from("organization_phone_numbers")
    .select("id, phone_number, label, is_default, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => mapOrgPhoneRow(row as Record<string, unknown>));
}

/** Default sender: flagged row, else organizations.phone_number, else first owned. */
export async function resolveDefaultFromNumber(
  supabase: SupabaseClient,
  orgId: string,
): Promise<string> {
  const { data: preferred } = await supabase
    .from("organization_phone_numbers")
    .select("phone_number")
    .eq("org_id", orgId)
    .eq("is_default", true)
    .maybeSingle();
  if (preferred?.phone_number) return String(preferred.phone_number).trim();

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("phone_number")
    .eq("id", orgId)
    .maybeSingle();
  const legacy = String(orgRow?.phone_number || "").trim();
  if (legacy) return legacy;

  const { data: first } = await supabase
    .from("organization_phone_numbers")
    .select("phone_number")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return String(first?.phone_number || "").trim();
}

/** True when this E.164 (or a lookup variant) belongs to the workspace. */
export async function orgOwnsPhoneNumber(
  supabase: SupabaseClient,
  orgId: string,
  raw: string,
): Promise<boolean> {
  const variants = lookupVariants(raw);
  if (!variants.length) return false;

  const { data: owned } = await supabase
    .from("organization_phone_numbers")
    .select("phone_number")
    .eq("org_id", orgId)
    .in("phone_number", variants);
  if ((owned || []).length > 0) return true;

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("phone_number")
    .eq("id", orgId)
    .maybeSingle();
  const legacy = String(orgRow?.phone_number || "").trim();
  if (!legacy) return false;
  return lookupVariants(legacy).some((v) => variants.includes(v));
}

/**
 * Pick the From number for an outbound SMS.
 * Client-supplied numbers must be owned by the org; otherwise use the default.
 */
export async function resolveOutboundFromNumber(
  supabase: SupabaseClient,
  orgId: string,
  requested?: string | null,
): Promise<string> {
  const want = String(requested || "").trim();
  if (want && isE164(want) && (await orgOwnsPhoneNumber(supabase, orgId, want))) {
    return want;
  }
  return resolveDefaultFromNumber(supabase, orgId);
}

export async function syncOrgDefaultPhoneColumn(
  supabase: SupabaseClient,
  orgId: string,
  phoneNumber: string | null,
): Promise<void> {
  await supabase
    .from("organizations")
    .update({ phone_number: phoneNumber || null })
    .eq("id", orgId);
}

export async function setDefaultOrgPhoneNumber(
  supabase: SupabaseClient,
  orgId: string,
  phoneNumber: string,
): Promise<OrgPhoneNumber[]> {
  if (!isE164(phoneNumber)) {
    throw new Error("Choose a number this workspace owns.");
  }
  const owns = await orgOwnsPhoneNumber(supabase, orgId, phoneNumber);
  if (!owns) throw new Error("That number does not belong to this workspace.");

  await supabase
    .from("organization_phone_numbers")
    .update({ is_default: false })
    .eq("org_id", orgId)
    .eq("is_default", true);

  const { error } = await supabase
    .from("organization_phone_numbers")
    .update({ is_default: true })
    .eq("org_id", orgId)
    .eq("phone_number", phoneNumber);
  if (error) throw error;

  await syncOrgDefaultPhoneColumn(supabase, orgId, phoneNumber);
  return listOrgPhoneNumbers(supabase, orgId);
}

export async function addOrgPhoneNumber(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    phoneNumber: string;
    twilioSid?: string | null;
    makeDefault?: boolean;
  },
): Promise<OrgPhoneNumber[]> {
  if (!isE164(input.phoneNumber)) {
    throw new Error("Choose a number from the list.");
  }

  const existing = await listOrgPhoneNumbers(supabase, input.orgId);
  if (existing.some((row) => row.phoneNumber === input.phoneNumber)) {
    throw new Error("This workspace already owns that number.");
  }
  if (existing.length >= MAX_ORG_PHONE_NUMBERS) {
    throw new Error(`Each workspace can hold up to ${MAX_ORG_PHONE_NUMBERS} numbers.`);
  }

  const makeDefault = input.makeDefault ?? existing.length === 0;
  if (makeDefault) {
    await supabase
      .from("organization_phone_numbers")
      .update({ is_default: false })
      .eq("org_id", input.orgId)
      .eq("is_default", true);
  }

  const { error } = await supabase.from("organization_phone_numbers").insert({
    org_id: input.orgId,
    phone_number: input.phoneNumber,
    is_default: makeDefault,
    twilio_sid: input.twilioSid || null,
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error("That number is already assigned to another workspace.");
    }
    throw error;
  }

  if (makeDefault) {
    await syncOrgDefaultPhoneColumn(supabase, input.orgId, input.phoneNumber);
  }

  return listOrgPhoneNumbers(supabase, input.orgId);
}
