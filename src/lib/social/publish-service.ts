import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { decryptToken, encryptToken } from "@/lib/social/crypto";
import { getProvider } from "@/lib/social/providers";
import type { SocialMediaItem, SocialPlatform } from "@/types";

export type PublishSummary = {
  ok: boolean;
  message: string;
  results: { accountId: string; ok: boolean; error?: string }[];
};

// Shared by the manual "Publish now" route and the cron endpoint that fires
// scheduled posts. Always goes through the service-role client: this is the
// only place decrypted tokens exist in memory, and only for the duration of
// the platform API calls below.
export async function publishSocialPost(postId: string, orgId: string): Promise<PublishSummary> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return { ok: false, message: "Supabase is not configured on the server.", results: [] };
  }

  const { data: post, error: postError } = await supabase
    .from("social_posts")
    .select("*")
    .eq("id", postId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (postError || !post) {
    return { ok: false, message: "Post not found.", results: [] };
  }

  const accountIds: string[] = Array.isArray(post.account_ids) ? post.account_ids.map(String) : [];
  if (accountIds.length === 0) {
    return { ok: false, message: "This post has no connected accounts to publish to.", results: [] };
  }

  const { data: accounts } = await supabase.from("social_accounts").select("*").in("id", accountIds);

  const results: PublishSummary["results"] = [];

  for (const accountId of accountIds) {
    const account = accounts?.find((a) => String(a.id) === accountId);
    if (!account) {
      results.push({ accountId, ok: false, error: "Account not found" });
      continue;
    }
    if (account.status !== "connected") {
      results.push({ accountId, ok: false, error: "Account is not connected" });
      continue;
    }

    const { data: secret } = await supabase
      .from("social_account_secrets")
      .select("*")
      .eq("account_id", accountId)
      .maybeSingle();
    if (!secret) {
      results.push({ accountId, ok: false, error: "No stored credentials — reconnect this account" });
      continue;
    }

    const provider = getProvider(account.platform as SocialPlatform);
    let accessToken = decryptToken(String(secret.access_token));
    let refreshToken = secret.refresh_token ? decryptToken(String(secret.refresh_token)) : undefined;

    const expiresAt = secret.expires_at ? new Date(String(secret.expires_at)).getTime() : null;
    if (expiresAt && expiresAt - Date.now() < 5 * 60 * 1000 && provider.refresh) {
      const refreshed = await provider.refresh({
        externalAccountId: String(account.external_account_id),
        accessToken,
        refreshToken,
      });
      if (refreshed) {
        accessToken = refreshed.accessToken;
        refreshToken = refreshed.refreshToken || refreshToken;
        await supabase
          .from("social_account_secrets")
          .update({
            access_token: encryptToken(accessToken),
            refresh_token: refreshToken ? encryptToken(refreshToken) : null,
            expires_at: refreshed.expiresAt || null,
            updated_at: new Date().toISOString(),
          })
          .eq("account_id", accountId);
      }
    }

    const result = await provider.publish(
      { externalAccountId: String(account.external_account_id), accessToken, refreshToken },
      {
        caption: String(post.caption || ""),
        media: Array.isArray(post.media) ? (post.media as SocialMediaItem[]) : [],
        linkUrl: post.link_url ? String(post.link_url) : undefined,
      },
    );
    results.push({ accountId, ok: result.ok, error: result.error });

    await supabase
      .from("social_accounts")
      .update({ last_error: result.ok ? null : result.error, updated_at: new Date().toISOString() })
      .eq("id", accountId);
  }

  const allOk = results.every((r) => r.ok);
  const failedCount = results.filter((r) => !r.ok).length;
  const message = allOk
    ? "Published to all target accounts."
    : `${failedCount} of ${results.length} target account${results.length === 1 ? "" : "s"} failed: ${results
        .filter((r) => !r.ok)
        .map((r) => r.error)
        .join(" · ")}`;

  await supabase
    .from("social_posts")
    .update({
      status: allOk ? "published" : "failed",
      published_at: allOk ? new Date().toISOString() : post.published_at,
      last_error: allOk ? null : message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);

  return { ok: allOk, message, results };
}

export async function publishDuePosts(limit = 25, orgId?: string) {
  const supabase = createServiceSupabaseClient();
  if (!supabase) return { processed: 0, published: 0, failed: 0 };

  let query = supabase
    .from("social_posts")
    .select("id, org_id")
    .eq("status", "scheduled")
    .lte("scheduled_for", new Date().toISOString())
    .limit(limit);

  if (orgId) {
    query = query.eq("org_id", orgId);
  }

  const { data: due } = await query;

  let published = 0;
  let failed = 0;
  for (const row of due || []) {
    const result = await publishSocialPost(String(row.id), String(row.org_id));
    if (result.ok) published += 1;
    else failed += 1;
  }
  return { processed: (due || []).length, published, failed };
}
