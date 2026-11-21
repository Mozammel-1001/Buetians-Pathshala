"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSessionReplaced } from "@/lib/auth";
import type { Kind, NewQ, Pick } from "./lib";

// প্রশ্নপত্র সম্পাদকের কাজ: পরীক্ষা তৈরি/বদল/মোছা/প্রকাশ, প্রশ্ন যোগ/বদল/মোছা/ক্রম।
// অনুমতি আর নিয়ম database এর (exams_insert/update policy, exam_publish_check, exam_paper_frozen):
// এখানে শুধু ঠিকঠাক তথ্য বানিয়ে পাঠানো আর database এর বাংলা বার্তা ফেরত দেওয়া
export type Res<T = object> = ({ ok: true } & T) | { ok?: false; error: string; field?: string };
const BUCKET = "question-images";

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/sign-in");
  return supabase;
}
const fail = (error: string, field?: string): { error: string; field?: string } => ({ error, field });
// database এর বার্তা বাংলায় (raise exception); নিয়ম ভাঙলে সেটাই, নইলে সাধারণ বার্তা
function dbErr(e: { code?: string; message?: string }, fallback: string) {
  if (isSessionReplaced(e)) redirect("/auth/replaced");
  if (e.message && /[ঀ-৿]/.test(e.message)) return e.message;
  if (e.code === "42501" || /row-level security/i.test(e.message ?? "")) return "এই কাজের অনুমতি নেই";
  return fallback;
}

export type ExamInput = {
  id?: number; title: string; course: number; kind: Kind; minutes: number; neg: number; opens: number | null; closes: number | null;
  shuffle: boolean; submitOnHide: boolean; moderation: number; recheckDays: number; pick: Pick;
};
const iso = (ms: number | null) => (ms == null ? null : new Date(ms).toISOString());

export async function saveExam(input: ExamInput): Promise<Res<{ id: number }>> {
  const title = String(input.title ?? "").trim();
  if (!title) return fail("পরীক্ষার নাম দিন", "title");
  if (!["mcq", "written", "mixed"].includes(input.kind)) return fail("পরীক্ষার ধরন বাছুন", "kind");
  const minutes = Number(input.minutes);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) return fail("সময় ১ থেকে ৬০০ মিনিটের মধ্যে দিন", "minutes");
  const opens = input.opens, closes = input.closes;
  if (opens !== null && closes !== null && closes <= opens) return fail("শেষের সময় শুরুর পরে হতে হবে", "closes");
  const neg = input.kind === "written" ? 0 : Number(input.neg || 0);
  if (!(neg >= 0 && neg <= 1)) return fail("ভুলে কাটা ০ থেকে ১ এর মধ্যে", "neg");
  const supabase = await me();
  const row = {
    title, kind: input.kind, duration_minutes: minutes, negative_mark: neg, opens_at: iso(opens), closes_at: iso(closes),
    pick_rules: input.kind === "mcq" ? {} : Object.fromEntries(Object.entries(input.pick ?? {}).filter(([, n]) => Number.isInteger(n) && n >= 1)),
    shuffle: input.shuffle !== false, submit_on_hide: input.kind === "mcq" && input.submitOnHide !== false,
    moderation_percent: Math.max(0, Math.min(100, Math.round(Number(input.moderation ?? 10)))), recheck_days: Math.max(0, Math.min(14, Math.round(Number(input.recheckDays ?? 3)))),
  };
  if (input.id) {
    const { data: old } = await supabase.from("exams").select("id, kind, course_id").eq("id", input.id).maybeSingle();
    if (!old) return fail("পরীক্ষা পাওয়া যায়নি");
    if (old.kind !== input.kind) {
      const { data: qs } = await supabase.from("exam_questions").select("kind").eq("exam_id", input.id);
      if ((qs ?? []).some((q) => (input.kind === "mcq" && q.kind === "written") || (input.kind === "written" && q.kind === "mcq")))
        return fail("এই ধরনের সাথে মেলে না এমন প্রশ্ন আছে, আগে সেগুলো সরান", "kind");
    }
    // প্রশ্ন বসানোর পর কোর্স বদলানো যায় না (অধ্যায় আর শিক্ষকের অনুমতি কোর্স ধরে)
    const { data: has } = input.course !== old.course_id ? await supabase.from("exam_questions").select("id").eq("exam_id", input.id).limit(1) : { data: [] };
    if (has?.length) return fail("প্রশ্ন বসানোর পর কোর্স বদলানো যায় না", "course");
    const { error } = await supabase.from("exams").update({ ...row, course_id: input.course }).eq("id", input.id);
    if (error) return fail(dbErr(error, "সংরক্ষণ হয়নি, আবার চেষ্টা করুন"));
    return { ok: true, id: input.id };
  }
  const { data, error } = await supabase.from("exams").insert({ ...row, course_id: input.course }).select("id").single();
  if (error) return fail(dbErr(error, "পরীক্ষা তৈরি হয়নি, আবার চেষ্টা করুন"), /row-level|অনুমতি/i.test(error.message) ? "course" : undefined);
  return { ok: true, id: data.id };
}

