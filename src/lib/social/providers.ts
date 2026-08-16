import type { SocialMediaItem, SocialPlatform } from "@/types";

// Server-only. One adapter per platform: build the real authorize URL, trade
// the returned code for real tokens, resolve the account(s) that were
// authorized, and publish a post with the stored token. No mocks — if the
// env vars below aren't set, isConfigured() is false and the UI disables
// "Connect" for that platform instead of pretending it works.

export type ConnectedIdentity = {
  externalAccountId: string;
  displayName: string;
  handle?: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes: string[];
};

export type PublishTarget = {
  externalAccountId: string;
  accessToken: string;
  refreshToken?: string;
};

export type PublishInput = {
  caption: string;
  media: SocialMediaItem[];
  linkUrl?: string;
};

export type PublishResult = { ok: boolean; externalPostId?: string; error?: string };

export interface SocialProvider {
  platform: SocialPlatform;
  usesPkce: boolean;
  isConfigured(): boolean;
  missingEnvHint(): string;
  buildAuthorizeUrl(args: {
    redirectUri: string;
    state: string;
    codeChallenge?: string;
  }): string;
  exchangeCode(args: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<ConnectedIdentity[]>;
  publish(target: PublishTarget, input: PublishInput): Promise<PublishResult>;
  refresh?(
    target: PublishTarget,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: string } | null>;
}

function dataUrlToBlob(dataUrl: string, fallbackMime: string): Blob {
  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!match) throw new Error("Expected a base64 data URL for media upload");
  const mime = match[1] || fallbackMime;
  const buffer = Buffer.from(match[2], "base64");
  return new Blob([new Uint8Array(buffer)], { type: mime });
}

