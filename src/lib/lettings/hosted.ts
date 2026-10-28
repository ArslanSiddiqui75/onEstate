import {
  createRepair,
  emptyInbox,
  seedBook,
  tryConfirmRepair,
  trySignInspection,
  withLettingsDefaults,
} from "@/lib/lettings/book";
import type {
  LettingsBook,
  LettingsInbox,
  Property,
  Repair,
  RepairChannel,
} from "@/lib/lettings/types";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

type ServiceClient = NonNullable<ReturnType<typeof createServiceSupabaseClient>>;

const TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,80}$/;

function asBook(raw: unknown): LettingsBook {
  if (!raw || typeof raw !== "object") {
    return withLettingsDefaults({
      version: 1,
      properties: [],
      repairs: [],
      compliance: [],
      inspections: [],
      contractors: [],
      keys: [],
    });
  }
  const value = raw as Partial<LettingsBook>;
  return withLettingsDefaults({
    version: 1,
    properties: Array.isArray(value.properties) ? value.properties : [],
    repairs: Array.isArray(value.repairs) ? value.repairs : [],
    compliance: Array.isArray(value.compliance) ? value.compliance : [],
    inspections: Array.isArray(value.inspections) ? value.inspections : [],
    contractors: Array.isArray(value.contractors) ? value.contractors : [],
    keys: Array.isArray(value.keys) ? value.keys : [],
  });
}

export function lettingsHostedAvailable() {
  return Boolean(createServiceSupabaseClient());
}

async function syncLettingsIndexes(
  supabase: ServiceClient,
  orgId: string,
  book: LettingsBook,
) {
  await supabase.from("lettings_report_tokens").delete().eq("org_id", orgId);
  await supabase.from("lettings_repair_refs").delete().eq("org_id", orgId);
  await supabase.from("lettings_inspection_refs").delete().eq("org_id", orgId);

  const tokens = book.properties
    .map((property) => ({
      token: property.reportToken.trim(),
      org_id: orgId,
      property_id: property.id,
    }))
    .filter((row) => TOKEN_RE.test(row.token));
  if (tokens.length) {
    const { error } = await supabase.from("lettings_report_tokens").insert(tokens);
    if (error) {
      if (error.code === "23505") {
        throw new Error("A repair link is already in use by another office.");
      }
      throw error;
    }
  }

  const refs = book.repairs
    .map((repair) => ({
      reference: repair.reference.trim().toUpperCase(),
      org_id: orgId,
      repair_id: repair.id,
    }))
    .filter((row) => row.reference);
  if (refs.length) {
    const { error } = await supabase.from("lettings_repair_refs").insert(refs);
    if (error) {
      if (error.code === "23505") {
        throw new Error("A repair reference collided with another office. Try again.");
      }
      throw error;
    }
  }

  const inspections = book.inspections.map((item) => ({
    inspection_id: item.id,
    org_id: orgId,
  }));
  if (inspections.length) {
    const { error } = await supabase.from("lettings_inspection_refs").insert(inspections);
    if (error) throw error;
  }
}

export async function loadHostedLettingsBook(orgId: string): Promise<LettingsBook | null> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("lettings_books")
    .select("data")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const empty = asBook(null);
    await saveHostedLettingsBook(orgId, empty);
    return empty;
  }
  return asBook(data.data);
}

export async function saveHostedLettingsBook(
  orgId: string,
  book: LettingsBook,
): Promise<LettingsBook> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) throw new Error("Hosted mode required");
  const next = asBook(book);
  for (const property of next.properties) {
    if (!TOKEN_RE.test(property.reportToken.trim())) {
      throw new Error("Every property needs a repair link made of letters, numbers, dots, dashes or underscores.");
    }
  }
  const { error } = await supabase.from("lettings_books").upsert(
    {
      org_id: orgId,
      data: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id" },
  );
  if (error) throw error;
  await syncLettingsIndexes(supabase, orgId, next);
  return next;
}

