import { NextResponse } from "next/server";
import { readServerInbox } from "@/lib/lettings/server-inbox";
import { demoInboxEnabled, demoInboxJson } from "@/lib/server/demo-inbox";

export async function GET() {
  if (!demoInboxEnabled()) {
    return NextResponse.json({ available: false, repairs: [], confirmations: [], inspectionSigns: [] });
  }
  return demoInboxJson(readServerInbox());
}
