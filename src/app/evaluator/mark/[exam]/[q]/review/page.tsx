import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { evMe, loadQuestions } from "../../../../data";
import { qLabel } from "../../../../lib";
import { BTN_GHOST } from "../../../../ui";
import { ReviewTable, type ScriptRow } from "../../../../review";
import type { AnnMap } from "../../../../annotate";

export const metadata = { title: "কাটা খাতা" };

// কাটা খাতার তালিকা (evaluator_dashboard.html এর renderReview)
export default function Page({ params }: PageProps<"/evaluator/mark/[exam]/[q]/review">) {
  return (
    <Suspense fallback={<div className="h-60 animate-pulse rounded-3xl bg-surface-container dark:bg-white/5" />}>
      <Loaded params={params} />
    </Suspense>
  );
}

async function Loaded({ params }: { params: PageProps<"/evaluator/mark/[exam]/[q]/review">["params"] }) {
  const { exam, q } = await params;
  const examId = Number(exam), qid = Number(q);
  const me = await evMe(`/evaluator/mark/${exam}/${q}/review`);
  if (!Number.isInteger(examId) || examId < 1 || !Number.isInteger(qid) || qid < 1) notFound();
  const sb = await createClient();
  const now = new Date().getTime();
  const [{ data: ex }, { qs }, { data }] = await Promise.all([sb.rpc("marking_exams"), loadQuestions(sb, examId), sb.rpc("marked_scripts", { p_exam_id: examId, p_question_id: qid })]);
  const e = ((ex ?? []) as { exam_id: number; title: string; results_published: boolean }[]).find((x) => Number(x.exam_id) === examId);
  const item = qs.find((x) => x.id === qid);
  if (!e || !item) notFound();
  const manager = me.role !== "evaluator";
  const rows = ((data ?? []) as { attempt_id: number; script_code: string; marks: number | string; note: string | null; marked_at: string; marker: string | null; moderation: string | null; second_marks: number | string | null; second_marker: string | null; first_marks: number | string | null; is_ref: boolean; pages: string[]; annotations: AnnMap | null }[])
    .map((r): ScriptRow => ({ attemptId: Number(r.attempt_id), code: r.script_code, marks: Number(r.marks), note: r.note ?? "", at: Date.parse(r.marked_at), marker: r.marker ?? "—", moderation: r.moderation, second: r.second_marks == null ? null : Number(r.second_marks), secondBy: r.second_marker, first: r.first_marks == null ? null : Number(r.first_marks), isRef: !!r.is_ref, pages: r.pages ?? [], ann: r.annotations }));
  return (
    <>
      <Link href={`/evaluator/mark/${examId}`} className={`${BTN_GHOST} mb-2 px-3! py-1.5! md:mb-4`}><span className="icon text-[18px]">arrow_back</span>প্রশ্ন তালিকা</Link>
      <ReviewTable examId={examId} qid={qid} qLabel={qLabel(item.no, item.section)} examTitle={e.title} full={item.marks} scheme={item.scheme} rows={rows} manager={manager} canReturn={manager && !e.results_published} evaluator={!manager} nowMs={now} />
    </>
  );
}
