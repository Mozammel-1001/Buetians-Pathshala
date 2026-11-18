import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

// secret key এর client: RLS মানে না, তাই শুধু server এ, আর শুধু সেই কাজে যেটা লগইনের আগে লাগে:
// আইডি থেকে মোবাইল নম্বর বের করা (নম্বর কখনো browser এ যায় না), নম্বরে আগেই অ্যাকাউন্ট আছে কিনা দেখা।
// key না থাকলে (development এর শুরুতে) null: তখন আইডি দিয়ে লগইন বন্ধ, মোবাইল নম্বর দিয়ে চলে
export const hasSecretKey = () => !!process.env.SUPABASE_SECRET_KEY;

export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createSupabaseClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
}
