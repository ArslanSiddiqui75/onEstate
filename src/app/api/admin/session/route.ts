import { cookies } from "next/headers";
import { adminJson } from "@/lib/admin/json";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/admin/session-token";

export async function GET() {
  const jar = await cookies();
  const admin = verifyAdminSessionToken(jar.get(ADMIN_SESSION_COOKIE)?.value);
  if (!admin) {
    return adminJson({ admin: null }, { status: 401 });
  }
  return adminJson({ admin });
}
