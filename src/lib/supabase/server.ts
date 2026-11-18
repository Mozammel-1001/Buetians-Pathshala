import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseKey, supabaseUrl } from "./env";

// Server Component, Server Action আর Route Handler এর Supabase client: ব্যবহারকারীর লগইন cookie দিয়ে,
// তাই database এর RLS তাঁর অনুমতিতে চলে। cookie পড়া মানে request এর ডেটা, তাই যে component এটা ডাকে
// সেটা <Suspense> এর ভেতরে থাকতে হবে (Cache Components)
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabaseKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component থেকে cookie লেখা যায় না; proxy.ts প্রতি request এ session নবায়ন করে রাখে
        }
      },
    },
  });
}
