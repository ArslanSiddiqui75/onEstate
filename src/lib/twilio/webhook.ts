import twilio from "twilio";
import { NextResponse } from "next/server";

export function twilioWebhookUrl(request: Request): string {
  const incoming = new URL(request.url);
  const configured = (
    process.env.TWILIO_WEBHOOK_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ""
  ).replace(/\/$/, "");
  if (configured) {
    return `${configured}${incoming.pathname}${incoming.search}`;
  }
  const proto =
    request.headers.get("x-forwarded-proto") ||
    incoming.protocol.replace(":", "") ||
    "https";
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    incoming.host;
  return `${proto}://${host}${incoming.pathname}${incoming.search}`;
}

export async function readTwilioWebhookParams(
  request: Request,
): Promise<Record<string, string>> {
  const raw = await request.text();
  return Object.fromEntries(new URLSearchParams(raw));
}

/**
 * Validate X-Twilio-Signature. Production fails closed without TWILIO_AUTH_TOKEN.
 * Local/dev without Twilio configured still accepts unsigned requests so inbound
 * can be exercised with curl.
 */
export async function assertTwilioSignature(
  request: Request,
  params: Record<string, string>,
): Promise<NextResponse | null> {
  const authToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  const production = process.env.NODE_ENV === "production";

  if (!authToken) {
    if (production) {
      return NextResponse.json(
        { error: "Twilio is not configured" },
        { status: 503 },
      );
    }
    return null;
  }

  const signature = request.headers.get("x-twilio-signature") || "";
  if (!signature) {
    return NextResponse.json(
      { error: "Missing Twilio signature" },
      { status: 401 },
    );
  }

  const url = twilioWebhookUrl(request);
  const valid = twilio.validateRequest(authToken, signature, url, params);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid Twilio signature" },
      { status: 403 },
    );
  }
  return null;
}
