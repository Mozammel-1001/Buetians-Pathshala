import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireProfile, type Profile } from "@/lib/auth";

// শিক্ষকের ড্যাশবোর্ডের server দিকের তথ্য পড়া। অনুমতি database এর RLS আর function এ
// (teaches, can_answer_qa, materials_write): এখানে শুধু নিজের কোর্সের তথ্য আনা
type Sb = SupabaseClient;
const n = (v: unknown) => Number(v ?? 0);

// শুধু শিক্ষক; অন্য কেউ হলে ড্যাশবোর্ডে
export async function tMe(next: string): Promise<Profile> {
  const me = await requireProfile(next);
  if (me.role !== "teacher") redirect("/dashboard");
  return me;
}

export type Chapter = { id: number; title: string };
export type TCourse = { id: number; title: string; batch: string; thumb: string | null; badge: string | null; students: number; modules: number; totalModules: number; lessons: number; chapters: Chapter[] };

// আমার কোর্স (course_teachers), শিক্ষার্থী সংখ্যা, অধ্যায়, "আপলোডকৃত মডিউল" = লেকচার আছে এমন অধ্যায় / মোট অধ্যায়
export async function loadCourses(sb: Sb, uid: string): Promise<TCourse[]> {
  const { data: ct } = await sb.from("course_teachers").select("course_id").eq("teacher_id", uid);
  const ids = ((ct ?? []) as { course_id: number }[]).map((x) => x.course_id);
  if (!ids.length) return [];
  const [cs, ch, ls, ens] = await Promise.all([
    sb.from("courses").select("id, title, batch_name, thumbnail_url, badge, position").in("id", ids).order("position").order("id"),
    sb.from("chapters").select("id, course_id, title, position").in("course_id", ids).order("position").order("id"),
    sb.from("lessons").select("id, course_id, chapter_id").in("course_id", ids),
    Promise.all(ids.map((id) => sb.from("enrollments").select("id", { count: "exact", head: true }).eq("course_id", id).eq("status", "active"))),
  ]);
  const students = new Map(ids.map((id, i) => [id, ens[i].count ?? 0]));
  const chapters = (ch.data ?? []) as { id: number; course_id: number; title: string }[];
  const lessons = (ls.data ?? []) as { course_id: number; chapter_id: number | null }[];
  return ((cs.data ?? []) as { id: number; title: string; batch_name: string | null; thumbnail_url: string | null; badge: string | null }[]).map((c) => {
    const mine = chapters.filter((x) => x.course_id === c.id), ls2 = lessons.filter((x) => x.course_id === c.id);
    const withLesson = new Set(ls2.map((x) => x.chapter_id).filter((x): x is number => x != null));
    return { id: c.id, title: c.title, batch: c.batch_name ?? "", thumb: c.thumbnail_url, badge: c.badge, students: students.get(c.id) ?? 0, modules: mine.filter((x) => withLesson.has(x.id)).length, totalModules: mine.length, lessons: ls2.length, chapters: mine.map((x) => ({ id: x.id, title: x.title })) };
  });
}

// উত্তর বাকি প্রশ্নের সংখ্যা (আমার কোর্সের পড়াশোনার প্রশ্ন)
export async function pendingQa(sb: Sb, courseIds: number[]): Promise<number> {
  if (!courseIds.length) return 0;
  const { count } = await sb.from("qa_questions").select("id", { count: "exact", head: true }).eq("kind", "study").in("course_id", courseIds).is("answered_at", null);
  return count ?? 0;
}

// ---------- প্রশ্নোত্তর ----------
export type Answer = { id: number; body: string; by: string; role: "teacher" | "admin" | "manager"; at: number };
export type QaItem = { id: number; courseId: number; course: string; chapter: string; asker: string; body: string; at: number; answers: Answer[] };
export async function loadQa(sb: Sb, courses: TCourse[]): Promise<QaItem[]> {
  const per = await Promise.all(courses.map((c) => sb.rpc("qa_feed", { p_course_id: c.id, p_kind: "study" })));
  return courses.flatMap((c, i) => ((per[i].data ?? []) as { id: number; chapter_id: number | null; body: string; asker: string; created_at: string; answers: { id: number; body: string; by: string; role: string; created_at: string }[] }[]).map((r): QaItem => ({
    id: n(r.id), courseId: c.id, course: c.title, chapter: c.chapters.find((x) => x.id === r.chapter_id)?.title ?? "সাধারণ প্রশ্ন", asker: r.asker, body: r.body, at: Date.parse(r.created_at),
    answers: (r.answers ?? []).map((a): Answer => ({ id: n(a.id), body: a.body, by: a.by, role: (a.role === "admin" || a.role === "manager" ? a.role : "teacher"), at: Date.parse(a.created_at) })),
  })));
}
export type Reminder = { id: number; qid: number; note: string; by: string; role: "admin" | "manager"; sms: boolean; at: number; read: boolean; question: string; answered: boolean };
export async function loadReminders(sb: Sb): Promise<Reminder[]> {
  const { data } = await sb.rpc("my_qa_reminders");
  return ((data ?? []) as { id: number; question_id: number; note: string; by_name: string | null; by_role: string | null; via_sms: boolean; created_at: string; read_at: string | null; question: string; answered: boolean }[])
    .map((r): Reminder => ({ id: n(r.id), qid: n(r.question_id), note: r.note, by: r.by_name ?? "অ্যাডমিন", role: r.by_role === "manager" ? "manager" : "admin", sms: !!r.via_sms, at: Date.parse(r.created_at), read: !!r.read_at, question: r.question, answered: !!r.answered }));
}

