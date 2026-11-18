import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseKey, supabaseUrl } from "./env";

// লগইন ছাড়া সবার দেখার ডেটা (প্রকাশিত কোর্স ইত্যাদি): cookie ছাড়া, তাই 'use cache' এ রাখা যায় আর
// পাতার স্থির অংশে আগেই তৈরি হয়ে থাকে। database এ anon রোলের অনুমতিতে চলে
export function createPublicClient() {
  return createSupabaseClient(supabaseUrl(), supabaseKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
