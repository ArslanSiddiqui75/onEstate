import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatePlatformAdmin } from "@/lib/admin/credentials";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  issueAdminSessionToken,
} from "@/lib/admin/session-token";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  }

  const admin = authenticatePlatformAdmin(
    parsed.data.email,
    parsed.data.password,
  );
  if (!admin) {
    return NextResponse.json({ error: "Invalid admin credentials" }, { status: 401 });
  }

  const token = issueAdminSessionToken(admin);
  if (!token) {
    return NextResponse.json(
      { error: "PLATFORM_ADMIN_PASSWORD is not configured" },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ ok: true, admin });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions());
  return response;
}