export async function hostedPropertyByReportToken(
  token: string,
): Promise<{ orgId: string; book: LettingsBook; property: Property } | null> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) return null;
  const key = token.trim();
  const { data } = await supabase
    .from("lettings_report_tokens")
    .select("org_id, property_id")
    .eq("token", key)
    .maybeSingle();
  if (!data?.org_id) return null;
  const book = await loadHostedLettingsBook(String(data.org_id));
  if (!book) return null;
  const property = book.properties.find((item) => item.id === data.property_id)
    || book.properties.find((item) => item.reportToken === key);
  if (!property) return null;
  return { orgId: String(data.org_id), book, property };
}

export async function hostedInboxForOrg(orgId: string): Promise<LettingsInbox> {
  const book = await loadHostedLettingsBook(orgId);
  if (!book) return emptyInbox();
  return {
    repairs: book.repairs,
    confirmations: [],
    inspectionSigns: book.inspections
      .filter((item) => item.signedOffAt)
      .map((item) => ({
        inspectionId: item.id,
        at: item.signedOffAt!,
        tenantName: item.signedOffBy || "Tenant",
      })),
  };
}

export async function hostedReport(input: {
  token: string;
  roomId?: string;
  body: string;
  channel: RepairChannel;
  photo?: { name: string; dataUrl?: string };
}): Promise<Repair> {
  const located = await hostedPropertyByReportToken(input.token);
  if (!located) throw new Error("This repair link is not recognised.");
  const room =
    located.property.rooms.find((item) => item.id === input.roomId) ??
    located.property.rooms[0];
  if (!room) throw new Error("Choose a room.");
  const repair = createRepair(located.book, {
    propertyId: located.property.id,
    roomId: room.id,
    body: input.body,
    channel: input.channel,
    photo: input.photo,
  });
  await saveHostedLettingsBook(located.orgId, {
    ...located.book,
    repairs: [repair, ...located.book.repairs],
  });
  return repair;
}

export async function hostedConfirmation(input: {
  reference: string;
  tenantName: string;
}) {
  const reference = input.reference.trim().toUpperCase();
  if (!reference) throw new Error("Add the repair reference.");
  const supabase = createServiceSupabaseClient();
  if (!supabase) throw new Error("Hosted mode required");
  const { data } = await supabase
    .from("lettings_repair_refs")
    .select("org_id")
    .eq("reference", reference)
    .maybeSingle();
  if (!data?.org_id) throw new Error("That repair reference was not found.");
  const book = (await loadHostedLettingsBook(String(data.org_id)))!;
  const before = book.repairs.find((item) => item.reference.toUpperCase() === reference);
  const next = tryConfirmRepair(book, reference, input.tenantName, new Date().toISOString());
  const after = next.repairs.find((item) => item.reference.toUpperCase() === reference);
  if (!before || before.status === after?.status) {
    throw new Error("That repair cannot be confirmed yet.");
  }
  await saveHostedLettingsBook(String(data.org_id), next);
}

export async function hostedInspectionSign(input: {
  inspectionId: string;
  tenantName: string;
}) {
  if (!input.inspectionId) throw new Error("That inspection is not on this link.");
  const supabase = createServiceSupabaseClient();
  if (!supabase) throw new Error("Hosted mode required");
  const { data } = await supabase
    .from("lettings_inspection_refs")
    .select("org_id")
    .eq("inspection_id", input.inspectionId)
    .maybeSingle();
  if (!data?.org_id) throw new Error("That inspection is not on this link.");
  const book = (await loadHostedLettingsBook(String(data.org_id)))!;
  const next = trySignInspection(
    book,
    input.inspectionId,
    input.tenantName,
    new Date().toISOString(),
  );
  await saveHostedLettingsBook(String(data.org_id), next);
}

export async function hostedFindRepair(reference: string): Promise<Repair | null> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) return null;
  const key = reference.trim().toUpperCase();
  const { data } = await supabase
    .from("lettings_repair_refs")
    .select("org_id")
    .eq("reference", key)
    .maybeSingle();
  if (!data?.org_id) return null;
  const book = await loadHostedLettingsBook(String(data.org_id));
  return book?.repairs.find((item) => item.reference.toUpperCase() === key) ?? null;
}

/** Prefer seed data only when no hosted book exists (local demos). */
export function seedPropertyFallback(token: string): Property | null {
  return seedBook().properties.find((item) => item.reportToken === token) ?? null;
}
