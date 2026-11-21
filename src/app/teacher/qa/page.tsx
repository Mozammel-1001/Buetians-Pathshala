import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { loadCourses, loadQa, loadReminders, tMe } from "../data";
import { QaView } from "../qa-view";

export const metadata = { title: "শিক্ষার্থীদের প্রশ্ন" };

// শিক্ষার্থীদের প্রশ্ন (teacher_dashboard.html এর qa-view): আসল প্রশ্ন-উত্তর (qa_feed, qa_answers), ?q=ID দিলে সেই প্রশ্নে
export default function Page({ searchParams }: PageProps<"/teacher/qa">) {
  return (
    <Suspense fallback={<div className="h-60 animate-pulse rounded-3xl bg-surface-container dark:bg-white/5" />}>
      <Loaded searchParams={searchParams} />
    </Suspense>
  );
}

async function Loaded({ searchParams }: { searchParams: PageProps<"/teacher/qa">["searchParams"] }) {
  const me = await tMe("/teacher/qa");
  const sp = await searchParams;
  const sb = await createClient();
  const now = new Date().getTime();
  const courses = await loadCourses(sb, me.id);
  const [items, reminders] = await Promise.all([loadQa(sb, courses), loadReminders(sb)]);
  const f = Number(Array.isArray(sp.q) ? sp.q[0] : sp.q);
  return <QaView items={items} reminders={reminders} focus={Number.isInteger(f) && f > 0 ? f : null} nowMs={now} me={me.full_name} />;
}
