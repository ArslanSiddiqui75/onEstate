import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { SOCIAL_PROVIDERS } from "@/lib/social/providers";

// Whether each network can be connected. No setup instructions — those stay on the server.
export async function GET() {
  const platforms = Object.fromEntries(
    Object.entries(SOCIAL_PROVIDERS).map(([platform, provider]) => [
      platform,
      { configured: provider.isConfigured() },
    ]),
  );
  return NextResponse.json({
    supabaseConfigured: isSupabaseConfigured(),
    platforms,
  });
}
