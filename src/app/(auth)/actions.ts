"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import type { AuthError, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_ONLY_COOKIE } from "@/lib/supabase/session-only";
import { claimThisDevice, isSessionReplaced, safeNext, withParams } from "@/lib/auth";
import { CLASS_LEVELS, cleanOtp, e164, isEmail, normalizeBdPhone, normalizeUserCode, PASSWORD_MIN, str } from "@/lib/validation";

// অ্যাকাউন্ট: আইডি (BP-1001) বা মোবাইল নম্বর + পাসওয়ার্ডে লগইন। সাইন আপ তিন ধাপে (নাম, ইমেইল, মোবাইল, পাসওয়ার্ড →
// অভিভাবক, প্রতিষ্ঠান, শ্রেণি → মোবাইলের OTP), OTP মিললে অ্যাকাউন্ট চালু (তখনই database আইডি দেয়), তারপর স্বাগত বার্তায় আইডি।
// পাসওয়ার্ড ভুললে শুধু মোবাইল নম্বর: OTP → নতুন পাসওয়ার্ড। Google: প্রথমবার /onboarding এ বাকি তথ্য আর নম্বর যাচাই।

// ---------- ধরন ----------
export type SignupValues = { full_name: string; phone: string; email: string; guardian_phone: string; institute: string; class_level: string };
// onboarding (Google এর পর) এর দুই ধাপের ফর্ম এই অবস্থা ব্যবহার করে
export type SignupState = {
  step: "form" | "code";
  values: SignupValues;
  phone?: string;        // 8801XXXXXXXXX, কোড গেছে যে নম্বরে
  sentAt?: number;
  error?: string;
  fieldErrors?: Partial<Record<keyof SignupValues | "code", string>>;
  exists?: boolean;      // এই নম্বরে আগেই অ্যাকাউন্ট → লগইনের লিংক
};

export type FormState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> } | undefined;

// সাইন আপ/লগইন/রিসেটের কাজের ফল (পাতার client component এ দেখানোর জন্য)
export type AuthResult = {
  ok?: boolean;
  error?: string;                       // ফর্মের উপরে/নিচে সাধারণ ভুল
  fieldErrors?: Record<string, string>; // ঘর ধরে ভুল
  step?: 1 | 2;                         // সাইন আপে কোন ধাপে ফিরে ভুল ঠিক করতে হবে
  left?: number;                        // OTP আবার কতবার পাঠানো যাবে (সার্ভার গুনতে পারলে)
};

export type SignupInput = {
  full_name: string; phone: string; email: string; password: string; confirm: string;
  guardian_phone: string; institute: string; class_level: string;
};

// ---------- সাহায্যকারী ----------
async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

function sendError(error: AuthError): string {
  switch (error.code) {
    case "over_sms_send_rate_limit":
    case "over_request_rate_limit":
      return "অনেকবার কোড চাওয়া হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
    case "phone_exists":
    case "user_already_exists":
      return "এই নম্বরে আগেই একটা অ্যাকাউন্ট আছে।";
    case "phone_provider_disabled":
    case "sms_send_failed":
    case "hook_timeout":
    case "hook_timeout_after_retry":
    case "unexpected_failure":
      return "এখন SMS পাঠানো যাচ্ছে না। একটু পরে চেষ্টা করুন।";
    default:
      return "কোড পাঠানো যায়নি: " + error.message;
  }
}
const verifyError = (error: AuthError) =>
  error.code === "over_request_rate_limit"
    ? "অনেকবার ভুল কোড দেওয়া হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।"
    : "কোডটা মেলেনি, নয়তো মেয়াদ শেষ। আবার দেখে লিখুন, নয়তো নতুন কোড চান।";

// নতুন লগইন জেতানো আর প্রোফাইল দেখা। profile না থাকলে (Google এর পর সাইন আপ অসম্পূর্ণ) আগে /onboarding
async function finishLogin(supabase: SupabaseClient, uid: string, next: string) {
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle();
  if (!profile) return withParams("/onboarding", { next });
  const { replaced } = await claimThisDevice(supabase);
  if (!profile.full_name.trim()) return withParams("/onboarding", { next, replaced: replaced ? "1" : null });
  return withParams(next, { replaced: replaced ? "1" : null });
}

