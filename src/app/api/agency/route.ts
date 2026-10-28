import { NextResponse } from "next/server";
import { fileServerApproval, fileServerBooking, fileServerOffer, fileServerPortal, readAgencyInbox } from "@/lib/agency/server-inbox";
import { appRedirectUrl } from "@/lib/http/same-origin";
import { demoInboxEnabled, demoInboxJson } from "@/lib/server/demo-inbox";
import type { AppointmentKind } from "@/lib/agency/types";

function redirectTo(request: Request, path: string, query: Record<string, string>) {
  const url = appRedirectUrl(request, path);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return NextResponse.redirect(url, 303);
}

export async function GET() {
  if (!demoInboxEnabled()) {
    return NextResponse.json({ available: false, appointments: [], offers: [], approvals: [], portals: [] });
  }
  return demoInboxJson(readAgencyInbox());
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const formPost = !contentType.includes("application/json");
  let raw: Record<string, unknown> = {};
  try {
    raw = formPost ? Object.fromEntries(await request.formData()) : ((await request.json()) as Record<string, unknown>);
  } catch {
    return formPost
      ? redirectTo(request, "/book/harbour", { error: "error" })
      : NextResponse.json({ error: "Could not read that request." }, { status: 400 });
  }
  const action = String(raw.action || "book");
  const token = String(raw.token || raw.bookToken || "harbour");
  if (!demoInboxEnabled()) {
    if (formPost) {
      const path = action === "book" ? `/book/${encodeURIComponent(token)}` : `/portal/${encodeURIComponent(token)}`;
      return redirectTo(request, path, { error: "unavailable" });
    }
    return NextResponse.json({ error: "The office can't receive this yet." }, { status: 503 });
  }
  try {
    if (action === "register") {
      const portal = fileServerPortal({
        token,
        role: String(raw.role || ""),
        name: String(raw.name || ""),
        address: String(raw.address || ""),
        listingId: String(raw.listingId || ""),
        leadId: String(raw.leadId || ""),
        lettingsToken: String(raw.lettingsToken || ""),
      });
      return NextResponse.json({ portal });
    }
    if (action === "offer") {
      const offer = fileServerOffer({
        token,
        buyerName: String(raw.buyerName || raw.clientName || ""),
        amount: Number(raw.amount),
        notes: String(raw.notes || ""),
      });
      if (formPost) return redirectTo(request, `/portal/${encodeURIComponent(token)}`, { done: "offer", ref: offer.id });
      return NextResponse.json({ offer });
    }
    if (action === "approve") {
      fileServerApproval(token, String(raw.feedback || ""));
      if (formPost) return redirectTo(request, `/portal/${encodeURIComponent(token)}`, { done: "approved" });
      return NextResponse.json({ ok: true });
    }
    const kind = String(raw.kind) === "valuation" ? "valuation" : "viewing";
    const appointment = fileServerBooking({
      bookToken: token,
      kind: kind as AppointmentKind,
      at: String(raw.at || ""),
      clientName: String(raw.clientName || ""),
      email: String(raw.email || ""),
      phone: String(raw.phone || ""),
      address: String(raw.address || ""),
      notes: String(raw.notes || ""),
    });
    if (formPost) return redirectTo(request, `/book/${encodeURIComponent(token)}`, { sent: appointment.id });
    return NextResponse.json({ appointment });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save that.";
    if (formPost) {
      const path = action === "book" ? `/book/${encodeURIComponent(token)}` : `/portal/${encodeURIComponent(token)}`;
      return redirectTo(request, path, { error: "invalid" });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
