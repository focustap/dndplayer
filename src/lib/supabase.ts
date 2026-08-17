import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const isSupabaseConfigured = Boolean(url && publishableKey);
export const supabase = createClient(url ?? "https://example.supabase.co", publishableKey ?? "demo-publishable-key", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