// "আমাকে মনে রাখুন" এর পছন্দ: বন্ধ থাকলে bp_so=1 (নিজেও session cookie), চালু থাকলে মোছা
async function rememberChoice(remember: boolean) {
  const jar = await cookies();
  if (remember) jar.delete(SESSION_ONLY_COOKIE);
  else jar.set(SESSION_ONLY_COOKIE, "1", { path: "/", sameSite: "lax", httpOnly: false });
}

// ---------- OTP পাঠানোর সীমা ----------
// একই নম্বরে ৩০ মিনিটে মোট ৩ বার (প্রথমবার আর ২ বার আবার)। গোনা হয় database এ (sms_logs), তাই cookie মুছে বা পাতা রিলোড
// করে এড়ানো যায় না। secret key না থাকলে সার্ভার গুনতে পারে না (তখন শুধু পাতার সীমা আর Supabase এর rate limit)
const OTP_MAX = 3;
const OTP_WINDOW_MS = 30 * 60 * 1000;

async function otpUsed(phone: string, purpose: string): Promise<number | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const since = new Date(Date.now() - OTP_WINDOW_MS).toISOString();
  const { count } = await admin.from("sms_logs").select("id", { count: "exact", head: true }).eq("phone", phone).eq("purpose", purpose).gte("created_at", since);
  return count ?? 0;
}
async function logOtp(phone: string, purpose: string, ok: boolean) {
  const admin = createAdminClient();
  if (!admin) return;
  await admin.from("sms_logs").insert({ phone, purpose, status: ok ? "sent" : "failed" });   // কোড নিজে কখনো রাখা হয় না
}
const TOO_MANY = "এই নম্বরে অনেকবার OTP পাঠানো হয়েছে। ৩০ মিনিট পরে আবার চেষ্টা করুন।";

// ---------- লগইন: আইডি বা মোবাইল + পাসওয়ার্ড ----------
const BAD_LOGIN = "আইডি/মোবাইল নম্বর বা পাসওয়ার্ড ঠিক নেই।";

// আইডি থেকে নম্বর বের করা হয় server এ, secret key দিয়ে (সবার নম্বর তালিকা বানানো যাতে না যায়, browser এ নম্বর যায় না)
async function loginPhone(raw: string): Promise<{ phone: string } | { fieldError: string; generic?: boolean }> {
  const code = normalizeUserCode(raw);
  if (code) {
    const admin = createAdminClient();
    if (!admin) return { fieldError: "আইডি দিয়ে লগইন এখনো চালু হয়নি, মোবাইল নম্বর দিন।" };
    const { data } = await admin.from("profiles").select("phone").eq("user_code", code).maybeSingle();
    return data?.phone ? { phone: data.phone } : { fieldError: BAD_LOGIN, generic: true };
  }
  const phone = normalizeBdPhone(raw);
  return phone ? { phone } : { fieldError: "অনুগ্রহ করে একটি সঠিক আইডি বা মোবাইল নম্বর দিন।" };
}

export async function passwordLogin(input: { identifier: string; password: string; remember: boolean; next: string }): Promise<AuthResult> {
  const identifier = String(input.identifier ?? "").trim();
  const password = String(input.password ?? "");
  const fieldErrors: Record<string, string> = {};
  if (!identifier) fieldErrors.identifier = "আইডি বা মোবাইল নম্বর আবশ্যক।";
  if (!password) fieldErrors.password = "পাসওয়ার্ড আবশ্যক।";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const r = await loginPhone(identifier);
  if ("fieldError" in r) return r.generic ? { error: r.fieldError } : { fieldErrors: { identifier: r.fieldError } };

  const supabase = await createClient({ sessionOnly: !input.remember });
  const { data, error } = await supabase.auth.signInWithPassword({ phone: e164(r.phone), password });
  if (error || !data.user) {
    if (error?.code === "phone_not_confirmed") return { error: "এই নম্বরের অ্যাকাউন্ট এখনো চালু হয়নি। সাইন আপ করে মোবাইলের OTP দিয়ে যাচাই করুন।" };
    if (error?.code === "over_request_rate_limit") return { error: "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।" };
    return { error: error?.code === "invalid_credentials" || !error ? BAD_LOGIN : "লগইন করা যায়নি, আবার চেষ্টা করুন।" };
  }
  await rememberChoice(!!input.remember);
  redirect(await finishLogin(supabase, data.user.id, safeNext(input.next)));
}

