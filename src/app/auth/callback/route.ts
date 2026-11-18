import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { claimThisDevice, safeNext, withParams } from "@/lib/auth";

// Google থেকে ফেরা: code বদলে লগইন (PKCE, verifier টা cookie তে ছিল)।
// আগের অ্যাকাউন্ট (profile আছে): এই ডিভাইস দাবি করে next এ। নতুন: profile তখনো নেই (মোবাইল নম্বর যাচাই হলে হয়),
// তাই /onboarding এ সাইন আপের বাকি তথ্য আর নম্বর
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  if (!code) return NextResponse.redirect(new URL("/sign-in?error=google", origin));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL("/sign-in?error=google", origin));

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", data.user.id).maybeSingle();
  if (!profile) return NextResponse.redirect(new URL(withParams("/onboarding", { next }), origin));
  const { replaced } = await claimThisDevice(supabase);
  const target = profile.full_name.trim() ? next : withParams("/onboarding", { next });
  return NextResponse.redirect(new URL(withParams(target, { replaced: replaced ? "1" : null }), origin));
}
