"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSessionReplaced } from "@/lib/auth";
import { loadCal, loadQProgress, type CalState } from "./data";

// খাতা মূল্যায়নের কাজ: খাতা নেওয়া, নম্বর দেওয়া, এড়িয়ে যাওয়া, ফেরত, চূড়ান্ত নম্বর, নমুনা, পুনর্মূল্যায়ন, ফল প্রকাশ।
// অনুমতি আর নিয়ম database এর function এ (can_mark_exam, can_manage_exam, claim_script, save_script_mark ...):
// এখানে শুধু ডাকা, খাতার ছবির signed URL বানানো আর database এর বাংলা বার্তা ফেরত দেওয়া
export type Fail = { ok?: false; error: string };
// AI এর খসড়া (আগে তৈরি থাকলে খাতার সাথেই আসে)
export type AiPart = { label: string; max: number; got: number; status: "correct" | "partial" | "wrong" | "missing"; comment: string };
export type AiDraft = { marks: number; parts: AiPart[]; comment: string };
export type Script = {
  attemptId: number; code: string; pages: string[]; returnReason: string | null; task: "mark" | "moderate" | "calibrate"; prevMarks: number | null; cal: { done: number; refs: number } | null; ai: AiDraft | null;
};
// এই প্রশ্নে এখনো কত বাকি (পাতার উপরে দেখানোর জন্য)
export type Left = { remaining: number; modLeft: number };
export type Next = ({ kind: "script"; script: Script } | { kind: "none" } | { kind: "blocked"; cal: CalState }) & { left: Left };

type Sb = Awaited<ReturnType<typeof me>>;
async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/sign-in");
  return supabase;
}
const fail = (error: string): Fail => ({ error });
// database এর বার্তা বাংলায় থাকে (raise exception), সেটাই দেখানো; বাকিগুলোতে সাধারণ বার্তা
function dbErr(e: { code?: string; message?: string }, fallback = "কাজটা হলো না, আবার চেষ্টা করুন") {
  if (isSessionReplaced(e)) redirect("/auth/replaced");
  if (e.message && /[ঀ-৿]/.test(e.message)) return e.message;
  if (e.code === "42501" || /row-level security/i.test(e.message ?? "")) return "এই কাজের অনুমতি নেই";
  return fallback;
}
const int = (v: unknown) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
const half = (v: unknown, max = 1000) => { const x = Number(v); return Number.isFinite(x) && x >= 0 && x <= max && x * 2 === Math.trunc(x * 2) ? x : null; };

// খাতার পাতার signed URL (private 'scripts' bucket, দেখার অনুমতি storage policy তে: script_page_readable)
async function signed(sb: Sb, paths: string[]) {
  if (!paths.length) return [] as string[];
  const { data } = await sb.storage.from("scripts").createSignedUrls(paths, 3600);
  const m = new Map((data ?? []).filter((s) => s.signedUrl && s.path).map((s) => [s.path as string, s.signedUrl]));
  return paths.map((p) => m.get(p) ?? "");
}

async function claim(sb: Sb, examId: number, qid: number, skip: number[]): Promise<Next | Fail> {
  const { data, error } = await sb.rpc("claim_script", { p_exam_id: examId, p_question_id: qid, p_skip: skip });
  const left = async (): Promise<Left> => { const p = (await loadQProgress(sb, examId)).find((x) => x.id === qid); return { remaining: p?.remaining ?? 0, modLeft: p?.modLeft ?? 0 }; };
  if (error) {
    if (/মেলেনি/.test(error.message)) return { kind: "blocked", cal: await loadCal(sb, qid), left: await left() };
    return fail(dbErr(error));
  }
  const r = ((data ?? []) as { attempt_id: number; script_code: string; pages: string[]; return_reason: string | null; task: Script["task"] }[])[0];
  if (!r) return { kind: "none", left: await left() };
  const [pages, prev, cal, ai, lf] = await Promise.all([
    signed(sb, r.pages ?? []),
    r.return_reason ? sb.from("script_marks").select("marks").eq("attempt_id", r.attempt_id).eq("question_id", qid).maybeSingle() : Promise.resolve({ data: null }),
    r.task === "calibrate" ? loadCal(sb, qid) : Promise.resolve(null),
    // আগে তৈরি AI খসড়া থাকলে (দ্বিতীয় যাচাই আর নমুনায় এটা দেখানো হয় না, database ও আটকায়)
    r.task === "mark" ? sb.rpc("ai_draft_context", { p_attempt_id: r.attempt_id, p_question_id: qid }) : Promise.resolve({ data: null }),
    left(),
  ]);
  const d = ((ai.data ?? []) as { draft: { marks: number | string; parts: AiPart[]; comment: string | null } | null }[])[0]?.draft;
  return {
    kind: "script", left: lf,
    script: {
      attemptId: Number(r.attempt_id), code: r.script_code, pages, returnReason: r.return_reason, task: r.task, prevMarks: prev.data?.marks != null ? Number(prev.data.marks) : null,
      cal: cal ? { done: cal.done, refs: cal.refs } : null, ai: d ? { marks: Number(d.marks), parts: d.parts ?? [], comment: d.comment ?? "" } : null,
    },
  };
}