async function mediaToBlob(media: SocialMediaItem): Promise<Blob> {
  if (media.dataUrl.startsWith("data:")) {
    return dataUrlToBlob(media.dataUrl, media.mimeType);
  }
  if (/^https?:\/\//.test(media.dataUrl)) {
    const res = await fetch(media.dataUrl);
    if (!res.ok) throw new Error("Could not download attached media for upload");
    const buffer = await res.arrayBuffer();
    return new Blob([buffer], { type: media.mimeType || "application/octet-stream" });
  }
  throw new Error("Unsupported media reference");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const GRAPH_VERSION = "v21.0";

// Instagram fetches and transcodes media asynchronously after container
// creation. Polls status_code until it's FINISHED (ready to publish),
// ERROR/EXPIRED (fail fast), or the timeout elapses. Images usually finish in
// a couple of seconds; videos/Reels can take longer, hence the longer budget.
async function waitForContainerReady(
  containerId: string,
  accessToken: string,
  // Kept under the Vercel serverless function budget (see maxDuration on the
  // /api/social/publish and cron routes) so the platform doesn't kill the
  // request mid-poll before we get a chance to return a clear error.
  { timeoutMs = 45_000, intervalMs = 2_500 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const statusUrl = new URL(`https://graph.instagram.com/${containerId}`);
    statusUrl.searchParams.set("fields", "status_code");
    statusUrl.searchParams.set("access_token", accessToken);
    const res = await fetch(statusUrl.toString());
    const json = await res.json().catch(() => ({}));

    if (res.ok && json.status_code === "FINISHED") return { ok: true };
    if (res.ok && json.status_code === "ERROR") {
      return { ok: false, error: "Instagram failed to process the media (status: ERROR)." };
    }
    if (res.ok && json.status_code === "EXPIRED") {
      return { ok: false, error: "Instagram media container expired before it could be published." };
    }

    if (Date.now() >= deadline) {
      return {
        ok: false,
        error: "Timed out waiting for Instagram to finish processing the media. Try again shortly.",
      };
    }
    await sleep(intervalMs);
  }
}

const facebookProvider: SocialProvider = {
  platform: "facebook",
  usesPkce: false,
  isConfigured: () => Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
  missingEnvHint: () =>
    "Set META_APP_ID and META_APP_SECRET from a Meta for Developers app with the Facebook Login for Business + Pages API products.",
  buildAuthorizeUrl: ({ redirectUri, state }) => {
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID || "",
      redirect_uri: redirectUri,
      state,
      response_type: "code",
      scope: "pages_show_list,pages_read_engagement,pages_manage_posts,business_management",
    });
    return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
  },
  async exchangeCode({ code, redirectUri }) {
    const appId = process.env.META_APP_ID || "";
    const appSecret = process.env.META_APP_SECRET || "";

    const tokenUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("code", code);
    const tokenRes = await fetch(tokenUrl.toString());
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new Error(tokenJson.error?.message || "Facebook token exchange failed");
    }

    // Trade for a long-lived user token so the page tokens derived from it
    // don't expire after ~1-2 hours.
    const longUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", appId);
    longUrl.searchParams.set("client_secret", appSecret);
    longUrl.searchParams.set("fb_exchange_token", tokenJson.access_token);
    const longRes = await fetch(longUrl.toString());
    const longJson = await longRes.json();
    const userToken = longRes.ok && longJson.access_token ? longJson.access_token : tokenJson.access_token;

    const pagesUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`);
    pagesUrl.searchParams.set("fields", "id,name,access_token,picture.type(large)");
    pagesUrl.searchParams.set("access_token", userToken);
    const pagesRes = await fetch(pagesUrl.toString());
    const pagesJson = await pagesRes.json();
    if (!pagesRes.ok) {
      throw new Error(pagesJson.error?.message || "Could not list the Facebook Pages you manage");
    }

    const pages = (pagesJson.data || []) as Array<Record<string, unknown>>;
    if (pages.length === 0) {
      throw new Error(
        "No Facebook Pages found for this account. You must be an admin of at least one Page to connect Facebook.",
      );
    }

    return pages.map((page) => ({
      externalAccountId: String(page.id),
      displayName: String(page.name),
      avatarUrl: (page.picture as { data?: { url?: string } } | undefined)?.data?.url,
      accessToken: String(page.access_token),
      scopes: ["pages_manage_posts", "pages_read_engagement"],
    }));
  },
  async publish(target, input) {
    try {
      const media = input.media[0];
      if (media) {
        const blob = await mediaToBlob(media);
        const form = new FormData();
        form.set("source", blob, media.name || "upload");
        form.set("caption", input.caption);
        form.set("access_token", target.accessToken);
        const endpoint =
          media.kind === "video"
            ? `https://graph-video.facebook.com/${GRAPH_VERSION}/${target.externalAccountId}/videos`
            : `https://graph.facebook.com/${GRAPH_VERSION}/${target.externalAccountId}/photos`;
        const res = await fetch(endpoint, { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message || "Facebook publish failed");
        return { ok: true, externalPostId: String(json.post_id || json.id) };
      }

      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${target.externalAccountId}/feed`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: input.caption,
            link: input.linkUrl,
            access_token: target.accessToken,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Facebook publish failed");
      return { ok: true, externalPostId: String(json.id) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Facebook publish failed" };
    }
  },
};

const instagramProvider: SocialProvider = {
  platform: "instagram",
  usesPkce: false,
  isConfigured: () => Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET),
  missingEnvHint: () =>
    "Set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET from a Meta app with the Instagram product's \"API setup with Instagram login\".",
  buildAuthorizeUrl: ({ redirectUri, state }) => {
    const params = new URLSearchParams({
      enable_fb_login: "0",
      force_authentication: "1",
      client_id: process.env.INSTAGRAM_APP_ID || "",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "instagram_business_basic,instagram_business_content_publish",
      state,
    });
    return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  },
  async exchangeCode({ code, redirectUri }) {
    const clientId = process.env.INSTAGRAM_APP_ID || "";
    const clientSecret = process.env.INSTAGRAM_APP_SECRET || "";
    const cleanCode = code.replace(/#_.*$/, "").replace(/#.*$/, "").trim();

    const form = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code: cleanCode,
    });
    const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const shortJson = await shortRes.json().catch(() => ({}));
    if (!shortRes.ok || !shortJson.access_token) {
      const errorMsg =
        shortJson.error_message ||
        shortJson.error?.message ||
        shortJson.error?.error_user_msg ||
        (shortRes.statusText ? `HTTP ${shortRes.status} ${shortRes.statusText}` : "Instagram token exchange failed");
      throw new Error(`Instagram token exchange failed: ${errorMsg}`);
    }

    const longUrl = new URL("https://graph.instagram.com/access_token");
    longUrl.searchParams.set("grant_type", "ig_exchange_token");
    longUrl.searchParams.set("client_secret", clientSecret);
    longUrl.searchParams.set("access_token", shortJson.access_token);
    const longRes = await fetch(longUrl.toString());
    const longJson = await longRes.json().catch(() => ({}));
    const accessToken = longRes.ok && longJson.access_token ? longJson.access_token : shortJson.access_token;
    const expiresAt = longJson.expires_in
      ? new Date(Date.now() + Number(longJson.expires_in) * 1000).toISOString()
      : undefined;

    let username = "";
    let externalAccountId = String(shortJson.user_id || "");
    try {
      const meUrl = new URL(`https://graph.instagram.com/${GRAPH_VERSION}/me`);
      meUrl.searchParams.set("fields", "id,user_id,username,account_type");
      meUrl.searchParams.set("access_token", accessToken);
      const meRes = await fetch(meUrl.toString());
      const meJson = await meRes.json().catch(() => ({}));
      if (meRes.ok) {
        if (meJson.username) username = String(meJson.username);
        if (meJson.user_id || meJson.id) externalAccountId = String(meJson.user_id || meJson.id);
      }
    } catch {
      // Use fallback ID if /me request encounters permission constraints
    }

    if (!externalAccountId) {
      externalAccountId = `ig_${Date.now()}`;
    }

    return [
      {
        externalAccountId,
        displayName: username ? `@${username}` : "Instagram Account",
        handle: username ? `@${username}` : undefined,
        avatarUrl: undefined,
        accessToken,
        expiresAt,
        scopes: ["instagram_business_content_publish"],
      },
    ];
  },
  async publish(target, input) {
    try {
      const media = input.media[0];
      if (!media) {
        return { ok: false, error: "Instagram requires at least one image or video." };
      }
      if (!/^https?:\/\//.test(media.dataUrl)) {
        return {
          ok: false,
          error:
            "Instagram's publishing API only accepts a public image/video URL, not an uploaded file. Pull media from a listing (already a public URL) or host the file publicly before attaching it.",
        };
      }
      const body: Record<string, string> = {
        caption: input.caption,
        access_token: target.accessToken,
      };
      // Video containers must declare a media_type — Instagram no longer
      // accepts a bare video_url without it (container creation silently
      // fails, or the post never actually appears). Feed videos are published
      // as Reels since Instagram deprecated the plain "video" post type.
      if (media.kind === "video") {
        body.video_url = media.dataUrl;
        body.media_type = "REELS";
      } else {
        body.image_url = media.dataUrl;
      }

      const createRes = await fetch(
        `https://graph.instagram.com/${GRAPH_VERSION}/${target.externalAccountId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const createJson = await createRes.json();
      if (!createRes.ok || !createJson.id) {
        throw new Error(createJson.error?.message || "Instagram media creation failed");
      }

      // Instagram processes the fetched media asynchronously. Calling
      // media_publish before the container reaches FINISHED reliably fails
      // (commonly with "Media ID is not available") — this is why posts with
      // real media were silently never showing up. Poll status_code first, as
      // Meta's own docs recommend (~once per minute, up to 5 minutes; we poll
      // faster since most images/short videos finish in a few seconds).
      const ready = await waitForContainerReady(createJson.id, target.accessToken);
      if (!ready.ok) {
        return { ok: false, error: ready.error };
      }

      const publishRes = await fetch(
        `https://graph.instagram.com/${GRAPH_VERSION}/${target.externalAccountId}/media_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creation_id: createJson.id, access_token: target.accessToken }),
        },
      );
      const publishJson = await publishRes.json();
      if (!publishRes.ok) throw new Error(publishJson.error?.message || "Instagram publish failed");
      return { ok: true, externalPostId: String(publishJson.id) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Instagram publish failed" };
    }
  },
  async refresh(target) {
    const url = new URL("https://graph.instagram.com/refresh_access_token");
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", target.accessToken);
    const res = await fetch(url.toString());
    const json = await res.json();
    if (!res.ok || !json.access_token) return null;
    return {
      accessToken: json.access_token,
      expiresAt: json.expires_in
        ? new Date(Date.now() + Number(json.expires_in) * 1000).toISOString()
        : undefined,
    };
  },
};

