import { NextResponse } from "next/server";
import { appRedirectUrl } from "@/lib/http/same-origin";
import {
  fileServerConfirmation,
  fileServerInspectionSign,
  fileServerReport,
} from "@/lib/lettings/server-inbox";
import type { RepairChannel } from "@/lib/lettings/types";

function redirectTo(request: Request, token: string, query: Record<string, string>) {
  const url = appRedirectUrl(request, `/report/${encodeURIComponent(token)}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return NextResponse.redirect(url, 303);
}

function asChannel(value: unknown): RepairChannel {
  if (value === "qr" || value === "text" || value === "whatsapp" || value === "link") return value;
  return "link";
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const formPost = !contentType.includes("application/json");
  let raw: Record<string, unknown> = {};
  try {
    raw = formPost ? Object.fromEntries(await request.formData()) : ((await request.json()) as Record<string, unknown>);
  } catch {
    if (formPost) return redirectTo(request, "unknown", { error: "error" });
    return NextResponse.json({ error: "Could not read that report." }, { status: 400 });
  }

  const token = String(raw.token || "");
  const action = String(raw.action || "report");
  try {
    if (!token) throw new Error("This repair link is not recognised.");
    if (action === "confirm") {
      fileServerConfirmation({
        reference: String(raw.reference || ""),
        tenantName: String(raw.tenantName || "Tenant"),
      });
      if (formPost) return redirectTo(request, token, { noted: "confirmed" });
      return NextResponse.json({ ok: true });
    }
    if (action === "sign") {
      fileServerInspectionSign({
        inspectionId: String(raw.inspectionId || ""),
        tenantName: String(raw.tenantName || "Tenant"),
      });
      if (formPost) return redirectTo(request, token, { noted: "signed" });
      return NextResponse.json({ ok: true });
    }
    const photoFile = raw.photo instanceof File ? raw.photo : null;
    const photoName = photoFile?.name || String(raw.photoName || "");
    const repair = fileServerReport({
      token,
      roomId: String(raw.roomId || ""),
      body: String(raw.body || ""),
      channel: asChannel(raw.channel),
      photo: photoName
        ? { name: photoName, dataUrl: typeof raw.photoData === "string" ? raw.photoData : undefined }
        : undefined,
    });
    if (formPost) return redirectTo(request, token, { sent: repair.reference });
    return NextResponse.json({ repair });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not send that report.";
    if (formPost) {
      const code = message.includes("sentence") ? "short" : message.includes("recognised") ? "unknown" : "error";
      return redirectTo(request, token || "unknown", { error: code });
    }
    return NextResponse.json({ error: message }, { status: message.includes("recognised") ? 404 : 400 });
  }
}
