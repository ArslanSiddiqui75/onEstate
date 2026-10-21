import { z } from "zod";
import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  brokerage: z.string().max(200).optional().nullable(),
  market: z.enum(["uk", "us"]),
  brand: z.enum(["certified-uk", "certified-us"]).optional(),
});

const demoRequests: z.infer<typeof schema>[] = [];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please provide a valid name and email." },
        { status: 400 },
      );
    }

    const supabase = createServiceSupabaseClient();
    if (supabase) {
      const { error } = await supabase.from("waitlist_submissions").insert({
        name: parsed.data.name.trim(),
        email: parsed.data.email.trim().toLowerCase(),
        brokerage: parsed.data.brokerage?.trim() || null,
        market: parsed.data.market,
        brand: parsed.data.brand || null,
      });
      if (error) {
        console.error("[waitlist] supabase insert failed", error);
        return NextResponse.json(
          { error: "Could not save your request. Try again shortly." },
          { status: 500 },
        );
      }
      const { count } = await supabase
        .from("waitlist_submissions")
        .select("id", { count: "exact", head: true });
      return NextResponse.json({
        message: "Demo request received. Our team will reach out shortly.",
        count: count ?? 0,
      });
    }

    demoRequests.push(parsed.data);
    console.info("[demo-request]", parsed.data);

    return NextResponse.json({
      message: "Demo request received. Our team will reach out shortly.",
      count: demoRequests.length,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}

export async function GET() {
  const supabase = createServiceSupabaseClient();
  if (supabase) {
    const { count } = await supabase
      .from("waitlist_submissions")
      .select("id", { count: "exact", head: true });
    return NextResponse.json({ count: count ?? 0 });
  }
  return NextResponse.json({ count: demoRequests.length });
}
