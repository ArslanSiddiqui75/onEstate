import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { getEsignCapabilities } from "@/lib/esign/capabilities";
import { sendResendEmail } from "@/lib/email/client";

export type EsignDocStatus = "draft" | "sent" | "signed" | "voided";

export interface TransactionEsignDocument {
  id: string;
  dealId: string;
  orgId: string;
  name: string;
  status: EsignDocStatus;
  signerName?: string;
  signerEmail?: string;
  signToken?: string;
  summary?: string;
  provider?: string;
  sentAt?: string;
  signedAt?: string;
  createdAt: string;
}

function appUrl() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL ||
    "http://localhost:3000";
  const trimmed = raw.replace(/\/$/, "");
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

function newToken() {
  return randomBytes(24).toString("hex");
}

function mapDoc(row: Record<string, unknown>): TransactionEsignDocument {
  return {
    id: String(row.id),
    dealId: String(row.transaction_id),
    orgId: String(row.org_id),
    name: String(row.name),
    status: (row.status as EsignDocStatus) || "draft",
    signerName: row.signer_name ? String(row.signer_name) : undefined,
    signerEmail: row.signer_email ? String(row.signer_email) : undefined,
    signToken: row.sign_token ? String(row.sign_token) : undefined,
    summary: row.summary ? String(row.summary) : undefined,
    provider: row.provider ? String(row.provider) : undefined,
    sentAt: row.sent_at ? String(row.sent_at) : undefined,
    signedAt: row.signed_at ? String(row.signed_at) : undefined,
    createdAt: String(row.created_at),
  };
}

export async function listEsignDocuments(
  supabase: SupabaseClient,
  input: { orgId: string; dealId: string },
): Promise<TransactionEsignDocument[]> {
  const { data, error } = await supabase
    .from("transaction_documents")
    .select("*")
    .eq("org_id", input.orgId)
    .eq("transaction_id", input.dealId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((row) => mapDoc(row as Record<string, unknown>));
}

export async function requestEsign(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    dealId: string;
    documentName: string;
    signerName: string;
    signerEmail: string;
    summary?: string;
  },
): Promise<{
  ok: boolean;
  document?: TransactionEsignDocument;
  signUrl?: string;
  mode?: "live" | "simulated";
  emailed?: boolean;
  error?: string;
}> {
  const caps = getEsignCapabilities();
  const name = input.documentName.trim() || "Sale contract";
  const signerName = input.signerName.trim();
  const signerEmail = input.signerEmail.trim().toLowerCase();
  if (!signerName) return { ok: false, error: "Signer name is required" };
  if (!signerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail)) {
    return { ok: false, error: "Signer email is invalid" };
  }

  const { data: deal } = await supabase
    .from("transactions")
    .select("id, listing_title, e_sign_status")
    .eq("id", input.dealId)
    .eq("org_id", input.orgId)
    .maybeSingle();
  if (!deal) return { ok: false, error: "Deal not found" };

  const token = newToken();
  const sentAt = new Date().toISOString();
  const summary =
    input.summary?.trim() ||
    `Please review and sign the documents for ${deal.listing_title}.`;

  // Live Dropbox Sign can plug in later behind the same interface.
  const provider = caps.provider === "dropbox_sign" ? "dropbox_sign" : "simulated";

  const { data: created, error } = await supabase
    .from("transaction_documents")
    .insert({
      org_id: input.orgId,
      transaction_id: input.dealId,
      name,
      provider,
      status: "sent",
      signer_name: signerName,
      signer_email: signerEmail,
      sign_token: token,
      summary,
      sent_at: sentAt,
      external_id: provider === "simulated" ? `sim_${token.slice(0, 12)}` : null,
    })
    .select("*")
    .single();
  if (error || !created) {
    return { ok: false, error: error?.message || "Failed to create document" };
  }

  await supabase
    .from("transactions")
    .update({
      e_sign_status: "sent",
      updated_at: sentAt,
    })
    .eq("id", input.dealId)
    .eq("org_id", input.orgId);

  const signUrl = `${appUrl()}/sign/${token}`;
  let emailed = false;
  if (caps.canEmailInvite) {
    try {
      await sendResendEmail({
        to: signerEmail,
        subject: `Signature requested: ${name}`,
        body: `Hi ${signerName},\n\n${summary}\n\nSign here:\n${signUrl}\n\n— 0nEstate`,
      });
      emailed = true;
    } catch {
      emailed = false;
    }
  }

  return {
    ok: true,
    document: mapDoc(created as Record<string, unknown>),
    signUrl,
    mode: caps.mode,
    emailed,
  };
}

export async function getEsignByToken(
  supabase: SupabaseClient,
  token: string,
): Promise<
  | (TransactionEsignDocument & { listingTitle: string; dealStatus: string })
  | null
> {
  const { data } = await supabase
    .from("transaction_documents")
    .select("*")
    .eq("sign_token", token)
    .maybeSingle();
  if (!data) return null;
  const doc = mapDoc(data as Record<string, unknown>);
  const { data: tx } = await supabase
    .from("transactions")
    .select("listing_title, e_sign_status")
    .eq("id", doc.dealId)
    .maybeSingle();
  return {
    ...doc,
    listingTitle: String(tx?.listing_title || "Transaction"),
    dealStatus: String(tx?.e_sign_status || "not_started"),
  };
}

export async function completeEsignByToken(
  supabase: SupabaseClient,
  token: string,
): Promise<{ ok: boolean; error?: string; document?: TransactionEsignDocument }> {
  const current = await getEsignByToken(supabase, token);
  if (!current) return { ok: false, error: "Signature request not found" };
  if (current.status === "voided") {
    return { ok: false, error: "This request was voided" };
  }
  if (current.status === "signed") {
    return { ok: true, document: current };
  }

  const signedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("transaction_documents")
    .update({ status: "signed", signed_at: signedAt })
    .eq("id", current.id)
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message || "Failed to mark signed" };
  }

  await supabase
    .from("transactions")
    .update({ e_sign_status: "signed", updated_at: signedAt })
    .eq("id", current.dealId)
    .eq("org_id", current.orgId);

  // Mark the first unfinished e-sign checklist item done when present.
  const { data: items } = await supabase
    .from("transaction_checklist_items")
    .select("id, label, done")
    .eq("transaction_id", current.dealId)
    .eq("org_id", current.orgId)
    .eq("done", false);
  const esignItem = (items || []).find((item) =>
    /e-?sign/i.test(String(item.label || "")),
  );
  if (esignItem) {
    await supabase
      .from("transaction_checklist_items")
      .update({ done: true })
      .eq("id", esignItem.id);
  }

  return { ok: true, document: mapDoc(data as Record<string, unknown>) };
}

export async function voidEsignDocument(
  supabase: SupabaseClient,
  input: { orgId: string; dealId: string; documentId: string },
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase
    .from("transaction_documents")
    .update({ status: "voided" })
    .eq("id", input.documentId)
    .eq("org_id", input.orgId)
    .eq("transaction_id", input.dealId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Document not found" };

  const { data: open } = await supabase
    .from("transaction_documents")
    .select("id")
    .eq("org_id", input.orgId)
    .eq("transaction_id", input.dealId)
    .eq("status", "sent")
    .limit(1);
  if (!open?.length) {
    await supabase
      .from("transactions")
      .update({
        e_sign_status: "voided",
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.dealId)
      .eq("org_id", input.orgId);
  }
  return { ok: true };
}
