import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured() {
  return Boolean(url && anon);
}

// MUST be a singleton. Every SupabaseClient spins up its own GoTrueClient with
// an auto-refresh timer, visibilitychange listeners, and a claim on the shared
// Navigator LockManager auth lock (all instances use the same storage key).
// This function used to return a brand-new client on every call — and it is
// called from getAuthToken() (every media upload / publish), from
// hydrateSupabaseSession() (every auth event), and from the repository
// factory. The instances accumulated without bound: dozens of refresh timers
// burning CPU/memory, and every getSession() queueing behind an ever-growing
// navigator-lock queue. That is what froze the Compose tab (stuck
// "Uploading…"/"Saving…", file input dead, no row ever inserted) and
// eventually took down the whole browser.
let browserClient: SupabaseClient | null = null;

export function createBrowserSupabaseClient() {
  if (!url || !anon) {
    throw new Error("Supabase is not configured");
  }
  if (!browserClient) {
    browserClient = createClient(url, anon);
  }
  return browserClient;
}

export function getSupabaseEnvStatus() {
  return {
    configured: isSupabaseConfigured(),
    urlPresent: Boolean(url),
    anonPresent: Boolean(anon),
  };
}
