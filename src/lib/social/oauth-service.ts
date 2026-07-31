import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { SocialPlatform } from "@/types";

const STATE_TTL_MS = 15 * 60 * 1000;

export function createPkcePair() {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function buildRedirectUri(origin: string, platform: SocialPlatform) {
  return `${origin}/api/social/oauth/callback/${platform}`;
}

export function safeReturnTo(path: unknown) {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
    return "/app/social";
  }
  return path;
}

export async function createOAuthState(input: {
  orgId: string;
  userId: string;
  platform: SocialPlatform;
  returnTo: string;
  codeVerifier?: string;
}) {
  const supabase = createServiceSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const state = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const { error } = await supabase.from("social_oauth_states").insert({
    state,
    org_id: input.orgId,
    user_id: input.userId,
    platform: input.platform,
    return_to: input.returnTo,
    code_verifier: input.codeVerifier || null,
  });
  if (error) throw error;
  return state;
}

export async function consumeOAuthState(state: string) {
  const supabase = createServiceSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("social_oauth_states")
    .select("*")
    .eq("state", state)
    .maybeSingle();
  if (!data) return null;
  await supabase.from("social_oauth_states").delete().eq("state", state);

  const createdAt = new Date(String(data.created_at)).getTime();
  if (Number.isFinite(createdAt) && Date.now() - createdAt > STATE_TTL_MS) {
    return null;
  }

  return {
    orgId: String(data.org_id),
    userId: String(data.user_id),
    platform: data.platform as SocialPlatform,
    returnTo: String(data.return_to),
    codeVerifier: data.code_verifier ? String(data.code_verifier) : undefined,
  };
}