// পরের খাতা নেওয়া (পাতা খোলার সময় আর "এড়িয়ে যাওয়া খাতা কাটুন" এ)
export async function claimScript(examId: number, qid: number, skip: number[] = []): Promise<Next | Fail> {
  const e = int(examId), q = int(qid);
  if (!e || !q) return fail("খাতা পাওয়া যায়নি");
  return claim(await me(), e, q, (skip ?? []).map(Number).filter((x) => Number.isInteger(x)).slice(0, 500));
}

export type Saved = { ok: true; pay: number; task: Script["task"]; cal: CalState | null; next: Next };
// নম্বর দেওয়া আর সাথে সাথে পরের খাতা। annotations = {"p1": [...], "p2": [...]} (পাতা ধরে লাল দাগ)
export async function saveMark(examId: number, qid: number, attemptId: number, task: Script["task"], marks: number, note: string, annotations: Record<string, unknown[]>, skip: number[]): Promise<Saved | Fail> {
  const e = int(examId), q = int(qid), a = int(attemptId);
  const v = half(marks);
  if (!e || !q || !a) return fail("খাতা পাওয়া যায়নি");
  if (v === null) return fail("নম্বর ০.৫ এর ঘরে হতে হবে");
  const ann = annotations && typeof annotations === "object" ? Object.fromEntries(Object.entries(annotations).filter(([k, x]) => /^p\d{1,2}$/.test(k) && Array.isArray(x) && x.length).slice(0, 20)) : {};
  if (JSON.stringify(ann).length > 300_000) return fail("দাগ বেশি হয়ে গেছে, কিছু মুছে আবার সংরক্ষণ করুন");
  const sb = await me();
  const { data, error } = await sb.rpc("save_script_mark", { p_attempt_id: a, p_question_id: q, p_marks: v, p_note: String(note ?? "").trim().slice(0, 500) || null, p_annotations: Object.keys(ann).length ? ann : null });
  if (error) return fail(dbErr(error));
  const cal = task === "calibrate" ? await loadCal(sb, q) : null;
  const next = await claim(sb, e, q, (skip ?? []).map(Number).filter((x) => Number.isInteger(x)).slice(0, 500));
  if ("error" in next) return fail(next.error);
  return { ok: true, pay: Number(data ?? 0), task, cal, next };
}

// "এড়িয়ে যান": খাতাটা ছেড়ে দিয়ে অন্যটা (এটা বাদে)
export async function skipScript(examId: number, qid: number, attemptId: number, skip: number[]): Promise<Next | Fail> {
  const e = int(examId), q = int(qid), a = int(attemptId);
  if (!e || !q || !a) return fail("খাতা পাওয়া যায়নি");
  const sb = await me();
  const { error } = await sb.rpc("release_script", { p_attempt_id: a, p_question_id: q });
  if (error) return fail(dbErr(error));
  return claim(sb, e, q, [...new Set([...(skip ?? []).map(Number), a])].filter((x) => Number.isInteger(x)).slice(0, 500));
}

// পাতা ছাড়ার সময় হাতে থাকা খাতা ছেড়ে দেওয়া (না করলেও ২০ মিনিট পর নিজে ছাড়ে)
export async function releaseScript(attemptId: number, qid: number): Promise<{ ok: true } | Fail> {
  const a = int(attemptId), q = int(qid);
  if (!a || !q) return { ok: true };
  const { error } = await (await me()).rpc("release_script", { p_attempt_id: a, p_question_id: q });
  return error ? fail(dbErr(error)) : { ok: true };
}

// কাটা খাতার পাতার ছবি (দেখুন modal এ, দরকার হলে তখন)
export async function signPages(paths: string[]): Promise<{ ok: true; urls: string[] } | Fail> {
  const list = (paths ?? []).filter((p) => typeof p === "string" && p.length < 300).slice(0, 20);
  return { ok: true, urls: await signed(await me(), list) };
}

