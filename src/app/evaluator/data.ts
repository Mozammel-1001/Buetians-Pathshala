import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireProfile, type Profile } from "@/lib/auth";
import { sumProg, type EvRole, type ExamItem, type Kind, type Prog, type QItem, type QProg, type Settings } from "./lib";

// খাতা মূল্যায়নের পাতার server দিকের তথ্য পড়া। সব অনুমতি database এর function আর RLS এ (can_mark_exam, can_manage_exam):
// মূল্যায়নকারী আর admin সব পরীক্ষার, শিক্ষক নিজের কোর্সের লিখিত বা মিশ্র পরীক্ষার খাতা কাটেন

type Sb = SupabaseClient;
const n = (v: unknown) => Number(v ?? 0);

// মূল্যায়নকারী, শিক্ষক আর অ্যাডমিন; অন্য কেউ হলে ড্যাশবোর্ডে
export async function evMe(next: string): Promise<Profile & { role: EvRole }> {
  const me = await requireProfile(next);
  if (me.role !== "evaluator" && me.role !== "teacher" && me.role !== "admin") redirect("/dashboard");
  return me as Profile & { role: EvRole };
}

type ProgRow = { question_id: number; question_no: number; section: string | null; marks: number | string; scripts: number; marked: number; in_hand: number; returned: number; remaining: number; moderation_left: number; flagged: number; calibration_refs: number };
export const toQProg = (r: ProgRow): QProg => ({
  id: n(r.question_id), no: n(r.question_no), section: r.section ?? "", marks: n(r.marks), refs: n(r.calibration_refs),
  scripts: n(r.scripts), marked: n(r.marked), inHand: n(r.in_hand), returned: n(r.returned), remaining: n(r.remaining), modLeft: n(r.moderation_left), flagged: n(r.flagged),
});

// যেসব পরীক্ষার খাতা কাটা যায় (সময় শেষ, লিখিত অংশ আছে) অগ্রগতিসহ
export async function loadExams(sb: Sb, limit = 30): Promise<ExamItem[]> {
  const { data } = await sb.rpc("marking_exams");
  const rows = ((data ?? []) as { exam_id: number; title: string; course: string; kind: Kind; closes_at: string; results_published: boolean }[]).slice(0, limit);
  const progs = await Promise.all(rows.map((e) => sb.rpc("marking_progress", { p_exam_id: e.exam_id })));
  return rows.map((e, i) => ({
    id: n(e.exam_id), title: e.title, course: e.course, kind: e.kind, closesAt: Date.parse(e.closes_at), published: !!e.results_published,
    prog: sumProg(((progs[i].data ?? []) as ProgRow[]).map((r): Prog => toQProg(r))),
  }));
}

// সাইডবারের ব্যাজ: প্রকাশ না হওয়া পরীক্ষার কাটা বাকি খাতা (একটাই call)
export async function remainingCount(sb: Sb): Promise<number> {
  const { data } = await sb.rpc("marking_exams");
  return ((data ?? []) as { results_published: boolean; remaining: number }[]).filter((e) => !e.results_published).reduce((t, e) => t + n(e.remaining), 0);
}

// প্রশ্ন (সমাধান আর নম্বর বিভাজনসহ), পরীক্ষা শেষ হওয়ার পর। প্রশ্নের ছবি private bucket এর signed URL এ
export async function loadQuestions(sb: Sb, examId: number): Promise<{ qs: QItem[]; error: string | null }> {
  const { data, error } = await sb.rpc("marking_questions", { p_exam_id: examId });
  if (error) return { qs: [], error: error.message };
  const rows = (data ?? []) as { question_id: number; question_no: number; section: string | null; body: string; marks: number | string; solution: string | null; scheme: string | null; image_path: string | null }[];
  const paths = [...new Set(rows.map((r) => r.image_path).filter((p): p is string => !!p))];
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await sb.storage.from("question-images").createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.signedUrl && s.path) urls.set(s.path, s.signedUrl);
  }
  return {
    error: null,
    qs: rows.map((r) => ({ id: n(r.question_id), no: n(r.question_no), section: r.section ?? "", body: r.body, marks: n(r.marks), solution: r.solution ?? "", scheme: r.scheme ?? "", imageUrl: r.image_path ? urls.get(r.image_path) ?? null : null })),
  };
}

