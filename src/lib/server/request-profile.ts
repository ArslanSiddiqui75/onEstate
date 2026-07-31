import { createServiceSupabaseClient } from "@/lib/supabase/server";

export interface RequestProfile {
  userId: string;
  email: string;
  orgId: string;
  role: string;
}

// Browser sessions live in the Supabase JS client's own storage, not an
// httpOnly cookie, so route handlers can't read "the current user" for free.
// The client instead sends its access token as a Bearer header; we verify it
// against Supabase Auth (service role) and resolve the caller's real org from
// `profiles`, so nobody can just pass an arbitrary orgId in the request body.
export async function resolveProfileFromRequest(
  request: Request,
): Promise<RequestProfile | null> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) return null;

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, org_id, role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (!profile) return null;

  return {
    userId: String(userData.user.id),
    email: String(userData.user.email || ""),
    orgId: String(profile.org_id),
    role: String(profile.role),
  };
}
