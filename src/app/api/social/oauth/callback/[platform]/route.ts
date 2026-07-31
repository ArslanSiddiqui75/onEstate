import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { getProvider } from "@/lib/social/providers";
import { buildRedirectUri, consumeOAuthState } from "@/lib/social/oauth-service";
import { encryptToken } from "@/lib/social/crypto";
import type { SocialPlatform } from "@/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform: platformParam } = await params;
  const platform = platformParam as SocialPlatform;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");

  const stateRecord = state ? await consumeOAuthState(state) : null;
  const returnTo = stateRecord?.returnTo || "/app/social";

  function redirectTo(extra: Record<string, string>) {
    const target = new URL(returnTo, url.origin);
    for (const [key, value] of Object.entries(extra)) target.searchParams.set(key, value);
    return NextResponse.redirect(target);
  }

  if (providerError) {
    return redirectTo({ social_error: `${platform}: ${providerError}` });
  }
  if (!code || !stateRecord) {
    return redirectTo({
      social_error: "This connection link expired or was already used. Please try connecting again.",
    });
  }
  if (stateRecord.platform !== platform) {
    return redirectTo({ social_error: "Platform mismatch while connecting. Please try again." });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return redirectTo({ social_error: "Supabase is not configured on the server." });
  }

  try {
    const provider = getProvider(platform);
    const redirectUri = buildRedirectUri(url.origin, platform);
    const identities = await provider.exchangeCode({
      code,
      redirectUri,
      codeVerifier: stateRecord.codeVerifier,
    });

    for (const identity of identities) {
      const { data: account, error: upsertError } = await supabase
        .from("social_accounts")
        .upsert(
          {
            org_id: stateRecord.orgId,
            platform,
            display_name: identity.displayName,
            handle: identity.handle || null,
            avatar_url: identity.avatarUrl || null,
            external_account_id: identity.externalAccountId,
            status: "connected",
            scopes: identity.scopes,
            connected_at: new Date().toISOString(),
            connected_by: stateRecord.userId,
            last_error: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "org_id,platform,external_account_id" },
        )
        .select("id")
        .single();
      if (upsertError || !account) {
        throw upsertError || new Error("Could not save the connected account");
      }

      const { error: secretError } = await supabase.from("social_account_secrets").upsert({
        account_id: account.id,
        access_token: encryptToken(identity.accessToken),
        refresh_token: identity.refreshToken ? encryptToken(identity.refreshToken) : null,
        expires_at: identity.expiresAt || null,
        updated_at: new Date().toISOString(),
      });
      if (secretError) throw secretError;
    }

    return redirectTo({ social_connected: platform, count: String(identities.length) });
  } catch (err) {
    return redirectTo({
      social_error: err instanceof Error ? err.message : `Could not connect ${platform}.`,
    });
  }
}
