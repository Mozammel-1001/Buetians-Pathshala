"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSessionReplaced } from "@/lib/auth";
import { normalizeBdPhone, normalizeUserCode } from "@/lib/validation";

// এনরোলমেন্টের কাজ: মেয়াদ বাড়ানো, বাতিল (শুধু admin), হাতে-কলমে এনরোল। অনুমতি, কারণ লেখা আর audit_logs database এর function ই দেখে
export type EnrState = { ok?: boolean; error?: string; at?: number } | undefined;

const dhakaEnd = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T23:59:59+06:00`).toISOString() : null);

async function run(fn: (s: Awaited<ReturnType<typeof createClient>>) => PromiseLike<{ error: { code?: string; message: string } | null }>): Promise<EnrState> {
  const supabase = await createClient();
  const { error } = await fn(supabase);
  if (isSessionReplaced(error)) redirect("/auth/replaced");
  if (error) return { error: error.message, at: Date.now() };
  refresh();
  return { ok: true, at: Date.now() };
}

export async function extendEnrollment(_p: EnrState, f: FormData): Promise<EnrState> {
  const until = dhakaEnd(String(f.get("until") ?? ""));
  if (!until || Date.parse(until) < Date.now()) return { error: "ভবিষ্যতের একটা তারিখ দিন", at: Date.now() };
  return run((s) => s.rpc("extend_enrollment", { p_enrollment_id: Number(f.get("id")), p_expires_at: until }));
}

export async function revokeEnrollment(_p: EnrState, f: FormData): Promise<EnrState> {
  const reason = String(f.get("reason") ?? "").trim().slice(0, 300);
  if (reason.length < 3) return { error: "বাতিলের কারণ লিখুন", at: Date.now() };
  return run((s) => s.rpc("revoke_enrollment", { p_enrollment_id: Number(f.get("id")), p_reason: reason }));
}

export async function manualEnroll(_p: EnrState, f: FormData): Promise<EnrState> {
  const who = String(f.get("who") ?? "").trim();
  const note = String(f.get("note") ?? "").trim().slice(0, 300);
  if (!who) return { error: "শিক্ষার্থীর আইডি (BP-1001) বা মোবাইল নম্বর দিন", at: Date.now() };
  if (note.length < 3) return { error: "এনরোলের কারণ লিখুন (স্কলারশিপ, ক্যাশ পেমেন্ট ...)", at: Date.now() };
  const code = normalizeUserCode(who), phone = normalizeBdPhone(who);
  if (!code && !phone) return { error: "আইডি বা মোবাইল নম্বর ঠিক নেই", at: Date.now() };
  const supabase = await createClient();
  const { data: u } = await supabase.from("profiles").select("id").eq(code ? "user_code" : "phone", code ?? phone!).maybeSingle();
  if (!u) return { error: "এই আইডি/নম্বরে কোনো ইউজার নেই", at: Date.now() };
  const until = String(f.get("until") ?? "");
  const exp = until ? dhakaEnd(until) : null;
  if (until && !exp) return { error: "মেয়াদের তারিখ ঠিক নেই", at: Date.now() };
  return run((s) => s.rpc("manual_enroll", { p_user_id: u.id, p_course_id: Number(f.get("course")), p_expires_at: exp, p_note: note }));
}