// ছবি মোছা: Storage এর ফাইলগুলো (না পারলে সমস্যা নেই, পরে পরিষ্কার করা যাবে)
async function dropFiles(supabase: Awaited<ReturnType<typeof me>>, paths: (string | null | undefined)[]) {
  const list = [...new Set(paths.filter((p): p is string => !!p))];
  if (!list.length) return;
  try { await supabase.storage.from(BUCKET).remove(list); } catch { /* ঠিক আছে */ }
}

export async function deleteExam(id: number): Promise<Res> {
  const supabase = await me();
  const { data: qs } = await supabase.from("exam_questions").select("image_path, option_images").eq("exam_id", id);
  const { data, error } = await supabase.from("exams").delete().eq("id", id).select("id");
  if (error) return fail(dbErr(error, "মোছা যায়নি"));
  if (!data?.length) return fail("প্রকাশিত পরীক্ষা মোছা যায় না, আগে প্রকাশ বন্ধ করুন");
  await dropFiles(supabase, (qs ?? []).flatMap((q) => [q.image_path, ...((q.option_images as (string | null)[] | null) ?? [])]));
  return { ok: true };
}

export async function setPublished(id: number, on: boolean): Promise<Res> {
  const supabase = await me();
  const { data, error } = await supabase.from("exams").update({ is_published: on }).eq("id", id).select("id");
  if (error) return fail(dbErr(error, on ? "প্রকাশ করা যায়নি" : "প্রকাশ বন্ধ করা যায়নি"));
  if (!data?.length) return fail("পরীক্ষা পাওয়া যায়নি বা অনুমতি নেই");
  return { ok: true };
}

// ---------- প্রশ্ন ----------
function cleanQuestion(q: NewQ, examKind: Kind) {
  if ((examKind === "mcq" && q.kind !== "mcq") || (examKind === "written" && q.kind !== "written")) return fail(`এই পরীক্ষায় ${q.kind === "mcq" ? "MCQ" : "লিখিত"} প্রশ্ন দেওয়া যায় না`, "kind");
  const body = String(q.body ?? "").trim(), marks = Number(q.marks);
  if (!body && !q.image) return fail("প্রশ্ন লিখুন বা ছবি দিন", "body");
  if (!(marks > 0 && marks <= 100) || marks * 2 !== Math.trunc(marks * 2)) return fail("নম্বর ০.৫ থেকে ১০০ এর মধ্যে, ০.৫ এর ঘরে", "marks");
  const base = { body, marks, chapter_id: q.chapterId || null, image_path: q.image || null, explanation: String(q.exp ?? "").trim() || null };
  if (q.kind === "mcq") {
    const options = (q.options ?? []).map((o) => String(o ?? "").trim()), imgs = (q.optionImages ?? []).slice(0, options.length);
    if (options.length < 2 || options.length > 6) return fail("অপশন ২ থেকে ৬টি দিন", "options");
    const empty = options.findIndex((o, i) => !o && !imgs[i]);
    if (empty >= 0) return fail(`অপশন ${"কখগঘঙচ"[empty]} খালি: লেখা বা ছবি দিন`, "options");
    if (!(Number.isInteger(q.key) && q.key! >= 0 && q.key! < options.length)) return fail("সঠিক উত্তর বাছুন", "key");
    return { ...base, kind: "mcq", section: "", options, correct_option: q.key, lock_options: !!q.lock, option_images: imgs.some(Boolean) ? options.map((_, i) => imgs[i] || null) : null, scheme: null };
  }
  const section = String(q.section ?? "").trim();
  if (!section) return fail("সেকশন দিন (যেমন সৃজনশীল)", "section");
  return { ...base, kind: "written", section, options: null, correct_option: null, lock_options: false, option_images: null, scheme: String(q.scheme ?? "").trim() || null };
}

