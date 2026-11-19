import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseKey, supabaseUrl } from "./env";
import { SESSION_ONLY_COOKIE, withoutExpiry } from "./session-only";

// Server Component, Server Action আর Route Handler এর Supabase client: ব্যবহারকারীর লগইন cookie দিয়ে,
// তাই database এর RLS তাঁর অনুমতিতে চলে। cookie পড়া মানে request এর ডেটা, তাই যে component এটা ডাকে
// সেটা <Suspense> এর ভেতরে থাকতে হবে (Cache Components)
// sessionOnly: এই লগইনের cookie ব্রাউজার বন্ধ করলে মুছবে ("আমাকে মনে রাখুন" বন্ধ); না দিলে আগের পছন্দ (bp_so cookie) মানে
export async function createClient({ sessionOnly }: { sessionOnly?: boolean } = {}) {
  const cookieStore = await cookies();
  const dropExpiry = sessionOnly ?? cookieStore.get(SESSION_ONLY_COOKIE)?.value === "1";
  return createServerClient(supabaseUrl(), supabaseKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, dropExpiry ? withoutExpiry(options) : options));
        } catch {
          // Server Component থেকে cookie লেখা যায় না; proxy.ts প্রতি request এ session নবায়ন করে রাখে
        }
      },
    },
  });
}
