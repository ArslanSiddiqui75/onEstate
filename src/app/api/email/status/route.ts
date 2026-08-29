import { NextResponse } from "next/server";
import { getEmailCapabilities } from "@/lib/email/capabilities";

export async function GET() {
  const caps = getEmailCapabilities();
  return NextResponse.json({
    mode: caps.mode,
    outbound: caps.outbound,
    resendConfigured: caps.resendConfigured,
  });
}
