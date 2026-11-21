import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/env";
import { deviceLabel } from "@/lib/device";

// Data Access Layer: লগইন করা ব্যবহারকারী আর তাঁর profile একটা জায়গা থেকে। প্রতি request এ একবারই (cache)।
// যিনি ডাকেন তাঁকে <Suspense> এর ভেতরে থাকতে হবে (cookie পড়ে)

export type Role = "student" | "teacher" | "manager" | "admin" | "evaluator";
export type Profile = {
  id: string;
  full_name: string;
  user_code: string;
  phone: string;
  email: string | null;
  role: Role;
  institute: string | null;
  guardian_phone: string | null;
  class_level: string | null;
  avatar_url: string | null;
};

// profile তৈরি হয় মোবাইল নম্বর যাচাইয়ের পর (সাইন আপের তথ্যসহ)। নাম না থাকলে (পুরনো বা হাতে বানানো অ্যাকাউন্ট) আগে /onboarding
export const isProfileComplete = (p: Profile) => p.full_name.trim().length > 0 && !!p.phone;
export const isStaff = (p: Profile | null) => p?.role === "admin" || p?.role === "manager";

// database এর check_request: এই অ্যাকাউন্টে অন্য ডিভাইসে লগইন হয়েছে (একসাথে একটাই ডিভাইস)
export const isSessionReplaced = (error: { code?: string; message?: string } | null | undefined) =>
  !!error && (error.code === "PT401" || error.message === "SESSION_REPLACED");

// লগইন আছে কিনা, আর profile। uid আছে কিন্তু profile নেই = সাইন আপ শেষ হয়নি (Google এর পর নম্বর যাচাই বাকি)
export const getAuth = cache(async (): Promise<{ uid: string | null; email: string | null; meta: Record<string, unknown>; profile: Profile | null }> => {
  const empty = { uid: null, email: null, meta: {}, profile: null };
  if (!hasSupabase()) return empty;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const c = claims?.claims;
  if (!c?.sub) return empty;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, user_code, phone, email, role, institute, guardian_phone, class_level, avatar_url")
    .eq("id", c.sub)
    .maybeSingle();
  if (isSessionReplaced(error)) redirect("/auth/replaced");
  if (error) throw new Error("প্রোফাইল পড়া যায়নি: " + error.message);
  return { uid: c.sub, email: (c.email as string) || null, meta: (c.user_metadata as Record<string, unknown>) ?? {}, profile: data as Profile | null };
});

export const getProfile = async () => (await getAuth()).profile;

// লগইন লাগে এমন পাতায়: লগইন না থাকলে সাইন ইনে, সাইন আপ অসম্পূর্ণ হলে আগে /onboarding এ (সেখান থেকে next এ ফেরে)
export async function requireProfile(next = "/dashboard"): Promise<Profile> {
  const { uid, profile } = await getAuth();
  if (!uid) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  if (!profile || !isProfileComplete(profile)) redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  return profile;
}

// অ্যাডমিন প্যানেল: admin না হলে পাতাটা আছে বলেই জানায় না (404)। database এর RLS ও শুধু admin কে লিখতে দেয়
export async function requireAdmin(next = "/admin"): Promise<Profile> {
  const profile = await requireProfile(next);
  if (profile.role !== "admin") notFound();
  return profile;
}

// পেমেন্ট যাচাই আর সারসংক্ষেপ: admin আর manager দুজনেই
export async function requireStaff(next = "/admin"): Promise<Profile> {
  const profile = await requireProfile(next);
  if (!isStaff(profile)) notFound();
  return profile;
}

// নতুন লগইনের পর: এই লগইনই এখনকার (claim_session)। আগের ডিভাইস লগআউট হয়, সেখানে চলা পরীক্ষা জমা হয়।
// এটা লগইনের পর **প্রথম** database কাজ হতে হবে: দাবির আগে database এর check_request নতুন লগইনকে "অন্য ডিভাইস"
// ভেবে সব request আটকায়, profile পড়াও (তখন ভুল করে "অন্য ডিভাইসে লগইন হয়েছে" দেখায়)।
// profile না থাকলে (সাইন আপ অসম্পূর্ণ, যেমন Google এর পর নম্বর যাচাই বাকি) দাবির কিছু নেই: foreign key (23503) ভাঙে, বাদ
export async function claimThisDevice(supabase: SupabaseClient) {
  const ua = (await headers()).get("user-agent");
  const { data, error } = await supabase.rpc("claim_session", { p_device: deviceLabel(ua) });
  if (error?.code === "23503") return { replaced: false, submitted: 0 };
  if (error) throw new Error("লগইন নিশ্চিত করা যায়নি: " + error.message);
  const row = (data as { replaced: boolean; submitted: number }[] | null)?.[0];
  return { replaced: !!row?.replaced, submitted: row?.submitted ?? 0 };
}

// লগইনের পর কোথায় ফিরবে: শুধু সাইটের ভেতরের পথ (অন্য সাইটে পাঠানোর ফাঁদ নয়)
export function safeNext(value: FormDataEntryValue | string | null | undefined, fallback = "/dashboard") {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : fallback;
}

// পথের সাথে query যোগ: withParams("/courses/x?enroll=1", { welcome: "BP-1001" }) → "/courses/x?enroll=1&welcome=BP-1001"
export function withParams(path: string, params: Record<string, string | null | undefined>) {
  const url = new URL(path, "http://x");
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  return url.pathname + url.search + url.hash;
}
