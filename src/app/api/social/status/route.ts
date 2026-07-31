import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { SOCIAL_PROVIDERS } from "@/lib/social/providers";

// Public, no-secrets status check so the Accounts tab can show real "Connect"
// buttons only for platforms that actually have server credentials configured.
export async function GET() {
  const platforms = Object.fromEntries(
    Object.entries(SOCIAL_PROVIDERS).map(([platform, provider]) => [
      platform,
      { configured: provider.isConfigured(), hint: provider.missingEnvHint() },
    ]),
  );
  return NextResponse.json({
    supabaseConfigured: isSupabaseConfigured(),
    platforms,
  });
}
