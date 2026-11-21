"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSessionReplaced } from "@/lib/auth";

// কোর্সের পাতার "ভর্তি নিয়ে প্রশ্ন" (qa_questions, kind = enrollment): লগইন করা যে কেউ প্রশ্ন করতে পারে,
// উত্তর দেন ম্যানেজার বা অ্যাডমিন। উত্তর আসার আগে প্রশ্ন শুধু প্রশ্নকারী দেখেন, আর নিজে মুছতে পারেন (database এর RLS দেখে)
export type AskState = { ok?: boolean; error?: string; at?: number } | undefined;

export async function askInquiry(_p: AskState, f: FormData): Promise<AskState> {
  const body = String(f.get("body") ?? "").trim();
  if (body.length < 10) return { error: "প্রশ্নটা অন্তত ১০ অক্ষরের লিখুন", at: Date.now() };
  if (body.length > 2000) return { error: "প্রশ্ন ২০০০ অক্ষরের মধ্যে লিখুন", at: Date.now() };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { error: "প্রশ্ন করতে লগইন করুন", at: Date.now() };
  const { error } = await supabase.from("qa_questions").insert({ course_id: Number(f.get("course_id")), kind: "enrollment", body });
  if (isSessionReplaced(error)) redirect("/auth/replaced");
  if (error) return { error: "প্রশ্ন পাঠানো যায়নি, আবার চেষ্টা করুন", at: Date.now() };
  refresh();
  return { ok: true, at: Date.now() };
}

export async function deleteInquiry(_p: AskState, f: FormData): Promise<AskState> {
  const supabase = await createClient();
  const { data: hit, error } = await supabase.from("qa_questions").delete().eq("id", Number(f.get("id"))).select();
  if (isSessionReplaced(error)) redirect("/auth/replaced");
  if (error || !hit?.length) return { error: "মোছা যায়নি (উত্তর এসে গেলে আর মোছা যায় না)", at: Date.now() };
  refresh();
  return { ok: true, at: Date.now() };
}