// ---------- লাইভ ক্লাস ----------
export type LiveRow = { id: string; courseId: number; course: string; title: string; status: "scheduled" | "live" | "ended"; at: number | null; peak: number; startedAt: number | null };
export async function loadLive(sb: Sb, uid: string, courses: TCourse[], sinceMs: number): Promise<LiveRow[]> {
  if (!courses.length) return [];
  const { data } = await sb.from("live_sessions").select("id, course_id, title, status, scheduled_at, started_at, peak_viewers").eq("teacher_id", uid).or(`status.neq.ended,started_at.gte.${new Date(sinceMs).toISOString()}`).order("scheduled_at", { ascending: true });
  const name = new Map(courses.map((c) => [c.id, c.title]));
  return ((data ?? []) as { id: string; course_id: number; title: string; status: LiveRow["status"]; scheduled_at: string | null; started_at: string | null; peak_viewers: number }[])
    .map((r): LiveRow => ({ id: r.id, courseId: r.course_id, course: name.get(r.course_id) ?? "কোর্স", title: r.title, status: r.status, at: r.scheduled_at ? Date.parse(r.scheduled_at) : null, peak: n(r.peak_viewers), startedAt: r.started_at ? Date.parse(r.started_at) : null }));
}

// ---------- কোর্সের কন্টেন্ট ----------
export type ContentItem = { key: string; kind: "material" | "lesson"; id: number; courseId: number; course: string; title: string; sub: string; at: number; mkind?: string };
const MKIND: Record<string, string> = { sheet: "লেকচার শিট", bank: "প্রশ্নব্যাংক", solution: "সমাধান", formula: "সূত্র ও সারসংক্ষেপ" };
export async function loadContent(sb: Sb, courses: TCourse[]): Promise<ContentItem[]> {
  const ids = courses.map((c) => c.id);
  if (!ids.length) return [];
  const [m, l] = await Promise.all([
    sb.from("study_materials").select("id, course_id, kind, title, page_count, size_bytes, created_at").in("course_id", ids).order("created_at", { ascending: false }),
    sb.from("lessons").select("id, course_id, title, video_status, duration_seconds, created_at").in("course_id", ids).order("created_at", { ascending: false }),
  ]);
  const name = new Map(courses.map((c) => [c.id, c.title]));
  const mb = (b: number | null) => (b ? ((b / 1048576).toFixed(1)) : "");
  const items: ContentItem[] = [
    ...((m.data ?? []) as { id: number; course_id: number; kind: string; title: string; page_count: number | null; size_bytes: number | null; created_at: string }[]).map((r): ContentItem => ({ key: "m" + r.id, kind: "material", id: r.id, courseId: r.course_id, course: name.get(r.course_id) ?? "", title: r.title, sub: `${MKIND[r.kind] ?? "ম্যাটেরিয়াল"} • পিডিএফ${r.size_bytes ? ` (${mb(r.size_bytes)} MB)` : ""}${r.page_count ? ` • ${r.page_count} পৃষ্ঠা` : ""}`, at: Date.parse(r.created_at), mkind: r.kind })),
    ...((l.data ?? []) as { id: number; course_id: number; title: string; video_status: string; duration_seconds: number | null; created_at: string }[]).map((r): ContentItem => ({ key: "l" + r.id, kind: "lesson", id: r.id, courseId: r.course_id, course: name.get(r.course_id) ?? "", title: r.title, sub: `রেকর্ডেড ক্লাস • ভিডিও${r.duration_seconds ? ` (${Math.round(r.duration_seconds / 60)} মিনিট)` : ""}${r.video_status === "ready" ? "" : " • প্রস্তুত হচ্ছে"}`, at: Date.parse(r.created_at) })),
  ];
  return items.sort((a, b) => b.at - a.at);
}
