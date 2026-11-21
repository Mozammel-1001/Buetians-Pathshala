"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSessionReplaced } from "@/lib/auth";

// লেকচারের পাতার নোট, বুকমার্ক আর "দেখা শেষ" (student_notes, bookmarks, lesson_progress; নিজের সারিই লেখা যায়, RLS দেখে)
export type LearnResult = { ok?: boolean; error?: string };

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) redirect("/sign-in");
  return { supabase, uid };
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function saveLessonNote(input: { lessonId: number; title: string; body: string; at: number }): Promise<LearnResult> {
  const title = input.title.trim().slice(0, 150), body = input.body.trim().slice(0, 20000);
  if (!title) return { error: "নোটের শিরোনাম ফাঁকা রাখা যাবে না।" };
  const { supabase, uid } = await me();
  // লেখা HTML হিসেবে রাখা হয় (নোটের পাতা যেভাবে দেখায়); নিরাপদ করে, প্রতি লাইন একটা অনুচ্ছেদ
  const content = body ? body.split(/\n/).map((l) => `<p>${esc(l)}</p>`).join("") : "<p></p>";
  const { error } = await supabase.from("student_notes").insert({ user_id: uid, lesson_id: input.lessonId, title, content, video_time_seconds: Math.max(0, Math.round(input.at)) || null });
  if (isSessionReplaced(error)) redirect("/auth/replaced");
  return error ? { error: "নোট সেভ হয়নি, আবার চেষ্টা করুন।" } : { ok: true };
}

export async function saveLessonBookmark(input: { lessonId: number; title: string; note: string }): Promise<LearnResult> {
  const tag = input.title.trim().slice(0, 12), note = input.note.trim().slice(0, 500) || null;
  if (!tag) return { error: "বুকমার্কের শিরোনাম আবশ্যক।" };
  const { supabase, uid } = await me();
  const { error } = await supabase.from("bookmarks").upsert({ user_id: uid, lesson_id: input.lessonId, tag, note });
  if (isSessionReplaced(error)) redirect("/auth/replaced");
  return error ? { error: "বুকমার্ক সেভ হয়নি, আবার চেষ্টা করুন।" } : { ok: true };
}

// ভিডিও শেষ হলে লেকচার "দেখা হয়েছে"
export async function markLessonDone(input: { lessonId: number; seconds: number }): Promise<LearnResult> {
  const { supabase, uid } = await me();
  const { error } = await supabase.from("lesson_progress").upsert({ user_id: uid, lesson_id: input.lessonId, watched_seconds: Math.max(0, Math.round(input.seconds)), completed: true, updated_at: new Date().toISOString() });
  return error ? { error: "অগ্রগতি সেভ হয়নি" } : { ok: true };
}
