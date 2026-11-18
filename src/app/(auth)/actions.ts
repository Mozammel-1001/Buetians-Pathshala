"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { AuthError, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimThisDevice, isSessionReplaced, safeNext, withParams } from "@/lib/auth";
import { CLASS_LEVELS, cleanOtp, e164, isEmail, maskPhone, normalizeBdPhone, normalizeUserCode, str } from "@/lib/validation";

// লগইন: আইডি (BP-1001) বা মোবাইল নম্বর, SMS এর কোডে। সাইন আপ আলাদা: সব তথ্য দিয়ে, নম্বরে কোড মিললে
// অ্যাকাউন্ট চালু (তখনই database আইডি দেয়), তারপর স্বাগত বার্তায় আইডি। Google: প্রথমবার /onboarding এ একই তথ্য
// আর নম্বর যাচাই

// ---------- ধরন ----------
export type LoginState = {
  step: "id" | "code";
  identifier?: string;   // যা দিয়ে লগইন: "BP-1001" বা "8801XXXXXXXXX" (আইডি হলে নম্বর browser এ আসে না)
  display?: string;      // কোন নম্বরে কোড গেল: পুরো নম্বর, আইডি হলে লুকানো (017•••••678)
  viaId?: boolean;
  sentAt?: number;
  error?: string;
  fieldError?: string;
  noAccount?: boolean;   // অ্যাকাউন্ট নেই → সাইন আপের লিংক
};

export type SignupValues = { full_name: string; phone: string; email: string; guardian_phone: string; institute: string; class_level: string };
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
      return "এই নম্বরে আগেই একটা অ্যাকাউন্ট আছে। লগআউট করে সেই নম্বর বা আইডি দিয়ে লগইন করুন।";
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
const noAccountError = (error: AuthError) => error.code === "otp_disabled" || error.code === "user_not_found" || /signups not allowed/i.test(error.message);

// নতুন লগইন জেতানো আর প্রোফাইল দেখা। profile না থাকলে (Google এর পর সাইন আপ অসম্পূর্ণ) আগে /onboarding
async function finishLogin(supabase: SupabaseClient, uid: string, next: string) {
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle();
  if (!profile) return withParams("/onboarding", { next });
  const { replaced } = await claimThisDevice(supabase);
  if (!profile.full_name.trim()) return withParams("/onboarding", { next, replaced: replaced ? "1" : null });
  return withParams(next, { replaced: replaced ? "1" : null });
}

// ---------- লগইন: আইডি বা মোবাইল ----------
// আইডি থেকে নম্বর বের করা হয় server এ, secret key দিয়ে (সবার নম্বর তালিকা বানানো যাতে না যায়, browser এ নম্বর যায় না)
async function resolveLogin(raw: string): Promise<{ phone: string; identifier: string; display: string; viaId: boolean } | { fieldError: string; noAccount?: boolean }> {
  const code = normalizeUserCode(raw);
  const admin = createAdminClient();
  if (code) {
    if (!admin) return { fieldError: "আইডি দিয়ে লগইন এখনো চালু হয়নি, মোবাইল নম্বর দিন" };
    const { data } = await admin.from("profiles").select("phone").eq("user_code", code).maybeSingle();
    if (!data?.phone) return { fieldError: `${code} আইডির কোনো অ্যাকাউন্ট নেই`, noAccount: true };
    return { phone: data.phone, identifier: code, display: maskPhone(data.phone), viaId: true };
  }
  const phone = normalizeBdPhone(raw);
  if (!phone) return { fieldError: "সঠিক মোবাইল নম্বর (০১XXXXXXXXX) বা আইডি (BP-1001) দিন" };
  if (admin) {
    const { data } = await admin.from("profiles").select("id").eq("phone", phone).maybeSingle();
    if (!data) return { fieldError: "এই নম্বরে কোনো অ্যাকাউন্ট নেই", noAccount: true };
  }
  return { phone, identifier: phone, display: "0" + phone.slice(3), viaId: false };
}

export async function sendLoginOtp(prev: LoginState, formData: FormData): Promise<LoginState> {
  const r = await resolveLogin(str(formData, "identifier"));
  if ("fieldError" in r) return { step: "id", fieldError: r.fieldError, noAccount: r.noAccount, identifier: str(formData, "identifier") };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone: e164(r.phone), options: { shouldCreateUser: false, channel: "sms" } });
  const base = { identifier: r.identifier, display: r.display, viaId: r.viaId };
  if (error) {
    if (noAccountError(error)) return { step: "id", ...base, fieldError: "এই নম্বরে কোনো অ্যাকাউন্ট নেই", noAccount: true };
    return { ...base, step: formData.get("resend") ? "code" : "id", sentAt: prev.sentAt, error: sendError(error) };
  }
  return { step: "code", ...base, sentAt: Date.now() };
}

