import { createBrowserClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./env";
import { SESSION_ONLY_COOKIE } from "./session-only";

// Client Component এর Supabase client (একই লগইন cookie)। browser এ একটাই instance থাকে।
// "আমাকে মনে রাখুন" বন্ধ থাকলে (bp_so cookie) নবায়ন করা cookie তেও মেয়াদ জোড়া হয় না
export function createClient() {
  const sessionOnly = typeof document !== "undefined" && document.cookie.split("; ").includes(`${SESSION_ONLY_COOKIE}=1`);
  return createBrowserClient(supabaseUrl(), supabaseKey(), sessionOnly ? { cookieOptions: { maxAge: undefined } } : undefined);
}
