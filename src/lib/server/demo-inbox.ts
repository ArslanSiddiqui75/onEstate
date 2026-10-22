import { NextResponse } from "next/server";

/**
 * The file inbox is a single-office demo store. It is readable in local dev.
 * Production stays closed unless the operator explicitly opts in, because the
 * file holds client names, emails, and phone numbers for every booking.
 */
export function demoInboxEnabled(
  env: { NODE_ENV?: string; DEMO_PUBLIC_INBOX?: string } = process.env,
) {
  if (env.NODE_ENV !== "production") return true;
  return env.DEMO_PUBLIC_INBOX === "1";
}

export function demoInboxJson(data: unknown) {
  if (!demoInboxEnabled()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  return NextResponse.json(data);
}
