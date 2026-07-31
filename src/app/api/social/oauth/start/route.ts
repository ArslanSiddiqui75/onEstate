import { NextResponse } from "next/server";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { getProvider } from "@/lib/social/providers";
import {
  buildRedirectUri,
  createOAuthState,
  createPkcePair,
  safeReturnTo,
} from "@/lib/social/oauth-service";
import type { SocialPlatform } from "@/types";

const PLATFORMS: SocialPlatform[] = ["instagram", "facebook", "linkedin", "x"];

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}) as Record<string, unknown>);
  const platform = body.platform as SocialPlatform;
  if (!PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: "Unknown platform" }, { status: 400 });
  }

  const provider = getProvider(platform);
  if (!provider.isConfigured()) {
    return NextResponse.json(
      { error: `${platform} isn't configured yet. ${provider.missingEnvHint()}` },
      { status: 400 },
    );
  }

  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const redirectUri = buildRedirectUri(origin, platform);
  const returnTo = safeReturnTo(body.returnTo);

  let codeVerifier: string | undefined;
  let codeChallenge: string | undefined;
  if (provider.usesPkce) {
    const pkce = createPkcePair();
    codeVerifier = pkce.codeVerifier;
    codeChallenge = pkce.codeChallenge;
  }

  try {
    const state = await createOAuthState({
      orgId: profile.orgId,
      userId: profile.userId,
      platform,
      returnTo,
      codeVerifier,
    });
    const url = provider.buildAuthorizeUrl({ redirectUri, state, codeChallenge });
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not start the connection" },
      { status: 500 },
    );
  }
}
