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
import { BookConflictError } from "@/lib/books/conflict";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

type ServiceClient = NonNullable<ReturnType<typeof createServiceSupabaseClient>>;

export type LettingsBookSnap = { book: LettingsBook; updatedAt: string };

const TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,80}$/;
const CAS_RETRIES = 3;

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

export async function loadHostedLettingsBookSnap(
  orgId: string,
): Promise<LettingsBookSnap | null> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("lettings_books")
    .select("data, updated_at")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const empty = asBook(null);
    return saveHostedLettingsBook(orgId, empty, { expectedUpdatedAt: null });
  }
  return { book: asBook(data.data), updatedAt: String(data.updated_at) };
}

export async function loadHostedLettingsBook(orgId: string): Promise<LettingsBook | null> {
  const snap = await loadHostedLettingsBookSnap(orgId);
  return snap?.book ?? null;
}

export async function saveHostedLettingsBook(
  orgId: string,
  book: LettingsBook,
  options?: { expectedUpdatedAt?: string | null },
): Promise<LettingsBookSnap> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) throw new Error("Hosted mode required");
  const next = asBook(book);
  for (const property of next.properties) {
    if (!TOKEN_RE.test(property.reportToken.trim())) {
      throw new Error("Every property needs a repair link made of letters, numbers, dots, dashes or underscores.");
    }
  }
  const now = new Date().toISOString();
  const expected = options?.expectedUpdatedAt;

  if (expected === null || expected === undefined) {
    if (expected === null) {
      const { data, error } = await supabase
        .from("lettings_books")
        .insert({
          org_id: orgId,
          data: next,
          updated_at: now,
        })
        .select("updated_at")
        .maybeSingle();
      if (error) {
        if (error.code === "23505") throw new BookConflictError();
        throw error;
      }
      await syncLettingsIndexes(supabase, orgId, next);
      return { book: next, updatedAt: String(data?.updated_at || now) };
    }
    const { data, error } = await supabase
      .from("lettings_books")
      .upsert(
        {
          org_id: orgId,
          data: next,
          updated_at: now,
        },
        { onConflict: "org_id" },
      )
      .select("updated_at")
      .maybeSingle();
    if (error) throw error;
    await syncLettingsIndexes(supabase, orgId, next);
    return { book: next, updatedAt: String(data?.updated_at || now) };
  }

  const { data, error } = await supabase
    .from("lettings_books")
    .update({
      data: next,
      updated_at: now,
    })
    .eq("org_id", orgId)
    .eq("updated_at", expected)
    .select("updated_at")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new BookConflictError();
  await syncLettingsIndexes(supabase, orgId, next);
  return { book: next, updatedAt: String(data.updated_at) };
}

async function mutateLettingsBook(
  orgId: string,
  mutator: (book: LettingsBook) => LettingsBook,
): Promise<LettingsBookSnap> {
  let lastError: unknown;
  for (let attempt = 0; attempt < CAS_RETRIES; attempt++) {
    const snap = await loadHostedLettingsBookSnap(orgId);
    if (!snap) throw new Error("Hosted mode required");
    try {
      return await saveHostedLettingsBook(orgId, mutator(snap.book), {
        expectedUpdatedAt: snap.updatedAt,
      });
    } catch (err) {
      if (err instanceof BookConflictError) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new BookConflictError();
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
  let created: Repair | null = null;
  await mutateLettingsBook(located.orgId, (book) => {
    const property =
      book.properties.find((item) => item.id === located.property.id) ||
      book.properties.find((item) => item.reportToken === input.token.trim());
    const nextRoom =
      property?.rooms.find((item) => item.id === input.roomId) ?? property?.rooms[0];
    if (!property || !nextRoom) throw new Error("Choose a room.");
    const repair = createRepair(book, {
      propertyId: property.id,
      roomId: nextRoom.id,
      body: input.body,
      channel: input.channel,
      photo: input.photo,
    });
    created = repair;
    return { ...book, repairs: [repair, ...book.repairs] };
  });
  if (!created) throw new Error("Could not save that repair.");
  return created;
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
  await mutateLettingsBook(String(data.org_id), (book) => {
    const before = book.repairs.find((item) => item.reference.toUpperCase() === reference);
    const next = tryConfirmRepair(book, reference, input.tenantName, new Date().toISOString());
    const after = next.repairs.find((item) => item.reference.toUpperCase() === reference);
    if (!before || before.status === after?.status) {
      throw new Error("That repair cannot be confirmed yet.");
    }
    return next;
  });
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
  await mutateLettingsBook(String(data.org_id), (book) =>
    trySignInspection(
      book,
      input.inspectionId,
      input.tenantName,
      new Date().toISOString(),
    ),
  );
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
