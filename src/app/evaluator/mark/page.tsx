import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { evMe, loadExams } from "../data";
import { Empty, ExamCard, MUTED } from "../ui";

export const metadata = { title: "খাতা কাটা" };

// খাতা কাটা (evaluator_dashboard.html এর mark, পরীক্ষার তালিকা): পরীক্ষা বেছে নিন, তারপর একটা প্রশ্ন
export default function Page() {
  return (
    <Suspense fallback={<div className="h-60 animate-pulse rounded-3xl bg-surface-container dark:bg-white/5" />}>
      <List />
    </Suspense>
  );
}

async function List() {
  await evMe("/evaluator/mark");
  const exams = await loadExams(await createClient());
  const now = new Date().getTime();
  return (
    <>
      <h2 className="text-2xl font-bold text-on-background md:text-3xl dark:text-background">খাতা কাটা</h2>
      <p className={`mt-1 mb-3 text-sm md:mb-6 ${MUTED}`}>পরীক্ষা বেছে নিন, তারপর একটা প্রশ্ন। এক প্রশ্নের সব খাতা একটানা কাটলে নম্বর একরকম হয়।</p>
      {exams.length ? <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-4">{exams.map((e, i) => <ExamCard key={e.id} e={e} i={i} now={now} />)}</div> : <Empty>এখনো কোনো পরীক্ষার খাতা আসেনি</Empty>}
    </>
  );
}
