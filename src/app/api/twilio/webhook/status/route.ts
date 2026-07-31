import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const sid = String(form?.get("MessageSid") || "");
  const status = String(form?.get("MessageStatus") || "");

  if (!sid) {
    return NextResponse.json({ error: "Missing MessageSid" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  if (supabase && status) {
    const mapped =
      status === "delivered"
        ? "delivered"
        : status === "failed" || status === "undelivered"
          ? "failed"
          : status === "sent"
            ? "sent"
            : "queued";
    await supabase
      .from("messages")
      .update({ status: mapped })
      .eq("provider_sid", sid);
  }

  return NextResponse.json({ ok: true });
}
