import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/admin/session-token";

export async function GET() {
  const jar = await cookies();
  const admin = verifyAdminSessionToken(jar.get(ADMIN_SESSION_COOKIE)?.value);
  if (!admin) {
    return NextResponse.json({ admin: null }, { status: 401 });
  }
  return NextResponse.json({ admin });
}
