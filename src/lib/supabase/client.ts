import { createBrowserClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./env";

// Client Component এর Supabase client (একই লগইন cookie)। browser এ একটাই instance থাকে
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseKey());
}