// ---------- সাইন আপ: তিন ধাপ ----------
function validateSignup(i: SignupInput) {
  const v = {
    full_name: String(i.full_name ?? "").replace(/\s+/g, " ").trim(),
    phone: String(i.phone ?? "").trim(),
    email: String(i.email ?? "").trim().toLowerCase(),
    password: String(i.password ?? ""),
    confirm: String(i.confirm ?? ""),
    guardian_phone: String(i.guardian_phone ?? "").trim(),
    institute: String(i.institute ?? "").replace(/\s+/g, " ").trim(),
    class_level: String(i.class_level ?? "").trim(),
  };
  const phone = normalizeBdPhone(v.phone);
  const guardian = normalizeBdPhone(v.guardian_phone);
  const e: Record<string, string> = {};
  // ধাপ ১
  if (v.full_name.length < 2) e.full_name = "পুরো নাম আবশ্যক।";
  else if (v.full_name.length > 80) e.full_name = "নাম ৮০ অক্ষরের মধ্যে লিখুন।";
  if (!isEmail(v.email)) e.email = "সঠিক ইমেইল আবশ্যক।";
  if (!phone) e.phone = "সঠিক ফোন নম্বর আবশ্যক।";
  if (v.password.length < PASSWORD_MIN) e.password = `পাসওয়ার্ড অন্তত ${"০১২৩৪৫৬৭৮৯"[PASSWORD_MIN]} অক্ষরের হতে হবে।`;
  else if (v.password !== v.confirm) e.confirm = "পাসওয়ার্ড মিলেনি।";
  // ধাপ ২
  if (!guardian) e.guardian_phone = "অভিভাবকের সঠিক মোবাইল নম্বর আবশ্যক।";
  else if (guardian === phone) e.guardian_phone = "অভিভাবকের নম্বর আপনার নিজের নম্বর থেকে আলাদা হতে হবে।";
  if (v.institute.length < 2) e.institute = "শিক্ষাপ্রতিষ্ঠানের নাম আবশ্যক।";
  else if (v.institute.length > 120) e.institute = "১২০ অক্ষরের মধ্যে লিখুন।";
  if (!CLASS_LEVELS.includes(v.class_level)) e.class_level = "শ্রেণি বেছে নিন।";
  const step1 = ["full_name", "email", "phone", "password", "confirm"].some((k) => e[k]);
  return { v, phone, guardian, errors: e, errorStep: (step1 ? 1 : 2) as 1 | 2 };
}

// সাইন আপের তথ্য, auth এর metadata তে: কোড মিলে অ্যাকাউন্ট চালু হলে database এর trigger এগুলো দিয়ে profile বানায়
const metadataOf = (v: SignupValues, guardian: string) => ({
  full_name: v.full_name, email: v.email, institute: v.institute, guardian_phone: guardian, class_level: v.class_level,
});

// ধাপ ২ এর "পরবর্তী": সব তথ্য যাচাই, অ্যাকাউন্ট (অচালু) খোলা আর মোবাইলে OTP পাঠানো
export async function startSignup(input: SignupInput): Promise<AuthResult> {
  const { v, phone, guardian, errors, errorStep } = validateSignup(input);
  if (Object.keys(errors).length || !phone || !guardian) return { fieldErrors: errors, step: errorStep };

  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin.from("profiles").select("id").eq("phone", phone).maybeSingle();
    if (data) return { fieldErrors: { phone: "এই নম্বরে আগেই অ্যাকাউন্ট আছে। লগইন করুন।" }, step: 1 };
  }
  const used = await otpUsed(phone, "signup_otp");
  if (used !== null && used >= OTP_MAX) return { error: TOO_MANY };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    phone: e164(phone),
    password: v.password,
    options: { channel: "sms", data: metadataOf(v, guardian) },
  });
  if (error) {
    if (error.code === "user_already_exists" || error.code === "phone_exists") return { fieldErrors: { phone: "এই নম্বরে আগেই অ্যাকাউন্ট আছে। লগইন করুন।" }, step: 1 };
    if (error.code === "weak_password") return { fieldErrors: { password: "আরও শক্ত পাসওয়ার্ড দিন।" }, step: 1 };
    await logOtp(phone, "signup_otp", false);
    return { error: sendError(error) };
  }
  await logOtp(phone, "signup_otp", true);
  return { ok: true, left: used === null ? undefined : Math.max(0, OTP_MAX - (used + 1)) };
}