// ---------- শিক্ষক আর অ্যাডমিন ----------
export async function returnScript(attemptId: number, qid: number, reason: string): Promise<{ ok: true } | Fail> {
  const a = int(attemptId), q = int(qid), why = String(reason ?? "").trim().slice(0, 300);
  if (!a || !q) return fail("খাতা পাওয়া যায়নি");
  if (!why) return fail("ফেরত দেওয়ার কারণ লিখুন");
  const { error } = await (await me()).rpc("return_script_mark", { p_attempt_id: a, p_question_id: q, p_reason: why });
  return error ? fail(dbErr(error)) : { ok: true };
}
export async function resolveFinal(attemptId: number, qid: number, marks: number, note: string): Promise<{ ok: true } | Fail> {
  const a = int(attemptId), q = int(qid), v = half(marks);
  if (!a || !q) return fail("খাতা পাওয়া যায়নি");
  if (v === null) return fail("নম্বর ০.৫ এর ঘরে হতে হবে");
  const { error } = await (await me()).rpc("resolve_moderation", { p_attempt_id: a, p_question_id: q, p_final: v, p_note: String(note ?? "").trim().slice(0, 500) || null });
  return error ? fail(dbErr(error)) : { ok: true };
}
export async function setRef(attemptId: number, qid: number, marks: number): Promise<{ ok: true } | Fail> {
  const a = int(attemptId), q = int(qid), v = half(marks);
  if (!a || !q) return fail("খাতা পাওয়া যায়নি");
  if (v === null) return fail("নম্বর ০.৫ এর ঘরে হতে হবে");
  const { error } = await (await me()).rpc("set_calibration_ref", { p_attempt_id: a, p_question_id: q, p_marks: v });
  return error ? fail(dbErr(error)) : { ok: true };
}
export async function removeRef(attemptId: number, qid: number): Promise<{ ok: true } | Fail> {
  const a = int(attemptId), q = int(qid);
  if (!a || !q) return fail("খাতা পাওয়া যায়নি");
  const { error } = await (await me()).rpc("remove_calibration_ref", { p_attempt_id: a, p_question_id: q });
  return error ? fail(dbErr(error)) : { ok: true };
}
export async function calDetail(userId: string, qid: number): Promise<{ ok: true; rows: { code: string; mine: number; teacher: number; within: boolean }[] } | Fail> {
  const q = int(qid);
  if (!q || !/^[0-9a-f-]{36}$/.test(String(userId))) return fail("তথ্য পাওয়া যায়নি");
  const { data, error } = await (await me()).rpc("calibration_detail", { p_user_id: userId, p_question_id: q });
  if (error) return fail(dbErr(error));
  return { ok: true, rows: ((data ?? []) as { script_code: string; marks: number | string; teacher_marks: number | string; within: boolean }[]).map((r) => ({ code: r.script_code, mine: Number(r.marks), teacher: Number(r.teacher_marks), within: !!r.within })) };
}
export async function approveCal(userId: string, qid: number): Promise<{ ok: true } | Fail> {
  const q = int(qid);
  if (!q || !/^[0-9a-f-]{36}$/.test(String(userId))) return fail("তথ্য পাওয়া যায়নি");
  const { error } = await (await me()).rpc("approve_calibration", { p_user_id: userId, p_question_id: q });
  return error ? fail(dbErr(error)) : { ok: true };
}
// পুনর্মূল্যায়নের আবেদন: newMarks = null হলে আবেদন গ্রহণ হয় না (কারণসহ)
export async function resolveRecheck(id: number, newMarks: number | null, reply: string): Promise<{ ok: true } | Fail> {
  const r = int(id), text = String(reply ?? "").trim().slice(0, 500);
  const v = newMarks === null ? null : half(newMarks);
  if (!r) return fail("আবেদন পাওয়া যায়নি");
  if (newMarks !== null && v === null) return fail("নম্বর ০.৫ এর ঘরে হতে হবে");
  if (text.length < 3) return fail("শিক্ষার্থীর জন্য উত্তর লিখুন");
  const { error } = await (await me()).rpc("resolve_recheck", { p_request_id: r, p_new_marks: v, p_reply: text });
  return error ? fail(dbErr(error)) : { ok: true };
}
export async function publishResults(examId: number): Promise<{ ok: true; students: number } | Fail> {
  const e = int(examId);
  if (!e) return fail("পরীক্ষা পাওয়া যায়নি");
  const { data, error } = await (await me()).rpc("publish_written_results", { p_exam_id: e });
  return error ? fail(dbErr(error)) : { ok: true, students: Number(data ?? 0) };
}
