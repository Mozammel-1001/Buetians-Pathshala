import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadCourses, loadLive, tMe } from "../data";
import { bn, clockBd, dateBd } from "../lib";
import { Badge, BTN_GHOST, BTN_PRI, CARD, MUTED } from "@/app/evaluator/ui";

export const metadata = { title: "লাইভ ক্লাস পরিচালনা" };

// লাইভ ক্লাস পরিচালনা: আমার শিডিউল করা (বা চলমান) সেশন। ক্লাস অ্যাসাইন করলে অ্যাডমিন বা ম্যানেজার, তখন এখানে আসে।
// "লাইভে যান" নিয়ে যায় লাইভ ক্লাসের পাতায় (/live/[id]), সেখানে ক্যামেরা চালু করে শুরু আর শেষ করেন
export default function Page({ searchParams }: PageProps<"/teacher/live">) {
  return (
    <Suspense fallback={<div className="h-60 animate-pulse rounded-3xl bg-surface-container dark:bg-white/5" />}>
      <Loaded searchParams={searchParams} />
    </Suspense>
  );
}

async function Loaded({ searchParams }: { searchParams: PageProps<"/teacher/live">["searchParams"] }) {
  const me = await tMe("/teacher/live");
  const sp = await searchParams;
  const sb = await createClient();
  const now = new Date().getTime();
  const courses = await loadCourses(sb, me.id);
  const want = Number(Array.isArray(sp.course) ? sp.course[0] : sp.course);
  const course = courses.find((c) => c.id === want);
  const list = (await loadLive(sb, me.id, courses, now - 7 * 864e5)).filter((l) => l.status !== "ended" && (!course || l.courseId === course.id));
  return (
    <>
      <div className="mb-3 flex items-center gap-4 md:mb-8">
        <Link href="/teacher" aria-label="ড্যাশবোর্ডে ফিরুন" className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/20 bg-surface-container-low transition-colors hover:bg-surface-variant dark:bg-white/5"><span className="icon">arrow_back</span></Link>
        <div><h2 className="text-2xl font-bold text-on-background md:text-3xl dark:text-background">লাইভ ক্লাস পরিচালনা{course ? ` - ${course.title}` : ""}</h2>
          <p className={`mt-1 text-sm ${MUTED}`}>আপনার শিডিউল করা ক্লাসে যুক্ত হয়ে লাইভ শুরু করুন</p></div>
      </div>
      {courses.length > 1 && (
        <div className="mb-2.5 flex flex-wrap gap-2 md:mb-5">
          {[{ id: 0, title: "সব কোর্স" }, ...courses].map((c) => (
            <Link key={c.id} href={c.id ? `/teacher/live?course=${c.id}` : "/teacher/live"} className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${(course?.id ?? 0) === c.id ? "border-primary bg-primary text-on-primary" : `border-outline-variant/40 ${MUTED} hover:border-primary`}`}>{c.title}</Link>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
        {list.map((l) => (
          <div key={l.id} data-live={l.id} className={`${CARD} flex flex-col gap-3 rounded-2xl! p-5`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><h3 className="text-lg font-bold text-on-background dark:text-background">{l.title}</h3><p className={`mt-1 text-xs ${MUTED}`}>{l.course}</p></div>
              {l.status === "live" ? <Badge tone="red" icon="sensors">এখন লাইভ</Badge> : <Badge tone="blue" icon="event">শিডিউল করা</Badge>}
            </div>
            <p className={`flex items-center gap-1 text-xs ${MUTED}`}><span className="icon text-[14px]">schedule</span>{l.at ? `${dateBd(l.at)}, ${clockBd(l.at)}` : "সময় ঠিক হয়নি"}{l.status === "live" && l.peak ? ` · সর্বোচ্চ ${bn(l.peak)} জন` : ""}</p>
            <Link href={`/live/${l.id}`} className={`${l.status === "live" ? BTN_PRI : BTN_GHOST} mt-auto w-full`}><span className="icon text-[18px]">{l.status === "live" ? "sensors" : "video_camera_front"}</span>{l.status === "live" ? "লাইভে ফিরুন" : "লাইভে যান"}</Link>
          </div>
        ))}
        {!list.length && <div className={`${CARD} ${MUTED} p-8 text-center md:col-span-2 xl:col-span-3`}>{courses.length ? "এখন কোনো লাইভ ক্লাস শিডিউল করা নেই। অ্যাডমিন বা ম্যানেজার ক্লাস অ্যাসাইন করলে এখানে আসবে।" : "আপনাকে এখনো কোনো কোর্সে শিক্ষক করা হয়নি"}</div>}
      </div>
    </>
  );
}