// OTP আবার পাঠানো (৩ মিনিট পর পাতা বোতাম খোলে; সার্ভার সর্বোচ্চ ২ বার দেয়)
export async function resendSignupOtp(input: { phone: string }): Promise<AuthResult> {
  const phone = normalizeBdPhone(String(input.phone ?? ""));
  if (!phone) return { error: "মোবাইল নম্বর ঠিক নেই।" };
  const used = await otpUsed(phone, "signup_otp");
  if (used !== null && used >= OTP_MAX) return { error: "OTP আবার পাঠানোর সীমা শেষ।", left: 0 };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "sms", phone: e164(phone) });
  if (error) {
    await logOtp(phone, "signup_otp", false);
    return { error: sendError(error) };
  }
  await logOtp(phone, "signup_otp", true);
  return { ok: true, left: used === null ? undefined : Math.max(0, OTP_MAX - (used + 1)) };
}

// কোড মিললে অ্যাকাউন্ট চালু: profile আছে কিনা দেখা, এই ডিভাইস দাবি, এবারের তথ্য profile এ নিশ্চিত, স্বাগত বার্তার জন্য redirect
export async function completeSignup(input: { phone: string; code: string; next: string; values: SignupValues }): Promise<AuthResult> {
  const phone = normalizeBdPhone(String(input.phone ?? ""));
  const token = cleanOtp(String(input.code ?? ""));
  if (!phone) return { error: "মোবাইল নম্বর ঠিক নেই।" };
  if (!/^\d{6}$/.test(token)) return { fieldErrors: { code: "অনুগ্রহ করে সঠিক ৬-ডিজিটের কোড দিন।" } };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ phone: e164(phone), token, type: "sms" });
  if (error || !data.user) return { fieldErrors: { code: error ? verifyError(error) : "যাচাই হয়নি, আবার চেষ্টা করুন।" } };
  const r = await finishSignup(supabase, data.user.id, input.values, safeNext(input.next));
  if ("error" in r) return { error: r.error };
  await rememberChoice(true);
  redirect(r.to);
}

// কোড মিলে অ্যাকাউন্ট চালুর পর: profile এ এবারের তথ্য নিশ্চিত করা (আগে একবার কোড চেয়ে ছেড়ে দিলে metadata পুরনো থাকতে
// পারে), এই ডিভাইস দাবি, তারপর স্বাগত বার্তা (আইডিসহ)। আগে থেকেই অ্যাকাউন্ট থাকলে তার তথ্য বদলায় না, শুধু লগইন
async function finishSignup(supabase: SupabaseClient, uid: string, values: SignupValues, next: string) {
  const { data: profile } = await supabase.from("profiles").select("user_code, created_at").eq("id", uid).maybeSingle();
  if (!profile) return { error: "অ্যাকাউন্ট চালু হয়নি। আবার কোড চেয়ে চেষ্টা করুন।" };
  await claimThisDevice(supabase);
  const fresh = Date.now() - new Date(profile.created_at).getTime() < 10 * 60 * 1000;
  if (!fresh) return { to: withParams(next, { existing: "1" }) };
  const guardian = normalizeBdPhone(values.guardian_phone);
  const clean = (s: string, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const { error } = await supabase.from("profiles").update({
    full_name: clean(values.full_name, 80), email: clean(values.email, 120).toLowerCase(), institute: clean(values.institute, 120),
    guardian_phone: guardian, class_level: CLASS_LEVELS.includes(values.class_level) ? values.class_level : null,
  }).eq("id", uid);
  if (isSessionReplaced(error)) return { to: "/auth/replaced" };
  return { to: withParams(next, { welcome: profile.user_code }) };
}

// ---------- পাসওয়ার্ড ভুলে গেলে: শুধু মোবাইল নম্বর ----------
export async function sendResetOtp(input: { phone: string }): Promise<AuthResult> {
  const phone = normalizeBdPhone(String(input.phone ?? ""));
  if (!phone) return { fieldErrors: { phone: "অনুগ্রহ করে একটি সঠিক মোবাইল নম্বর দিন।" } };
  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin.from("profiles").select("id").eq("phone", phone).maybeSingle();
    if (!data) return { fieldErrors: { phone: "এই নম্বরে কোনো অ্যাকাউন্ট নেই।" } };
  }
  const used = await otpUsed(phone, "reset_otp");
  if (used !== null && used >= OTP_MAX) return { error: TOO_MANY };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone: e164(phone), options: { shouldCreateUser: false, channel: "sms" } });
  if (error) {
    await logOtp(phone, "reset_otp", false);
    if (error.code === "otp_disabled" || error.code === "user_not_found" || /signups not allowed/i.test(error.message)) return { fieldErrors: { phone: "এই নম্বরে কোনো অ্যাকাউন্ট নেই।" } };
    return { error: sendError(error) };
  }
  await logOtp(phone, "reset_otp", true);
  return { ok: true };
}