export async function loadQProgress(sb: Sb, examId: number): Promise<QProg[]> {
  const { data } = await sb.rpc("marking_progress", { p_exam_id: examId });
  return ((data ?? []) as ProgRow[]).map(toQProg);
}
// প্রশ্নভিত্তিক: আমি এখন কতগুলো খাতা পেতে পারি
export async function loadFree(sb: Sb, examId: number): Promise<Map<number, number>> {
  const { data } = await sb.rpc("marking_free", { p_exam_id: examId });
  return new Map(((data ?? []) as { question_id: number; free: number }[]).map((r) => [n(r.question_id), n(r.free)]));
}
export async function loadSettings(sb: Sb, examId: number): Promise<Settings | null> {
  const { data } = await sb.rpc("marking_settings", { p_exam_id: examId });
  const r = ((data ?? []) as { tolerance: number | string; moderation_percent: number; recheck_days: number; pick: Record<string, number> | null; kind: Kind }[])[0];
  return r ? { tolerance: n(r.tolerance), modPercent: n(r.moderation_percent), recheckDays: n(r.recheck_days), pick: r.pick ?? {}, kind: r.kind } : null;
}
// নতুন মূল্যায়নকারীর নমুনার অবস্থা (শিক্ষক আর admin এর দরকার নেই, তাই সেখানে "মিলেছে")
export type CalState = { required: boolean; cleared: boolean; refs: number; done: number; within: number; failed: boolean; feedback: { script_code: string; mine: number; teacher: number; within: boolean }[] | null };
export async function loadCal(sb: Sb, qid: number): Promise<CalState> {
  const { data } = await sb.rpc("my_calibration", { p_question_id: qid });
  const r = ((data ?? []) as { required: boolean; cleared: boolean; refs: number; done: number; within: number; failed: boolean; feedback: CalState["feedback"] }[])[0];
  return r ? { required: !!r.required, cleared: !!r.cleared, refs: n(r.refs), done: n(r.done), within: n(r.within), failed: !!r.failed, feedback: r.feedback ?? null } : { required: false, cleared: true, refs: 0, done: 0, within: 0, failed: false, feedback: null };
}

export async function currentRate(sb: Sb): Promise<number> {
  const { data } = await sb.rpc("current_marking_rate");
  return n(data);
}

// ---------- নোটিশ ----------
export type NoticeRow = { id: number; title: string; body: string; at: number; sms: boolean };
export async function loadNotices(sb: Sb, role: EvRole, limit = 30): Promise<NoticeRow[]> {
  // মূল্যায়নকারী আর admin: মূল্যায়নকারীদের নোটিশ। শিক্ষক: শিক্ষকদের নোটিশ (RLS যা দেখতে দেয়)
  const { data } = await sb.from("notices").select("id, title, body, created_at, channel").eq("audience", role === "teacher" ? "teachers" : "evaluators").neq("channel", "sms").order("created_at", { ascending: false }).limit(limit);
  return ((data ?? []) as { id: number; title: string | null; body: string; created_at: string; channel: string }[]).map((r) => ({ id: r.id, title: r.title ?? "নোটিশ", body: r.body, at: Date.parse(r.created_at), sms: false }));
}

// ---------- মান যাচাই (শিক্ষক আর অ্যাডমিন) ----------
export type Flagged = { attemptId: number; questionId: number; no: number; examId: number; examTitle: string; code: string; full: number; first: number; firstBy: string; second: number; secondBy: string; note: string; pages: string[] };
export type Recheck = {
  id: number; examId: number; exam: string; questionId: number; no: number; code: string; reason: string; old: number; full: number; at: number; pages: string[];
  marker: string; status: "pending" | "changed" | "unchanged" | "rejected"; newMarks: number | null; reply: string | null;
};
export type RefRow = { questionId: number; no: number; examId: number; examTitle: string; attemptId: number; code: string; marks: number };
export type CalRow = { userId: string; name: string; questionId: number; no: number; examId: number; examTitle: string; refs: number; done: number; within: number; status: "approved" | "failed" | "passed" | "in_progress" | "not_started" };
export type StatRow = { marker: string; role: string; questionId: number; no: number; scripts: number; avg: number; qAvg: number; secs: number; qSecs: number; moderated: number; flagged: number; returned: number; flags: string[] };

export async function loadQuality(sb: Sb, exams: ExamItem[]) {
  const per = await Promise.all(exams.map(async (e) => {
    const [mq, rf, cal] = await Promise.all([
      sb.rpc("moderation_queue", { p_exam_id: e.id }), sb.rpc("calibration_ref_list", { p_exam_id: e.id }), sb.rpc("calibration_overview", { p_exam_id: e.id }),
    ]);
    const flagged = ((mq.data ?? []) as { attempt_id: number; question_id: number; question_no: number; script_code: string; full_marks: number | string; first_marks: number | string; first_marker: string | null; second_marks: number | string; second_marker: string | null; note: string | null; pages: string[]; status: string }[])
      .filter((r) => r.status === "flagged")
      .map((r): Flagged => ({ attemptId: n(r.attempt_id), questionId: n(r.question_id), no: n(r.question_no), examId: e.id, examTitle: e.title, code: r.script_code, full: n(r.full_marks), first: n(r.first_marks), firstBy: r.first_marker ?? "—", second: n(r.second_marks), secondBy: r.second_marker ?? "—", note: r.note ?? "", pages: r.pages ?? [] }));
    const refs = ((rf.data ?? []) as { question_id: number; question_no: number; attempt_id: number; script_code: string; ref_marks: number | string }[])
      .map((r): RefRow => ({ questionId: n(r.question_id), no: n(r.question_no), examId: e.id, examTitle: e.title, attemptId: n(r.attempt_id), code: r.script_code, marks: n(r.ref_marks) }));
    const cals = ((cal.data ?? []) as { user_id: string; evaluator: string; question_id: number; question_no: number; refs: number; done: number; within: number; status: CalRow["status"] }[])
      .map((r): CalRow => ({ userId: r.user_id, name: r.evaluator, questionId: n(r.question_id), no: n(r.question_no), examId: e.id, examTitle: e.title, refs: n(r.refs), done: n(r.done), within: n(r.within), status: r.status }));
    return { flagged, refs, cals };
  }));
  const { data: rc } = await sb.rpc("recheck_queue", { p_exam_id: null });
  const rechecks = ((rc ?? []) as { request_id: number; exam_id: number; exam: string; question_id: number; question_no: number; script_code: string; reason: string; old_marks: number | string; full_marks: number | string; created_at: string; pages: string[]; marker: string | null; status: Recheck["status"]; new_marks: number | string | null; reply: string | null }[])
    .map((r): Recheck => ({ id: n(r.request_id), examId: n(r.exam_id), exam: r.exam, questionId: n(r.question_id), no: n(r.question_no), code: r.script_code, reason: r.reason, old: n(r.old_marks), full: n(r.full_marks), at: Date.parse(r.created_at), pages: r.pages ?? [], marker: r.marker ?? "—", status: r.status, newMarks: r.new_marks == null ? null : n(r.new_marks), reply: r.reply }));
  return { flagged: per.flatMap((p) => p.flagged), refs: per.flatMap((p) => p.refs), cals: per.flatMap((p) => p.cals), rechecks };
}

