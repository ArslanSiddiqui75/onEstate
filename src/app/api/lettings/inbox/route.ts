import { NextResponse } from "next/server";
import { readServerInbox } from "@/lib/lettings/server-inbox";

export async function GET() {
  return NextResponse.json(readServerInbox());
}
