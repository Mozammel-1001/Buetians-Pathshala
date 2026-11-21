import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Tex } from "@/app/practice/ui";
import { currentRate, evMe, loadCal, loadFree, loadQProgress, loadQuestions, loadSettings, type CalState } from "../../data";
import { ago, bn, qLabel, sumProg, taka } from "../../lib";
import { Badge, BTN_GHOST, BTN_PRI, CARD, KIND, Legend, MUTED, ProgressBar } from "../../ui";
import { PublishButton } from "../../publish-button";

export const metadata = { title: "প্রশ্ন বেছে নিন" };

// একটা পরীক্ষার প্রশ্নের তালিকা (evaluator_dashboard.html এর renderQuestions): প্রশ্নভিত্তিক অগ্রগতি, নমুনা, কাটা শুরু
export default function Page({ params }: PageProps<"/evaluator/mark/[exam]">) {
  return (
    <Suspense fallback={<div className="h-60 animate-pulse rounded-3xl bg-surface-container dark:bg-white/5" />}>
      <Loaded params={params} />
    </Suspense>
  );
}

async function Loaded({ params }: { params: PageProps<"/evaluator/mark/[exam]">["params"] }) {
  const { exam: raw } = await params;
  const examId = Number(raw);
  const me = await evMe(`/evaluator/mark/${raw}`);
  if (!Number.isInteger(examId) || examId < 1) notFound();
  const sb = await createClient();
  const now = new Date().getTime();
  const manager = me.role !== "evaluator";
  const { data: ex } = await sb.rpc("marking_exams");
  const e = ((ex ?? []) as { exam_id: number; title: string; course: string; kind: string; closes_at: string; results_published: boolean }[]).find((x) => Number(x.exam_id) === examId);
  if (!e) notFound();
  const [qp, free, st, rate] = await Promise.all([loadQProgress(sb, examId), loadFree(sb, examId).catch(() => new Map<number, number>()), loadSettings(sb, examId), currentRate(sb)]);
  // নতুন মূল্যায়নকারীর নমুনার অবস্থা (শিক্ষক আর অ্যাডমিনের লাগে না)
  const cals = new Map<number, CalState>(await Promise.all(qp.map(async (q) => [q.id, manager ? { required: false, cleared: true, refs: q.refs, done: 0, within: 0, failed: false, feedback: null } : await loadCal(sb, q.id)] as const)));
  const { qs } = await loadQuestions(sb, examId);
  const body = new Map(qs.map((q) => [q.id, q.body]));
  const pub = !!e.results_published, total = sumProg(qp);
  const blockMsg = total.remaining ? `আরও ${bn(total.remaining)}টি খাতা কাটা বাকি` : total.modLeft ? `${bn(total.modLeft)}টি খাতার দ্বিতীয় যাচাই বাকি` : "";
  const pick = Object.entries(st?.pick ?? {}).map(([k, v]) => `${k} থেকে যেকোনো ${bn(v)}টি`).join(", ");

  return (
    <>
      <Link href="/evaluator/mark" className={`${BTN_GHOST} mb-2 px-3! py-1.5! md:mb-4`}><span className="icon text-[18px]">arrow_back</span>সব পরীক্ষা</Link>
      <div className="mb-3 flex flex-col justify-between gap-2 md:mb-6 md:flex-row md:items-end md:gap-4">
        <div><h2 className="text-2xl font-bold text-on-background md:text-3xl dark:text-background">{e.title}</h2>
          <p className={`mt-1 text-sm ${MUTED}`}>{e.course} · {KIND[e.kind as keyof typeof KIND]?.[0] ?? e.kind}{pick ? " · " + pick : ""} · পরীক্ষা শেষ {ago(Date.parse(e.closes_at), now)}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          {pub ? <Badge tone="green" icon="verified">ফল প্রকাশিত</Badge> : <Badge tone={total.remaining ? "amber" : "green"}>মোট {bn(total.remaining)}টি বাকি</Badge>}
          {manager && !pub && <PublishButton examId={examId} title={e.title} blocked={blockMsg} />}
        </div>
      </div>
      <div className="space-y-2 md:space-y-4">
        {qp.map((q, i) => {
          const cal = cals.get(q.id)!, f = free.get(q.id) ?? 0, can = (f > 0 || !cal.cleared) && !cal.failed;
          return (
            <div key={q.id} data-q={q.id} className={`ev-row ${CARD} rounded-2xl! p-5`} style={{ "--i": i } as React.CSSProperties}>
              <div className="flex flex-col gap-2 md:gap-4 lg:flex-row lg:items-start">
                <div className="min-w-0 grow">
                  <div className="mb-2 flex flex-wrap items-center gap-2"><b className="text-on-background dark:text-background">{qLabel(q.no, q.section)}</b>
                    <Badge tone="gray">পূর্ণমান {bn(q.marks)}</Badge>
                    {me.role !== "admin" && <Badge tone="purple">প্রতি খাতায় {taka(q.marks * rate)}</Badge>}
                    {!cal.cleared && <Badge tone={cal.failed ? "red" : "blue"} icon="school">{cal.failed ? "নমুনায় মেলেনি: শিক্ষকের অনুমতির অপেক্ষায়" : `আগে ${bn(cal.refs)}টি নমুনা খাতা`}</Badge>}
                    {manager && q.refs > 0 && <Badge tone="blue" icon="school">নমুনা খাতা {bn(q.refs)}টি</Badge>}
                    {q.modLeft > 0 && <Badge tone="purple" icon="difference">দ্বিতীয় যাচাই বাকি {bn(q.modLeft)}</Badge>}
                    {manager && q.flagged > 0 && <Badge tone="red">পার্থক্য {bn(q.flagged)}</Badge>}</div>
                  <Tex as="div" src={body.get(q.id) ?? ""} className={`line-clamp-3 text-sm ${MUTED}`} />
                  <div className="mt-1.5 md:mt-3"><ProgressBar pr={q} /><Legend pr={q} /></div>
                </div>
                <div className="flex shrink-0 gap-2 lg:w-48 lg:flex-col">
                  {!pub && (can
                    ? <Link href={`/evaluator/mark/${examId}/${q.id}`} className={`${BTN_PRI} flex-1`}><span className="icon text-[18px]">{!cal.cleared ? "school" : "rate_review"}</span>{!cal.cleared ? "নমুনা খাতা কাটুন" : "খাতা কাটুন"}</Link>
                    : <button type="button" disabled className={`${BTN_PRI} flex-1`}><span className="icon text-[18px]">{!cal.cleared ? "school" : "rate_review"}</span>{cal.failed ? "অনুমতির অপেক্ষায়" : q.remaining ? "সব খাতা কারো হাতে" : "কাটা শেষ"}</button>)}
                  {q.marked > 0 && <Link href={`/evaluator/mark/${examId}/${q.id}/review`} className={`${BTN_GHOST} flex-1`}><span className="icon text-[18px]">fact_check</span>কাটা খাতা দেখুন</Link>}
                </div>
              </div>
            </div>
          );
        })}
        {!qp.length && <div className={`${CARD} ${MUTED} p-8 text-center`}>এই পরীক্ষায় লিখিত প্রশ্ন নেই</div>}
      </div>
    </>
  );
}
