import { NextResponse } from "next/server";
import {
  agencyHostedAvailable,
  hostedApproval,
  hostedBooking,
  hostedOffer,
  hostedRegisterPortal,
} from "@/lib/agency/hosted";
import {
  fileServerApproval,
  fileServerBooking,
  fileServerOffer,
  fileServerPortal,
  readAgencyInbox,
} from "@/lib/agency/server-inbox";
import type { AppointmentKind } from "@/lib/agency/types";
import { appRedirectUrl } from "@/lib/http/same-origin";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { demoInboxEnabled } from "@/lib/server/demo-inbox";

function redirectTo(request: Request, path: string, query: Record<string, string>) {
  const url = appRedirectUrl(request, path);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return NextResponse.redirect(url, 303);
}

function hosted() {
  return agencyHostedAvailable();
}

function localDemo() {
  return demoInboxEnabled();
}

export async function GET(request: Request) {
  if (hosted()) {
    const profile = await resolveProfileFromRequest(request);
    if (!profile) {
      return NextResponse.json({ available: true, appointments: [], offers: [], approvals: [], portals: [] });
    }
    const { hostedInboxForOrg } = await import("@/lib/agency/hosted");
    try {
      const inbox = await hostedInboxForOrg(profile.orgId);
      return NextResponse.json({ available: true, ...inbox });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Could not load the office inbox" },
        { status: 502 },
      );
    }
  }
  if (!localDemo()) {
    return NextResponse.json({ available: false, appointments: [], offers: [], approvals: [], portals: [] });
  }
  return NextResponse.json({ available: true, ...readAgencyInbox() });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const formPost = !contentType.includes("application/json");
  let raw: Record<string, unknown> = {};
  try {
    raw = formPost
      ? Object.fromEntries(await request.formData())
      : ((await request.json()) as Record<string, unknown>);
  } catch {
    return formPost
      ? redirectTo(request, "/book/harbour", { error: "error" })
      : NextResponse.json({ error: "Could not read that request." }, { status: 400 });
  }

  const action = String(raw.action || "book");
  const token = String(raw.token || raw.bookToken || "harbour");
  const useHosted = hosted();
  if (!useHosted && !localDemo()) {
    if (formPost) {
      const path = action === "book" ? `/book/${encodeURIComponent(token)}` : `/portal/${encodeURIComponent(token)}`;
      return redirectTo(request, path, { error: "unavailable" });
    }
    return NextResponse.json({ error: "The office can't receive this yet." }, { status: 503 });
  }

  try {
    if (action === "register") {
      if (useHosted) {
        const profile = await resolveProfileFromRequest(request);
        if (!profile) {
          return NextResponse.json({ error: "Sign in required" }, { status: 401 });
        }
        const portal = await hostedRegisterPortal({
          orgId: profile.orgId,
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
      const offer = useHosted
        ? await hostedOffer({
            token,
            buyerName: String(raw.buyerName || raw.clientName || ""),
            amount: Number(raw.amount),
            notes: String(raw.notes || ""),
          })
        : fileServerOffer({
            token,
            buyerName: String(raw.buyerName || raw.clientName || ""),
            amount: Number(raw.amount),
            notes: String(raw.notes || ""),
          });
      if (formPost) return redirectTo(request, `/portal/${encodeURIComponent(token)}`, { done: "offer", ref: offer.id });
      return NextResponse.json({ offer });
    }

    if (action === "approve") {
      if (useHosted) await hostedApproval(token, String(raw.feedback || ""));
      else fileServerApproval(token, String(raw.feedback || ""));
      if (formPost) return redirectTo(request, `/portal/${encodeURIComponent(token)}`, { done: "approved" });
      return NextResponse.json({ ok: true });
    }

    const kind = String(raw.kind) === "valuation" ? "valuation" : "viewing";
    const appointment = useHosted
      ? await hostedBooking({
          bookToken: token,
          kind: kind as AppointmentKind,
          at: String(raw.at || ""),
          clientName: String(raw.clientName || ""),
          email: String(raw.email || ""),
          phone: String(raw.phone || ""),
          address: String(raw.address || ""),
          notes: String(raw.notes || ""),
        })
      : fileServerBooking({
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