const LINKEDIN_VERSION = "202604";

const linkedinProvider: SocialProvider = {
  platform: "linkedin",
  usesPkce: false,
  isConfigured: () => Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET),
  missingEnvHint: () =>
    "Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET from a LinkedIn app with \"Sign In with LinkedIn using OpenID Connect\" and \"Share on LinkedIn\" products enabled.",
  buildAuthorizeUrl: ({ redirectUri, state }) => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.LINKEDIN_CLIENT_ID || "",
      redirect_uri: redirectUri,
      state,
      scope: "openid profile w_member_social",
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  },
  async exchangeCode({ code, redirectUri }) {
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: process.env.LINKEDIN_CLIENT_ID || "",
      client_secret: process.env.LINKEDIN_CLIENT_SECRET || "",
    });
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new Error(tokenJson.error_description || "LinkedIn token exchange failed");
    }

    const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const meJson = await meRes.json();
    if (!meRes.ok) throw new Error("Could not read the LinkedIn profile");

    return [
      {
        externalAccountId: String(meJson.sub),
        displayName: String(meJson.name || "LinkedIn member"),
        avatarUrl: meJson.picture,
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token,
        expiresAt: tokenJson.expires_in
          ? new Date(Date.now() + Number(tokenJson.expires_in) * 1000).toISOString()
          : undefined,
        scopes: ["w_member_social"],
      },
    ];
  },
  async publish(target, input) {
    try {
      const author = `urn:li:person:${target.externalAccountId}`;
      let content: Record<string, unknown> | undefined;
      const media = input.media[0];

      if (media) {
        const initRes = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${target.accessToken}`,
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
            "LinkedIn-Version": LINKEDIN_VERSION,
          },
          body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
        });
        const initJson = await initRes.json();
        if (!initRes.ok) throw new Error(initJson.message || "LinkedIn image upload init failed");
        const uploadUrl = initJson.value?.uploadUrl as string | undefined;
        const imageUrn = initJson.value?.image as string | undefined;
        if (!uploadUrl || !imageUrn) throw new Error("LinkedIn did not return an upload target");

        const blob = await mediaToBlob(media);
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { Authorization: `Bearer ${target.accessToken}` },
          body: blob,
        });
        if (!uploadRes.ok) throw new Error("LinkedIn image upload failed");
        content = { media: { id: imageUrn, title: input.caption.slice(0, 80) || "Image" } };
      } else if (input.linkUrl) {
        content = { article: { source: input.linkUrl, title: input.caption.slice(0, 80) || "Link" } };
      }

      const payload: Record<string, unknown> = {
        author,
        commentary: input.caption,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      };
      if (content) payload.content = content;

      const postRes = await fetch("https://api.linkedin.com/rest/posts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${target.accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
          "LinkedIn-Version": LINKEDIN_VERSION,
        },
        body: JSON.stringify(payload),
      });
      if (!postRes.ok) {
        const errJson = await postRes.json().catch(() => ({}) as Record<string, unknown>);
        throw new Error(String(errJson.message || "LinkedIn publish failed"));
      }
      const postId =
        postRes.headers.get("x-restli-id") || postRes.headers.get("x-linkedin-id") || undefined;
      return { ok: true, externalPostId: postId };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "LinkedIn publish failed" };
    }
  },
};

async function uploadMediaToX(media: SocialMediaItem, accessToken: string) {
  const blob = await mediaToBlob(media);
  const buffer = Buffer.from(await blob.arrayBuffer());
  const mediaCategory = media.kind === "video" ? "tweet_video" : "tweet_image";

  const initRes = await fetch("https://api.x.com/2/media/upload/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: blob.type || "image/jpeg",
      media_category: mediaCategory,
      total_bytes: buffer.byteLength,
    }),
  });
  const initJson = await initRes.json();
  if (!initRes.ok) throw new Error(initJson.detail || "X media upload init failed");
  const mediaId = String(initJson.data.id);

  const CHUNK = 4 * 1024 * 1024;
  for (let offset = 0, segment = 0; offset < buffer.byteLength; offset += CHUNK, segment += 1) {
    const chunk = buffer.subarray(offset, offset + CHUNK);
    const form = new FormData();
    form.set("segment_index", String(segment));
    form.set("media", new Blob([new Uint8Array(chunk)]));
    const appendRes = await fetch(`https://api.x.com/2/media/upload/${mediaId}/append`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    if (!appendRes.ok) throw new Error("X media chunk upload failed");
  }

  const finalizeRes = await fetch(`https://api.x.com/2/media/upload/${mediaId}/finalize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
  });
  const finalizeJson = await finalizeRes.json();
  if (!finalizeRes.ok) throw new Error(finalizeJson.detail || "X media finalize failed");
  return mediaId;
}

function basicAuthHeader(clientId: string, clientSecret?: string) {
  if (!clientSecret) return undefined;
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

const xProvider: SocialProvider = {
  platform: "x",
  usesPkce: true,
  isConfigured: () => Boolean(process.env.X_CLIENT_ID),
  missingEnvHint: () =>
    "Set X_CLIENT_ID (and X_CLIENT_SECRET for a confidential app) from an X Developer app with OAuth 2.0 enabled. Posting also requires a paid X API tier.",
  buildAuthorizeUrl: ({ redirectUri, state, codeChallenge }) => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.X_CLIENT_ID || "",
      redirect_uri: redirectUri,
      scope: "tweet.read tweet.write users.read offline.access",
      state,
      code_challenge: codeChallenge || "",
      code_challenge_method: "S256",
    });
    return `https://x.com/i/oauth2/authorize?${params.toString()}`;
  },
  async exchangeCode({ code, redirectUri, codeVerifier }) {
    const clientId = process.env.X_CLIENT_ID || "";
    const clientSecret = process.env.X_CLIENT_SECRET;
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier || "",
    });
    const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
    const auth = basicAuthHeader(clientId, clientSecret);
    if (auth) headers.Authorization = auth;

    const tokenRes = await fetch("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers,
      body: form.toString(),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new Error(tokenJson.error_description || "X token exchange failed");
    }

    const meRes = await fetch("https://api.x.com/2/users/me?user.fields=profile_image_url", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const meJson = await meRes.json();
    if (!meRes.ok) throw new Error("Could not read the X profile");

    return [
      {
        externalAccountId: String(meJson.data.id),
        displayName: String(meJson.data.name),
        handle: meJson.data.username ? `@${meJson.data.username}` : undefined,
        avatarUrl: meJson.data.profile_image_url,
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token,
        expiresAt: tokenJson.expires_in
          ? new Date(Date.now() + Number(tokenJson.expires_in) * 1000).toISOString()
          : undefined,
        scopes: ["tweet.write", "tweet.read", "users.read"],
      },
    ];
  },
  async refresh(target) {
    if (!target.refreshToken) return null;
    const clientId = process.env.X_CLIENT_ID || "";
    const clientSecret = process.env.X_CLIENT_SECRET;
    const form = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: target.refreshToken,
      client_id: clientId,
    });
    const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
    const auth = basicAuthHeader(clientId, clientSecret);
    if (auth) headers.Authorization = auth;

    const res = await fetch("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers,
      body: form.toString(),
    });
    const json = await res.json();
    if (!res.ok || !json.access_token) return null;
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token || target.refreshToken,
      expiresAt: json.expires_in
        ? new Date(Date.now() + Number(json.expires_in) * 1000).toISOString()
        : undefined,
    };
  },
  async publish(target, input) {
    try {
      let mediaIds: string[] | undefined;
      const media = input.media[0];
      if (media) {
        mediaIds = [await uploadMediaToX(media, target.accessToken)];
      }
      const text = input.linkUrl ? `${input.caption}\n\n${input.linkUrl}` : input.caption;
      const body: Record<string, unknown> = { text };
      if (mediaIds) body.media = { media_ids: mediaIds };

      const res = await fetch("https://api.x.com/2/tweets", {
        method: "POST",
        headers: { Authorization: `Bearer ${target.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || json.title || "X publish failed");
      return { ok: true, externalPostId: String(json.data?.id) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "X publish failed" };
    }
  },
};

export const SOCIAL_PROVIDERS: Record<SocialPlatform, SocialProvider> = {
  facebook: facebookProvider,
  instagram: instagramProvider,
  linkedin: linkedinProvider,
  x: xProvider,
};

export function getProvider(platform: SocialPlatform): SocialProvider {
  return SOCIAL_PROVIDERS[platform];
}
