import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { evMe, loadExams, loadQuality, loadQuestions, loadSettings, loadStats } from "../data";
import { QualityView } from "../quality-view";

export const metadata = { title: "মান যাচাই" };

// মান যাচাই (evaluator_dashboard.html এর quality): শিক্ষক আর অ্যাডমিনের। মূল্যায়নকারী এলে ড্যাশবোর্ডে
export default function Page({ searchParams }: PageProps<"/evaluator/quality">) {
  return (
    <Suspense fallback={<div className="h-60 animate-pulse rounded-3xl bg-surface-container dark:bg-white/5" />}>
      <Loaded searchParams={searchParams} />
    </Suspense>
  );
}

async function Loaded({ searchParams }: { searchParams: PageProps<"/evaluator/quality">["searchParams"] }) {
  const me = await evMe("/evaluator/quality");
  if (me.role === "evaluator") redirect("/evaluator");
  const sp = await searchParams;
  const sb = await createClient();
  const now = new Date().getTime();
  const exams = await loadExams(sb);
  const q = await loadQuality(sb, exams);
  const want = Number(Array.isArray(sp.exam) ? sp.exam[0] : sp.exam);
  const statExam = exams.some((e) => e.id === want) ? want : exams[0]?.id ?? null;
  // প্রশ্নের নম্বর বিভাজন আর সমাধান: যেসব পরীক্ষায় কিছু সিদ্ধান্ত বা নমুনা আছে শুধু সেগুলোর
  const ids = [...new Set([...q.flagged.map((x) => x.examId), ...q.rechecks.map((x) => x.examId), ...q.refs.map((x) => x.examId), ...q.cals.map((x) => x.examId)])];
  const [stats, settings, qs] = await Promise.all([
    statExam ? loadStats(sb, statExam) : Promise.resolve([]),
    exams[0] ? loadSettings(sb, exams[0].id) : Promise.resolve(null),
    Promise.all(ids.map((id) => loadQuestions(sb, id))),
  ]);
  const info: Record<number, { scheme: string; solution: string; marks: number }> = {};
  for (const r of qs) for (const x of r.qs) info[x.id] = { scheme: x.scheme, solution: x.solution, marks: x.marks };
  return <QualityView flagged={q.flagged} rechecks={q.rechecks} refs={q.refs} cals={q.cals} exams={exams.map((e) => ({ id: e.id, title: e.title }))} statExam={statExam} stats={stats} settings={settings} info={info} nowMs={now} />;
}
