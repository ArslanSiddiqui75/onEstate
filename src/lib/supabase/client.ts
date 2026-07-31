import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured() {
  return Boolean(url && anon);
}

export function createBrowserSupabaseClient() {
  if (!url || !anon) {
    throw new Error("Supabase is not configured");
  }
  return createClient(url, anon);
}

export function getSupabaseEnvStatus() {
  return {
    configured: isSupabaseConfigured(),
    urlPresent: Boolean(url),
    anonPresent: Boolean(anon),
  };
}
