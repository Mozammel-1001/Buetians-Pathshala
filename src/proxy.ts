import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // ছবি, ফন্ট, Next এর নিজের ফাইল আর বাইরের hook (Supabase থেকে আসে, cookie নেই) বাদে সব পাতায়
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|api/hooks/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