export async function verifyLoginOtp(prev: LoginState, formData: FormData): Promise<LoginState> {
  const token = cleanOtp(str(formData, "code"));
  const next = safeNext(formData.get("next"));
  if (!/^\d{6}$/.test(token)) return { ...prev, step: "code", error: undefined, fieldError: "SMS এ আসা ৬ অঙ্কের কোড লিখুন" };
  const r = await resolveLogin(prev.identifier ?? "");
  if ("fieldError" in r) return { step: "id", fieldError: r.fieldError };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ phone: e164(r.phone), token, type: "sms" });
  if (error || !data.user) return { ...prev, step: "code", fieldError: undefined, error: error ? verifyError(error) : "লগইন হয়নি, আবার চেষ্টা করুন" };
  redirect(await finishLogin(supabase, data.user.id, next));
}

// ---------- সাইন আপ ----------
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

// সাইন আপের তথ্য, auth এর metadata তে: কোড মিললে database এর trigger এগুলো দিয়ে profile বানায়
const metadataOf = (v: SignupValues, guardian: string) => ({
  full_name: v.full_name, email: v.email, institute: v.institute, guardian_phone: guardian, class_level: v.class_level,
});

// কোড মিলে অ্যাকাউন্ট চালুর পর: profile এ এবারের তথ্য নিশ্চিত করা (আগে একবার কোড চেয়ে ছেড়ে দিলে metadata পুরনো থাকতে
// পারে), এই ডিভাইস দাবি, তারপর স্বাগত বার্তা (আইডিসহ)। আগে থেকেই অ্যাকাউন্ট থাকলে তার তথ্য বদলায় না, শুধু লগইন
async function finishSignup(supabase: SupabaseClient, uid: string, prev: SignupState, next: string) {
  const { data: profile } = await supabase.from("profiles").select("user_code, created_at").eq("id", uid).maybeSingle();
  if (!profile) return { error: "অ্যাকাউন্ট চালু হয়নি। আবার কোড চেয়ে চেষ্টা করুন।" };
  await claimThisDevice(supabase);
  const fresh = Date.now() - new Date(profile.created_at).getTime() < 10 * 60 * 1000;
  if (!fresh) return { to: withParams(next, { existing: "1" }) };
  const guardian = normalizeBdPhone(prev.values.guardian_phone);
  const { error } = await supabase.from("profiles").update({
    full_name: prev.values.full_name, email: prev.values.email, institute: prev.values.institute,
    guardian_phone: guardian, class_level: prev.values.class_level,
  }).eq("id", uid);
  if (isSessionReplaced(error)) return { to: "/auth/replaced" };
  return { to: withParams(next, { welcome: profile.user_code }) };
}

export async function sendSignupOtp(prev: SignupState, formData: FormData): Promise<SignupState> {
  const resend = !!formData.get("resend");
  const { values, errors, phone, guardian } = resend ? { ...prev, errors: {}, phone: prev.phone ?? null, guardian: normalizeBdPhone(prev.values.guardian_phone) } : readSignup(formData);
  if (Object.keys(errors ?? {}).length || !phone || !guardian) return { step: "form", values, fieldErrors: errors, error: "কয়েকটা ঘর ঠিক করতে হবে" };

  // নম্বরে আগেই (চালু) অ্যাকাউন্ট আছে কিনা: secret key থাকলে আগে দেখে নেওয়া
  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin.from("profiles").select("id").eq("phone", phone).maybeSingle();
    if (data) return { step: "form", values, exists: true, fieldErrors: { phone: "এই নম্বরে আগেই অ্যাকাউন্ট আছে" } };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone: e164(phone),
    options: { shouldCreateUser: true, channel: "sms", data: metadataOf(values, guardian) },
  });
  if (error) return { ...prev, values, step: resend ? "code" : "form", error: sendError(error) };
  return { step: "code", values, phone, sentAt: Date.now() };
}

export async function verifySignupOtp(prev: SignupState, formData: FormData): Promise<SignupState> {
  const token = cleanOtp(str(formData, "code"));
  const next = safeNext(formData.get("next"));
  if (!prev.phone) return { ...prev, step: "form" };
  if (!/^\d{6}$/.test(token)) return { ...prev, error: undefined, fieldErrors: { code: "SMS এ আসা ৬ অঙ্কের কোড লিখুন" } };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ phone: e164(prev.phone), token, type: "sms" });
  if (error || !data.user) return { ...prev, fieldErrors: undefined, error: error ? verifyError(error) : "যাচাই হয়নি, আবার চেষ্টা করুন" };
  const r = await finishSignup(supabase, data.user.id, prev, next);
  if ("error" in r) return { ...prev, error: r.error };
  redirect(r.to);
}

// ---------- Google এর পর সাইন আপ শেষ করা (/onboarding) ----------
// একই তথ্য; নম্বরে কোড যায় (phone_change), মিললে নম্বর বসে আর database profile বানায়
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
  const r = await finishSignup(supabase, data.user.id, prev, next);
  if ("error" in r) return { ...prev, error: r.error };
  redirect(r.to);
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
  redirect("/");
}
