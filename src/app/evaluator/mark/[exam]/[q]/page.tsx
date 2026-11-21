import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentRate, evMe, loadQuestions, loadSettings } from "../../../data";
import { qLabel } from "../../../lib";
import { BTN_GHOST, CARD, MUTED } from "../../../ui";
import { Marking } from "../../../marking";

export const metadata = { title: "খাতা কাটা" };

// একটা প্রশ্নের খাতা কাটা (evaluator_dashboard.html এর renderMarking)। খাতা নেওয়া browser থেকে (claimScript), তাই পাতা খোলা মানেই প্রথম খাতা হাতে
export default function Page({ params }: PageProps<"/evaluator/mark/[exam]/[q]">) {
  return (
    <Suspense fallback={<div className="h-60 animate-pulse rounded-3xl bg-surface-container dark:bg-white/5" />}>
      <Loaded params={params} />
    </Suspense>
  );
}

async function Loaded({ params }: { params: PageProps<"/evaluator/mark/[exam]/[q]">["params"] }) {
  const { exam, q } = await params;
  const examId = Number(exam), qid = Number(q);
  const me = await evMe(`/evaluator/mark/${exam}/${q}`);
  if (!Number.isInteger(examId) || examId < 1 || !Number.isInteger(qid) || qid < 1) notFound();
  const sb = await createClient();
  const { data: ex } = await sb.rpc("marking_exams");
  const e = ((ex ?? []) as { exam_id: number; title: string }[]).find((x) => Number(x.exam_id) === examId);
  if (!e) notFound();
  const [{ qs, error }, st, rate] = await Promise.all([loadQuestions(sb, examId), loadSettings(sb, examId), currentRate(sb)]);
  if (error) return <div className={`${CARD} max-w-2xl p-8`}><h3 className="text-xl font-bold text-on-background dark:text-background">{error}</h3><Link href={`/evaluator/mark/${examId}`} className={`${BTN_GHOST} mt-5`}>প্রশ্ন তালিকা</Link></div>;
  const item = qs.find((x) => x.id === qid);
  if (!item) notFound();
  return (
    <>
      <p className={`sr-only ${MUTED}`}>{e.title}</p>
      <Marking key={qid} examId={examId} examTitle={e.title} q={item} label={qLabel(item.no, item.section)} tolerance={st?.tolerance ?? 15} rate={rate} role={me.role} backHref={`/evaluator/mark/${examId}`} />
    </>
  );
}
