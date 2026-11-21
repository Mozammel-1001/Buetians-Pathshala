"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSessionReplaced } from "@/lib/auth";

// শিক্ষকের কাজ: ম্যাটেরিয়াল যোগ/মোছা, প্রশ্নের উত্তর, রিমাইন্ডার পড়া হয়েছে।
// অনুমতি database এর RLS আর function এ (materials_write, can_answer_qa, mark_notifications_read)
export type Res<T = object> = ({ ok: true } & T) | { ok?: false; error: string };
async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/sign-in");
  return supabase;
}
const fail = (error: string): { error: string } => ({ error });
function dbErr(e: { code?: string; message?: string }, fallback = "কাজটা হলো না, আবার চেষ্টা করুন") {
  if (isSessionReplaced(e)) redirect("/auth/replaced");
  if (e.message && /[ঀ-৿]/.test(e.message)) return e.message;
  if (e.code === "42501" || /row-level security/i.test(e.message ?? "")) return "এই কাজের অনুমতি নেই";
  return fallback;
}

// ফাইল browser থেকে Storage এ যাওয়ার পর এখানে তথ্যের সারি। path = <course_id>/<uuid>.pdf
export async function addMaterial(input: { courseId: number; chapterId: number | null; kind: string; title: string; path: string; pages: number | null; bytes: number }): Promise<Res<{ id: number }>> {
  const title = String(input.title ?? "").trim().slice(0, 120);
  if (!["sheet", "bank", "solution", "formula"].includes(input.kind)) return fail("ধরন বেছে নিন");
  if (!title) return fail("শিরোনাম দিন");
  if (!Number.isInteger(input.courseId) || !new RegExp(`^${input.courseId}/[0-9a-f-]{36}\\.pdf$`).test(String(input.path))) return fail("ফাইল ঠিক নেই");
  if (!Number.isFinite(input.bytes) || input.bytes < 1 || input.bytes > 52428800) return fail("ফাইল ৫০ MB এর বেশি");
  const sb = await me();
  const { data, error } = await sb.from("study_materials").insert({
    course_id: input.courseId, chapter_id: input.chapterId, kind: input.kind, title, storage_path: input.path,
    page_count: input.pages && input.pages > 0 ? Math.round(input.pages) : null, size_bytes: Math.round(input.bytes),
  }).select("id").single();
  if (error) return fail(dbErr(error));
  return { ok: true, id: data.id as number };
}

export async function deleteMaterial(id: number): Promise<Res> {
  if (!Number.isInteger(id) || id < 1) return fail("কন্টেন্ট পাওয়া যায়নি");
  const sb = await me();
  const { data: row } = await sb.from("study_materials").select("storage_path").eq("id", id).maybeSingle();
  if (!row) return fail("কন্টেন্ট পাওয়া যায়নি");
  const { error } = await sb.from("study_materials").delete().eq("id", id);
  if (error) return fail(dbErr(error));
  await sb.storage.from("materials").remove([row.storage_path as string]);   // ফাইলও যায় (না গেলে সারি আগেই গেছে)
  return { ok: true };
}

// প্রশ্নের উত্তর। উত্তর এলে প্রশ্নকারীকে নোটিফিকেশন যায় (trigger)
export async function answerQuestion(qid: number, body: string): Promise<Res> {
  const text = String(body ?? "").trim().slice(0, 4000);
  if (!Number.isInteger(qid) || qid < 1) return fail("প্রশ্নটা আর নেই");
  if (text.length < 2) return fail("উত্তর লিখুন");
  const { error } = await (await me()).from("qa_answers").insert({ question_id: qid, body: text });
  if (error) return fail(dbErr(error, "প্রশ্নটা আর নেই (মুছে ফেলা হয়েছে)"));
  return { ok: true };
}

export async function markRemindersRead(): Promise<Res> {
  const { error } = await (await me()).rpc("mark_notifications_read");
  return error ? fail(dbErr(error)) : { ok: true };
}