export async function saveQuestions(examId: number, list: NewQ[]): Promise<Res<{ saved: number }>> {
  if (!list.length) return fail("কিছু লেখা হয়নি");
  const supabase = await me();
  const { data: ex } = await supabase.from("exams").select("id, kind").eq("id", examId).maybeSingle();
  if (!ex) return fail("পরীক্ষা পাওয়া যায়নি");
  const rows = [];
  for (const q of list) { const c = cleanQuestion(q, ex.kind as Kind); if ("error" in c) return c; rows.push(c); }
  // বদল (একটাই)
  if (list.length === 1 && list[0].id) {
    const { data: old } = await supabase.from("exam_questions").select("image_path, option_images").eq("id", list[0].id).eq("exam_id", examId).maybeSingle();
    if (!old) return fail("প্রশ্ন পাওয়া যায়নি");
    const { error } = await supabase.from("exam_questions").update(rows[0]).eq("id", list[0].id);
    if (error) return fail(dbErr(error, "প্রশ্ন সংরক্ষণ হয়নি"));
    const keep = new Set([rows[0].image_path, ...((rows[0].option_images as (string | null)[] | null) ?? [])]);
    await dropFiles(supabase, [old.image_path, ...((old.option_images as (string | null)[] | null) ?? [])].filter((p) => !keep.has(p)));
    return { ok: true, saved: 1 };
  }
  // যোগ: শেষ ক্রমের পরে
  const { data: last } = await supabase.from("exam_questions").select("position").eq("exam_id", examId).order("position", { ascending: false }).limit(1);
  let pos = (last?.[0]?.position ?? 0) + 1;
  const { error } = await supabase.from("exam_questions").insert(rows.map((r) => ({ ...r, exam_id: examId, position: pos++ })));
  if (error) return fail(dbErr(error, "প্রশ্ন যোগ হয়নি"));
  return { ok: true, saved: rows.length };
}

export async function deleteQuestion(examId: number, qid: number): Promise<Res> {
  const supabase = await me();
  const { data: old } = await supabase.from("exam_questions").select("image_path, option_images").eq("id", qid).eq("exam_id", examId).maybeSingle();
  const { data, error } = await supabase.from("exam_questions").delete().eq("id", qid).eq("exam_id", examId).select("id");
  if (error) return fail(dbErr(error, "মোছা যায়নি"));
  if (!data?.length) return fail("প্রশ্ন পাওয়া যায়নি");
  await dropFiles(supabase, [old?.image_path, ...((old?.option_images as (string | null)[] | null) ?? [])]);
  return { ok: true };
}

// প্রশ্ন উপরে/নিচে: ক্রম (position) নতুন করে বসে
export async function moveQuestion(examId: number, qid: number, dir: -1 | 1): Promise<Res> {
  const supabase = await me();
  const { data } = await supabase.from("exam_questions").select("id, position").eq("exam_id", examId).order("position").order("id");
  const list = data ?? [];
  const i = list.findIndex((x) => x.id === qid), j = i + dir;
  if (i < 0) return fail("প্রশ্ন পাওয়া যায়নি");
  if (j < 0 || j >= list.length) return { ok: true };
  [list[i], list[j]] = [list[j], list[i]];
  const changed = list.map((x, k) => ({ id: x.id, from: x.position, to: k + 1 })).filter((x) => x.from !== x.to);
  const rs = await Promise.all(changed.map((x) => supabase.from("exam_questions").update({ position: x.to }).eq("id", x.id)));
  const bad = rs.find((r) => r.error);
  return bad?.error ? fail(dbErr(bad.error, "ক্রম বদলানো যায়নি")) : { ok: true };
}

