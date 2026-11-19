import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabase, supabaseKey, supabaseUrl } from "./env";
import { SESSION_ONLY_COOKIE, withoutExpiry } from "./session-only";

// লগইন লাগে এমন পাতা (এখানে আগেভাগে ফেরানো; আসল যাচাই পাতায় আর database এ)
const PROTECTED = ["/dashboard", "/onboarding", "/admin"];

// প্রতি request এ: মেয়াদ ফুরানো access token থাকলে নবায়ন করে cookie তে রাখা, আর লগইন ছাড়া সুরক্ষিত পাতায় গেলে
// সাইন ইনে পাঠানো। getClaims() JWT এর সই যাচাই করে, শুধু cookie বিশ্বাস করে না
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!hasSupabase()) return response;
  const dropExpiry = request.cookies.get(SESSION_ONLY_COOKIE)?.value === "1";

  const supabase = createServerClient(supabaseUrl(), supabaseKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, dropExpiry ? withoutExpiry(options) : options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  if (!data?.claims && PROTECTED.some((p) => path === p || path.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}