// কোড মিললে ব্রাউজারে একটা লগইন (session) তৈরি হয়; পরের ধাপে শুধু সেটা দিয়েই নতুন পাসওয়ার্ড বসে
export async function verifyResetOtp(input: { phone: string; code: string }): Promise<AuthResult> {
  const phone = normalizeBdPhone(String(input.phone ?? ""));
  const token = cleanOtp(String(input.code ?? ""));
  if (!phone) return { error: "মোবাইল নম্বর ঠিক নেই।" };
  if (!/^\d{6}$/.test(token)) return { fieldErrors: { code: "অনুগ্রহ করে সঠিক ৬-ডিজিটের কোড দিন।" } };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ phone: e164(phone), token, type: "sms" });
  if (error || !data.user) return { fieldErrors: { code: error ? verifyError(error) : "যাচাই হয়নি, আবার চেষ্টা করুন।" } };
  return { ok: true };
}

export async function setNewPassword(input: { password: string; confirm: string; next: string }): Promise<AuthResult> {
  const password = String(input.password ?? "");
  const e: Record<string, string> = {};
  if (password.length < PASSWORD_MIN) e.password = `পাসওয়ার্ড অন্তত ${"০১২৩৪৫৬৭৮৯"[PASSWORD_MIN]} অক্ষরের হতে হবে।`;
  else if (password !== String(input.confirm ?? "")) e.confirm = "পাসওয়ার্ড মিলেনি।";
  if (Object.keys(e).length) return { fieldErrors: e };

  const supabase = await createClient();
  const { data: who } = await supabase.auth.getUser();
  if (!who.user) return { error: "সময় শেষ হয়ে গেছে। আবার মোবাইল নম্বর দিয়ে OTP নিন।", step: 1 };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { fieldErrors: { password: "নতুন পাসওয়ার্ড আগেরটার মতো হতে পারবে না।" } };
    if (error.code === "weak_password") return { fieldErrors: { password: "আরও শক্ত পাসওয়ার্ড দিন।" } };
    return { error: "পাসওয়ার্ড বদলানো যায়নি: " + error.message };
  }
  await rememberChoice(true);
  redirect(await finishLogin(supabase, who.user.id, withParams(safeNext(input.next), { pwreset: "1" })));
}

// ---------- Google ----------
export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" }, // একাধিক Gmail থাকলে বেছে নেওয়ার সুযোগ
    },
  });
  if (error || !data.url) redirect("/sign-in?error=google");
  redirect(data.url);
}

// ---------- Google এর পর সাইন আপ শেষ করা (/onboarding) ----------
// একই তথ্য; নম্বরে কোড যায় (phone_change), মিললে নম্বর বসে আর database profile বানায়
function readSignup(formData: FormData, lockedEmail?: string | null): { values: SignupValues; errors: SignupState["fieldErrors"]; phone: string | null; guardian: string | null } {
  const values: SignupValues = {
    full_name: str(formData, "full_name").replace(/\s+/g, " "),
    phone: str(formData, "phone"),
    email: (lockedEmail ?? str(formData, "email")).toLowerCase(),
    guardian_phone: str(formData, "guardian_phone"),
    institute: str(formData, "institute").replace(/\s+/g, " "),
    class_level: str(formData, "class_level"),
  };
  const phone = normalizeBdPhone(values.phone);
  const guardian = normalizeBdPhone(values.guardian_phone);
  const errors: NonNullable<SignupState["fieldErrors"]> = {};
  if (values.full_name.length < 2) errors.full_name = "পুরো নাম লিখুন";
  else if (values.full_name.length > 80) errors.full_name = "নাম ৮০ অক্ষরের মধ্যে লিখুন";
  if (!phone) errors.phone = "সঠিক মোবাইল নম্বর দিন (যেমন ০১৭১২৩৪৫৬৭৮)";
  if (!isEmail(values.email)) errors.email = "সঠিক ইমেইল দিন";
  if (!guardian) errors.guardian_phone = "অভিভাবকের সঠিক মোবাইল নম্বর দিন";
  else if (guardian === phone) errors.guardian_phone = "অভিভাবকের নম্বর আপনার নিজের নম্বর থেকে আলাদা হতে হবে";
  if (values.institute.length < 2) errors.institute = "স্কুল, কলেজ বা প্রতিষ্ঠানের নাম লিখুন";
  else if (values.institute.length > 120) errors.institute = "১২০ অক্ষরের মধ্যে লিখুন";
  if (!CLASS_LEVELS.includes(values.class_level)) errors.class_level = "শ্রেণি বেছে নিন";
  return { values, errors, phone, guardian };
}

