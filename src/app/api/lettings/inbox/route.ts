import { NextResponse } from "next/server";
import {
  hostedInboxForOrg,
  lettingsHostedAvailable,
} from "@/lib/lettings/hosted";
import { readServerInbox } from "@/lib/lettings/server-inbox";
import { demoInboxEnabled } from "@/lib/server/demo-inbox";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";

export async function GET(request: Request) {
  if (lettingsHostedAvailable()) {
    const profile = await resolveProfileFromRequest(request);
    if (!profile) {
      return NextResponse.json({
        available: true,
        repairs: [],
        confirmations: [],
        inspectionSigns: [],
      });
    }
    try {
      const inbox = await hostedInboxForOrg(profile.orgId);
      return NextResponse.json({ available: true, ...inbox });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Could not load lettings" },
        { status: 502 },
      );
    }
  }
  if (!demoInboxEnabled()) {
    return NextResponse.json({
      available: false,
      repairs: [],
      confirmations: [],
      inspectionSigns: [],
    });
  }
  return NextResponse.json({ available: true, ...readServerInbox() });
}
