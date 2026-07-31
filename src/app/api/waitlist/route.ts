import { z } from "zod";
import { NextResponse } from "next/server";

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
  return NextResponse.json({ count: demoRequests.length });
}
