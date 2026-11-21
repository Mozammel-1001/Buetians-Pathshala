import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { remainingCount } from "../evaluator/data";
import { ago, bn, clockBd } from "./lib";
import { loadCourses, loadLive, loadQa, tMe } from "./data";
import { CARD, MUTED } from "@/app/evaluator/ui";
import { ActionCards, AddContentButton, SoonBtn } from "./home-actions";

// শিক্ষকের ড্যাশবোর্ড (teacher_dashboard.html এর main-dashboard-view): স্বাগতম, কাজের card, আমার কোর্স,
// সাপ্তাহিক উপস্থিতি, শিক্ষার্থীদের প্রশ্ন, আজকের লাইভ ক্লাস
export default function Page() {
  return (
    <Suspense fallback={<div className="h-60 animate-pulse rounded-3xl bg-surface-container dark:bg-white/5" />}>
      <Home />
    </Suspense>
  );
}

const DAYS = ["সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি", "রবি"];
const BD = 6 * 3600e3, DAY = 864e5;

async function Home() {
  const me = await tMe("/teacher");
  const sb = await createClient();
  const now = new Date().getTime();
  const dayStart = Math.floor((now + BD) / DAY) * DAY - BD;      // বাংলাদেশের আজকের শুরু
  const weekStart = dayStart - ((Math.floor((now + BD) / DAY) + 3) % 7) * DAY;   // সোমবার থেকে সপ্তাহ
  const courses = await loadCourses(sb, me.id);
  const [qa, live, classes, mark] = await Promise.all([
    loadQa(sb, courses), loadLive(sb, me.id, courses, weekStart),
    sb.from("class_assignments").select("id, topic, starts_at, status, live_session_id").eq("teacher_id", me.id).gte("starts_at", new Date(dayStart).toISOString()).lt("starts_at", new Date(dayStart + DAY).toISOString()).order("starts_at"),
    remainingCount(sb),
  ]);
  const open = qa.filter((q) => !q.answers.length).sort((a, b) => a.at - b.at);
  // সাপ্তাহিক উপস্থিতি = সেই দিনের লাইভ ক্লাসগুলোর সর্বোচ্চ দর্শকের যোগফল
  const week = DAYS.map((_, i) => live.filter((l) => l.startedAt != null && l.startedAt >= weekStart + i * DAY && l.startedAt < weekStart + (i + 1) * DAY).reduce((t, l) => t + l.peak, 0));
  const max = Math.max(...week, 0), todayIdx = Math.floor((now - weekStart) / DAY);
  const liveOf = new Map(live.map((l) => [l.id, l]));
  const today = ((classes.data ?? []) as { id: number; topic: string; starts_at: string; status: string; live_session_id: string | null }[]).map((c) => ({ ...c, at: Date.parse(c.starts_at), session: c.live_session_id ? liveOf.get(c.live_session_id) : undefined }));

  return (
    <>
      <div className={`reveal tilt-card ${CARD} relative mb-4 flex flex-col items-center justify-between overflow-hidden p-6 md:mb-8 md:flex-row md:p-8`}>
        <div className="relative z-10 w-full">
          <h2 className="mb-2 text-2xl font-bold text-on-background md:text-3xl dark:text-background">স্বাগতম, {me.full_name} ! 👋</h2>
          <p className={`${MUTED} mb-2.5 md:mb-6`}>{courses.length ? "এই সপ্তাহে আপনার পরিচালিত ব্যাচগুলোর অবস্থা এক নজরে।" : "আপনাকে এখনো কোনো কোর্সে শিক্ষক করা হয়নি। অ্যাডমিন কোর্স দিলে এখানে দেখা যাবে।"}</p>
          <div className="flex flex-wrap gap-1.5 md:gap-4">
            <span className="flex items-center gap-2 rounded-lg border border-secondary-container bg-secondary-container px-4 py-2 text-sm font-bold text-on-secondary-container dark:bg-secondary-fixed/20 dark:text-secondary-fixed"><span className="icon text-[18px]">group</span>{bn(courses.length)}টি রানিং ব্যাচ</span>
            <Link href="/evaluator" className="flex items-center gap-2 rounded-lg border border-error-container bg-error-container px-4 py-2 text-sm font-bold text-error transition-all hover:-translate-y-px dark:border-error/30 dark:bg-error-container/20"><span className="icon text-[18px]">assignment_late</span><span>{mark ? `${bn(mark)}টি খাতা কাটা বাকি` : "খাতা মূল্যায়ন"}</span></Link>
            <Link href="/teacher/qa" className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 transition-all hover:-translate-y-px dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300"><span className="icon text-[18px]">forum</span><span>{open.length ? `${bn(open.length)}টি প্রশ্নের উত্তর বাকি` : "সব প্রশ্নের উত্তর দেওয়া হয়েছে"}</span></Link>
          </div>
        </div>
        <div className="pointer-events-none absolute top-0 right-0 h-64 w-64 -translate-y-1/2 translate-x-1/4 rounded-full bg-primary/5 blur-3xl dark:bg-primary-fixed/5" />
      </div>

      <ActionCards />

      <div className="grid grid-cols-1 gap-4 md:gap-8 xl:grid-cols-3">
        <div className="space-y-4 md:space-y-8 xl:col-span-2">
          <div>
            <div className="reveal mb-2 flex items-end justify-between md:mb-4">
              <div><h3 className="text-xl font-bold text-on-background dark:text-background">আমার পরিচালিত কোর্সসমূহ</h3><p className={`mt-1 text-xs ${MUTED}`}>কোর্সের কন্টেন্ট এবং শিক্ষার্থীদের অগ্রগতি মনিটর করুন</p></div>
              <Link href="/teacher/courses" className="flex items-center text-sm font-bold text-primary hover:underline dark:text-primary-fixed">সব দেখুন <span className="icon text-[16px]">chevron_right</span></Link>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6">
              {courses.map((c, i) => (
                <div key={c.id} data-course-card={c.id} className="reveal h-full" style={{ transitionDelay: `${(i + 1) * 100}ms` }}>
                  <div className="tilt-card group flex h-full flex-col overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm dark:border-outline-variant/10 dark:bg-inverse-surface">
                    <div className="relative flex aspect-video items-end justify-start rounded-t-2xl border-b border-outline-variant/20 bg-cover bg-center p-4"
                      style={{ backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.1))${c.thumb ? `, url('${c.thumb}')` : ""}`, backgroundColor: "#0b1c30" }}>
                      {(c.badge || c.batch) && <span className="absolute top-2 left-2 rounded border border-outline-variant/20 bg-white/20 px-2 py-1 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm">{c.badge || c.batch}</span>}
                      <h4 className="text-left text-xl leading-tight font-bold text-white md:text-2xl">{c.title}</h4>
                    </div>
                    <div className="flex grow flex-col p-5">
                      <p className={`mb-2.5 flex items-center gap-1 text-xs md:mb-4 ${MUTED}`}><span className="icon text-[14px]">group</span> মোট শিক্ষার্থী: {bn(c.students)}</p>
                      <div className="mb-2.5 md:mb-4">
                        <div className="mb-1 flex justify-between text-xs font-bold"><span className={MUTED}>আপলোডকৃত মডিউল</span><span className="text-primary dark:text-primary-fixed">{bn(c.modules)}/{bn(c.totalModules)}</span></div>
                        <div className="h-1.5 w-full rounded-full bg-surface-container-highest dark:bg-on-surface-variant"><div className="h-1.5 rounded-full bg-primary dark:bg-primary-fixed" style={{ width: `${c.totalModules ? (c.modules * 100) / c.totalModules : 0}%` }} /></div>
                      </div>
                      <div className="mt-auto flex w-full gap-2">
                        <Link href={`/teacher/courses?course=${c.id}`} className="flex-1 rounded-xl bg-primary py-2.5 text-center text-xs font-bold text-on-primary transition-colors hover:bg-surface-tint sm:text-sm">ম্যানেজ কোর্স</Link>
                        <AddContentButton courseId={c.id} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {!courses.length && <div className={`${CARD} ${MUTED} p-8 text-center md:col-span-2`}>এই মুহূর্তে কোনো কোর্স নেই</div>}
            </div>
          </div>

          <div className="reveal">
            <div className={`tilt-card ${CARD} p-6`}>
              <div className="mb-3 flex items-center justify-between md:mb-6"><h3 className="text-lg font-bold text-on-background dark:text-background">সাপ্তাহিক উপস্থিতি (অ্যাটেন্ডেন্স)</h3>
                <span className="rounded-lg border border-primary/20 bg-surface-container-low px-3 py-1 text-xs font-bold text-primary dark:bg-white/5 dark:text-primary-fixed">এই সপ্তাহ</span></div>
              <div className="relative mt-2 flex h-48 items-end justify-between gap-2 px-2 md:mt-4" id="t-week">
                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">{[0, 1, 2, 3].map((k) => <div key={k} className="h-0 w-full border-b border-outline-variant/10" />)}</div>
                {week.map((v, i) => (
                  <div key={i} className="z-10 flex w-full flex-col items-center gap-2" title={`${DAYS[i]}: ${bn(v)} জন (লাইভ ক্লাসের সর্বোচ্চ দর্শক)`}>
                    <div className={`chart-bar w-8 rounded-t-md md:w-12 ${i === todayIdx ? "bg-primary shadow-[0_0_15px_rgba(0,108,73,0.3)] dark:bg-primary-fixed dark:shadow-[0_0_15px_rgba(111,251,190,0.2)]" : "bg-primary-container/40 dark:bg-primary-fixed/20"}`} style={{ "--target-height": `${max ? Math.max(4, (v * 100) / max) : 0}%` } as React.CSSProperties} />
                    <span className="text-[10px] font-bold text-on-surface-variant">{DAYS[i]}</span>
                  </div>
                ))}
              </div>
              {!max && <p className={`mt-2 text-center text-xs ${MUTED}`}>এই সপ্তাহে এখনো কোনো লাইভ ক্লাস হয়নি</p>}
            </div>
          </div>
        </div>

        <div className="space-y-4 md:space-y-8">
          <div className="reveal">
            <div className={`tilt-card ${CARD} p-6`}>
              <div className="mb-2 flex items-center justify-between md:mb-4"><h3 className="text-lg font-bold text-on-background dark:text-background">শিক্ষার্থীদের প্রশ্ন</h3>
                {open.length > 0 && <span className="grid h-[26px] min-w-[26px] place-items-center rounded-full bg-error px-2 text-xs font-bold text-white" title="উত্তর বাকি">{bn(open.length)}</span>}</div>
              <div id="tqa-mini" className="mb-2.5 space-y-2 md:mb-5">
                {open.slice(0, 3).map((q) => (
                  <Link key={q.id} href={`/teacher/qa?q=${q.id}`} className="flex w-full items-start gap-3 rounded-xl border border-transparent p-3 text-left transition-colors hover:border-outline-variant/20 hover:bg-surface-container-low dark:hover:bg-white/10">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary dark:bg-primary-fixed/10 dark:text-primary-fixed">{[...q.asker][0]}</div>
                    <div className="min-w-0 grow"><p className="line-clamp-2 text-sm font-bold text-on-background dark:text-background">{q.body}</p>
                      <p className={`mt-1 flex items-center gap-1 text-xs ${MUTED}`}>{q.asker} · {ago(q.at, now).replace(" আগে", "")} ধরে অপেক্ষায়</p></div>
                  </Link>
                ))}
                {!open.length && <p className={`py-4 text-center text-sm ${MUTED}`}>সব প্রশ্নের উত্তর দেওয়া হয়েছে 🎉</p>}
              </div>
              <Link href="/teacher/qa" className={`flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/30 py-2.5 text-sm font-bold transition-colors hover:bg-surface-container-low dark:hover:bg-white/10 ${MUTED}`}>সব প্রশ্ন দেখুন <span className="icon text-[18px]">chevron_right</span></Link>
            </div>
          </div>

          <div className="reveal">
            <div className={`tilt-card ${CARD} p-6`}>
              <div className="mb-3 flex items-center justify-between md:mb-6"><h3 className="text-lg font-bold text-on-background dark:text-background">আজকের লাইভ ক্লাস শিডিউল</h3>
                <SoonBtn className="text-on-surface-variant transition-colors hover:text-primary" text="এই অংশটি শীঘ্রই আসছে"><span className="icon text-[20px]">more_horiz</span></SoonBtn></div>
              <div className="mb-3 space-y-2 md:mb-6 md:space-y-4">
                {today.map((c) => {
                  const nowLive = c.session?.status === "live";
                  return (
                    <Link key={c.id} href={c.live_session_id ? `/live/${c.live_session_id}` : "/teacher/live"} className="flex cursor-pointer items-start gap-4 rounded-xl border border-transparent p-3 transition-colors hover:border-outline-variant/20 hover:bg-surface-container-low dark:hover:bg-white/10">
                      <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border ${nowLive ? "border-error/20 bg-error-container/30 text-error" : "border-outline-variant/20 bg-surface-container-highest text-on-surface-variant dark:bg-outline-variant/20 dark:text-surface-variant"}`}><span className="icon text-2xl">{nowLive ? "sensors" : "video_camera_front"}</span></div>
                      <div className="grow"><h4 className="text-sm font-bold text-on-background dark:text-background">{c.topic}</h4>
                        <p className={`mt-1 flex items-center gap-1 text-xs ${nowLive ? "font-bold text-error" : MUTED}`}><span className="icon text-[14px]">schedule</span>{clockBd(c.at)}{nowLive ? " (এখন লাইভ)" : c.status === "done" ? " · শেষ" : c.status === "cancelled" ? " · বাতিল" : c.at - now < 3600e3 && c.at > now ? " (শীঘ্রই শুরু)" : ""}</p></div>
                    </Link>
                  );
                })}
                {!today.length && <p className={`py-4 text-center text-sm ${MUTED}`}>আজ কোনো ক্লাস অ্যাসাইন করা নেই</p>}
              </div>
              <SoonBtn className={`w-full rounded-xl border border-outline-variant/30 py-2.5 text-sm font-bold transition-colors hover:bg-surface-container-low dark:hover:bg-white/10 ${MUTED}`}>সম্পূর্ণ রুটিন দেখুন</SoonBtn>
            </div>
          </div>

          <div className="reveal">
            <div className={`tilt-card ${CARD} group relative overflow-hidden p-6`}>
              <div className="relative z-10">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 backdrop-blur-sm md:mb-4 dark:bg-primary-fixed/10"><span className="icon text-primary dark:text-primary-fixed">campaign</span></div>
                <h3 className="mb-2 text-xl font-bold text-on-background dark:text-background">শিক্ষার্থীদের নোটিশ দিন</h3>
                <p className={`mb-2.5 text-sm leading-relaxed md:mb-6 ${MUTED}`}>ক্লাসের সময় পরিবর্তন বা নতুন কোনো আপডেট জানাতে ব্যাচের শিক্ষার্থীদের নোট পাঠান।</p>
                <SoonBtn className="w-full rounded-xl border-2 border-primary py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-white dark:border-primary-fixed dark:text-primary-fixed dark:hover:bg-primary-fixed dark:hover:text-on-primary-fixed">নতুন নোটিশ তৈরি করুন</SoonBtn>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