export async function sendLinkOtp(prev: SignupState, formData: FormData): Promise<SignupState> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/sign-in");
  const googleEmail = (claims.claims.email as string) || null;
  const resend = !!formData.get("resend");
  const { values, errors, phone, guardian } = resend
    ? { values: prev.values, errors: {}, phone: prev.phone ?? null, guardian: normalizeBdPhone(prev.values.guardian_phone) }
    : readSignup(formData, googleEmail);
  if (Object.keys(errors ?? {}).length || !phone || !guardian) return { step: "form", values, fieldErrors: errors, error: "কয়েকটা ঘর ঠিক করতে হবে" };
  const { error } = await supabase.auth.updateUser({ phone: e164(phone), data: metadataOf(values, guardian) });
  if (error) {
    if (error.code === "phone_exists") return { step: "form", values, exists: true, fieldErrors: { phone: "এই নম্বরে আগেই অ্যাকাউন্ট আছে" }, error: sendError(error) };
    return { ...prev, values, step: resend ? "code" : "form", error: sendError(error) };
  }
  return { step: "code", values, phone, sentAt: Date.now() };
}

export async function verifyLinkOtp(prev: SignupState, formData: FormData): Promise<SignupState> {
  const token = cleanOtp(str(formData, "code"));
  const next = safeNext(formData.get("next"));
  if (!prev.phone) return { ...prev, step: "form" };
  if (!/^\d{6}$/.test(token)) return { ...prev, error: undefined, fieldErrors: { code: "SMS এ আসা ৬ অঙ্কের কোড লিখুন" } };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ phone: e164(prev.phone), token, type: "phone_change" });
  if (error || !data.user) return { ...prev, fieldErrors: undefined, error: error?.code === "phone_exists" ? sendError(error) : error ? verifyError(error) : "যাচাই হয়নি" };
  const r = await finishSignup(supabase, data.user.id, prev.values, next);
  if ("error" in r) return { ...prev, error: r.error };
  redirect(r.to);
}

// ---------- পুরনো বা হাতে বানানো অ্যাকাউন্টে নাম ইত্যাদি বাকি থাকলে ----------
export async function saveProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    full_name: str(formData, "full_name").replace(/\s+/g, " "),
    institute: str(formData, "institute"),
    guardian_phone: str(formData, "guardian_phone"),
    class_level: str(formData, "class_level"),
  };
  const next = safeNext(formData.get("next"));
  const guardian = values.guardian_phone ? normalizeBdPhone(values.guardian_phone) : null;
  const fieldErrors: Record<string, string> = {};
  if (values.full_name.length < 2) fieldErrors.full_name = "পুরো নাম লিখুন";
  if (values.guardian_phone && !guardian) fieldErrors.guardian_phone = "অভিভাবকের সঠিক মোবাইল নম্বর দিন";
  if (values.class_level && !CLASS_LEVELS.includes(values.class_level)) fieldErrors.class_level = "শ্রেণি বেছে নিন";
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) redirect(`/sign-in?next=${encodeURIComponent("/onboarding")}`);
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: values.full_name, institute: values.institute || null, guardian_phone: guardian, class_level: values.class_level || null })
    .eq("id", uid);
  if (isSessionReplaced(error)) redirect("/auth/replaced");
  if (error) return { error: "সেভ হয়নি: " + error.message, values };
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  // শুধু এই ডিভাইস থেকে
  await supabase.auth.signOut({ scope: "local" });
  (await cookies()).delete(SESSION_ONLY_COOKIE);
  redirect("/");
}
