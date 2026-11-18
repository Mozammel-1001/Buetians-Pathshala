import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// অন্য ডিভাইসে লগইন হয়ে গেছে: এই ব্রাউজারের লগইন cookie মুছে সাইন ইনে
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/sign-in?replaced=1", request.nextUrl.origin));
}