export async function loadStats(sb: Sb, examId: number): Promise<StatRow[]> {
  const { data } = await sb.rpc("marker_stats", { p_exam_id: examId });
  return ((data ?? []) as { marker: string; role: string; question_id: number; question_no: number; scripts: number; avg_percent: number | string; question_avg_percent: number | string; avg_seconds: number; question_avg_seconds: number; moderated: number; flagged: number; returned: number; flags: string[] | null }[])
    .map((r): StatRow => ({ marker: r.marker, role: r.role, questionId: n(r.question_id), no: n(r.question_no), scripts: n(r.scripts), avg: n(r.avg_percent), qAvg: n(r.question_avg_percent), secs: n(r.avg_seconds), qSecs: n(r.question_avg_seconds), moderated: n(r.moderated), flagged: n(r.flagged), returned: n(r.returned), flags: r.flags ?? [] }));
}

// ---------- সম্মানী ----------
export type LogRow = { at: number; exam: string; no: number; full: number; pay: number; status: "marked" | "returned"; task: "mark" | "moderate" };
export async function loadLedger(sb: Sb, uid: string, period: string) {
  const [led, log, pay] = await Promise.all([
    sb.rpc("teacher_ledger", { p_period: period }),
    sb.rpc("my_marking_log", { p_period: period }),
    sb.from("teacher_payouts").select("id, amount, method, reference, note, paid_at").eq("teacher_id", uid).eq("period", period).order("paid_at", { ascending: false }),
  ]);
  const l = ((led.data ?? []) as { teacher_id: string; scripts: number; marks_checked: number | string; marking_earned: number | string; earned: number | string; paid: number | string; due: number | string }[]).find((r) => r.teacher_id === uid);
  return {
    scripts: n(l?.scripts), marks: n(l?.marks_checked), marking: n(l?.marking_earned), earned: n(l?.earned), paid: n(l?.paid), due: n(l?.due),
    items: ((log.data ?? []) as { marked_at: string; exam: string; question_no: number; full_marks: number | string; pay_amount: number | string; status: LogRow["status"]; task: LogRow["task"] }[])
      .map((r): LogRow => ({ at: Date.parse(r.marked_at), exam: r.exam, no: n(r.question_no), full: n(r.full_marks), pay: n(r.pay_amount), status: r.status, task: r.task })),
    payouts: ((pay.data ?? []) as { id: number; amount: number | string; method: string; reference: string | null; note: string | null; paid_at: string }[]).map((p) => ({ id: p.id, amount: n(p.amount), method: p.method, ref: p.reference ?? "", note: p.note ?? "", at: Date.parse(p.paid_at) })),
  };
}
export type Ledger = Awaited<ReturnType<typeof loadLedger>>;

// ফেরত আসা খাতা (আমার কাটা, যেগুলো আবার কাটতে হবে)
export type Returned = { examId: number; exam: string; questionId: number; no: number; section: string; code: string; marks: number; reason: string; by: string };
export async function loadReturned(sb: Sb): Promise<Returned[]> {
  const { data } = await sb.rpc("my_returned_scripts");
  return ((data ?? []) as { exam_id: number; exam: string; question_id: number; question_no: number; section: string | null; script_code: string; marks: number | string; return_reason: string; returned_by: string | null }[])
    .map((r) => ({ examId: n(r.exam_id), exam: r.exam, questionId: n(r.question_id), no: n(r.question_no), section: r.section ?? "", code: r.script_code, marks: n(r.marks), reason: r.return_reason, by: r.returned_by ?? "" }));
}
