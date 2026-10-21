import { NextResponse } from "next/server";
import { getMessagingCapabilities } from "@/lib/messaging/capabilities";

export async function GET() {
  const caps = getMessagingCapabilities();
  return NextResponse.json(caps);
}
