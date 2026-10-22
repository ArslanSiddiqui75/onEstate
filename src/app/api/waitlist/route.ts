import { z } from "zod";
import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  brokerage: z.string().max(200).optional().nullable(),
  market: z.enum(["uk", "us"]),
  brand: z.enum(["onestreet-uk", "onestreet-us", "certified-uk", "certified-us"]).optional(),
});

const demoRequests: z.infer<typeof schema>[] = [];

function formRedirect(request: Request, demo: "received" | "invalid" | "error") {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const url = host ? new URL(`${proto}://${host}/`) : new URL("/", request.url);
  url.searchParams.set("demo", demo);
  url.hash = "contact";
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    const formPost = !contentType.includes("application/json");
    const body = formPost
      ? Object.fromEntries(await request.formData())
      : await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      if (formPost) {
        return formRedirect(request, "invalid");
      }
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
        if (formPost) return formRedirect(request, "error");
        return NextResponse.json(
          { error: "Could not save your request. Try again shortly." },
          { status: 500 },
        );
      }
      const { count } = await supabase
        .from("waitlist_submissions")
        .select("id", { count: "exact", head: true });
      if (formPost) return formRedirect(request, "received");
      return NextResponse.json({
        message: "Demo request received. Our team will reach out shortly.",
        count: count ?? 0,
      });
    }

    demoRequests.push(parsed.data);
    if (formPost) return formRedirect(request, "received");
    return NextResponse.json({
      message: "Demo request received. Our team will reach out shortly.",
      count: demoRequests.length,
    });
  } catch {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return formRedirect(request, "error");
    }
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
