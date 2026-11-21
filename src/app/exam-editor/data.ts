import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/auth";
import type { Course, ExamRow, Kind, Pick, QImg, QKind, QRow } from "./lib";

// সম্পাদকের server দিকের তথ্য পড়া (RLS মেনে: admin সব কোর্সের, শিক্ষক নিজের কোর্সের পরীক্ষা)
export async function myCourses(supabase: SupabaseClient, me: Profile): Promise<Course[]> {
  if (me.role === "admin") {
    const { data } = await supabase.from("courses").select("id, title").order("position").order("id");
    return ((data ?? []) as { id: number; title: string }[]).map((c) => ({ id: c.id, name: c.title }));
  }
  const { data: ct } = await supabase.from("course_teachers").select("course_id").eq("teacher_id", me.id);
  const ids = (ct ?? []).map((x) => x.course_id as number);
  if (!ids.length) return [];
  const { data } = await supabase.from("courses").select("id, title").in("id", ids).order("id");
  return ((data ?? []) as { id: number; title: string }[]).map((c) => ({ id: c.id, name: c.title }));
}

type ExamDb = {
  id: number; course_id: number; title: string; kind: Kind; duration_minutes: number; negative_mark: number | string; opens_at: string | null; closes_at: string | null;
  pick_rules: Pick | null; shuffle: boolean; submit_on_hide: boolean; moderation_percent: number; recheck_days: number; is_published: boolean; created_by: string | null;
};
export const EXAM_COLS = "id, course_id, title, kind, duration_minutes, negative_mark, opens_at, closes_at, pick_rules, shuffle, submit_on_hide, moderation_percent, recheck_days, is_published, created_by";
const ms = (s: string | null) => (s ? Date.parse(s) : null);
export function toExam(e: ExamDb, courses: Map<number, string>, by: Map<string, string>): ExamRow {
  return {
    id: e.id, courseId: e.course_id, courseName: courses.get(e.course_id) ?? "কোর্স", title: e.title, kind: e.kind, minutes: e.duration_minutes, neg: Number(e.negative_mark),
    opens: ms(e.opens_at), closes: ms(e.closes_at), pick: e.pick_rules ?? {}, shuffle: e.shuffle, submitOnHide: e.submit_on_hide,
    moderation: e.moderation_percent, recheckDays: e.recheck_days, published: e.is_published, by: (e.created_by && by.get(e.created_by)) || "",
  };
}
export async function creators(supabase: SupabaseClient, ids: (string | null)[]) {
  const list = [...new Set(ids.filter((x): x is string => !!x))];
  const out = new Map<string, string>();
  if (!list.length) return out;
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", list);
  for (const p of (data ?? []) as { id: string; full_name: string }[]) out.set(p.id, p.full_name);
  return out;
}

type QDb = {
  id: number; kind: QKind; section: string; body: string; image_path: string | null; options: string[] | null; option_images: (string | null)[] | null;
  correct_option: number | null; explanation: string | null; scheme: string | null; chapter_id: number | null; marks: number | string; lock_options: boolean;
};
export const Q_COLS = "id, kind, section, body, image_path, options, option_images, correct_option, explanation, scheme, chapter_id, marks, lock_options";
// ছবির private bucket: দেখার জন্য ১ ঘণ্টার signed URL
export async function loadQuestions(supabase: SupabaseClient, examId: number): Promise<QRow[]> {
  const { data } = await supabase.from("exam_questions").select(Q_COLS).eq("exam_id", examId).order("position").order("id");
  const rows = (data ?? []) as QDb[];
  const paths = [...new Set(rows.flatMap((q) => [q.image_path, ...(q.option_images ?? [])]).filter((p): p is string => !!p))];
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("question-images").createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  const img = (p: string | null | undefined): QImg | null => (p && urls.has(p) ? { path: p, url: urls.get(p)! } : null);
  return rows.map((q) => ({
    id: q.id, kind: q.kind, section: q.section, body: q.body, image: img(q.image_path),
    options: q.options ?? [], optionImages: (q.options ?? []).map((_, i) => img(q.option_images?.[i])),
    key: q.correct_option, exp: q.explanation ?? "", scheme: q.scheme ?? "", chapterId: q.chapter_id, marks: Number(q.marks), lock: q.lock_options,
  }));
}
