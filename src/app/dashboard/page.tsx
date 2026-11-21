import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getSiteContent } from "@/lib/content";
import { bn } from "@/lib/content-schema";
import { SessionGuard } from "@/components/session-guard";
import { SoonButton } from "./soon-button";
import { Bell, type Alert } from "../admin/_components/admin-nav";

export const metadata: Metadata = { title: "ড্যাশবোর্ড" };

const ROLE: Record<string, string> = { student: "শিক্ষার্থী", teacher: "শিক্ষক", manager: "ম্যানেজার", admin: "অ্যাডমিন", evaluator: "খাতা মূল্যায়নকারী" };
const WD = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];
const MONTHS = ["জানু", "ফেব্রু", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টে", "অক্টো", "নভে", "ডিসে"];
const DHAKA = 6 * 3600 * 1000;

type Enr = { expires_at: string | null; course: { id: number; slug: string; title: string; batch_name: string | null; thumbnail_url: string | null; category: string | null } | null };
type Prog = { course_id: number; video_percent: number | null };
type Pay = { id: number; status: string; trx_id: string; amount: number; reject_reason: string | null; courses: { slug: string; title: string } | null };
type Exam = { id: number; title: string; opens_at: string | null; closes_at: string | null; course_id: number };

// শিক্ষার্থীর ড্যাশবোর্ড, হুবহু dashboard.html এর home: স্বাগত, আমার কোর্স (অগ্রগতি, লাইভ, রিপোর্ট, প্রশ্নোত্তর), লার্নিং অ্যাক্টিভিটি,
// আসন্ন ডেডলাইন, সাহায্য। পাতার কাঠামো আগেই তৈরি; লগইনের তথ্য লাগা অংশ <Suspense> এর ভেতরে request এর সময় আসে
export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<div className="card h-48 animate-pulse" />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const profile = await requireProfile("/dashboard");
  const supabase = await createClient();
  const now = new Date().getTime();
  const weekStart = new Date(now - 6 * 86400000).toISOString();
  const [{ data: payments }, { data: enrollments }, { data: progress }, { data: live }, { data: acts }, { data: exams }, content, sp] = await Promise.all([
    supabase.from("payments").select("id, status, trx_id, amount, reject_reason, created_at, courses(slug, title)").eq("user_id", profile.id).neq("status", "approved").order("created_at", { ascending: false }).limit(5),
    supabase.from("enrollments").select("expires_at, course:courses(id, slug, title, batch_name, thumbnail_url, category)").eq("user_id", profile.id).eq("status", "active").order("enrolled_at", { ascending: false }),
    supabase.from("student_progress").select("course_id, video_percent").eq("user_id", profile.id),
    supabase.from("live_sessions").select("id, course_id").eq("status", "live"),
    supabase.from("lesson_progress").select("updated_at").eq("user_id", profile.id).gte("updated_at", weekStart).limit(2000),
    supabase.from("exams").select("id, title, opens_at, closes_at, course_id").gt("closes_at", new Date(now).toISOString()).order("closes_at").limit(3),
    getSiteContent(),
    searchParams,
  ]);

  const allCourses = ((enrollments ?? []) as unknown as Enr[]).filter((e) => e.course && (!e.expires_at || Date.parse(e.expires_at) > now));
  // উপরের খোঁজা: কোর্সের নাম বা ব্যাচে মিলিয়ে কার্ড ছাঁকা (?q=)
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const list = q ? allCourses.filter((e) => `${e.course!.title} ${e.course!.batch_name ?? ""} ${e.course!.category ?? ""}`.toLowerCase().includes(q.toLowerCase())) : allCourses;
  const pct = new Map(((progress ?? []) as Prog[]).map((p) => [p.course_id, Math.round(Number(p.video_percent ?? 0))]));
  // কোর্স → এখন চলা লাইভ সেশন (একই কোর্সে একসাথে একটাই লাইভ)
  const liveOf = new Map(((live ?? []) as { id: string; course_id: number }[]).map((l) => [l.course_id, l.id]));
  const liveCourses = new Set(liveOf.keys());
  const myCourseIds = new Set(allCourses.map((e) => e.course!.id));
  const upcoming = ((exams ?? []) as Exam[]).filter((x) => myCourseIds.has(x.course_id));
  const liveNow = allCourses.filter((e) => liveCourses.has(e.course!.id)).length;
  const pend = ((payments ?? []) as unknown as Pay[]);
  const alerts: Alert[] = [
    ...allCourses.filter((e) => liveCourses.has(e.course!.id)).map((e) => ({ icon: "sensors", color: "text-error", text: `${e.course!.title}: লাইভ ক্লাস চলছে`, href: `/live/${liveOf.get(e.course!.id)}` })),
    ...upcomingAlerts(),
    ...pend.filter((p) => p.status === "rejected").map((p) => ({ icon: "cancel", color: "text-error", text: `${p.courses?.title ?? "কোর্স"}: আবেদন বাতিল হয়েছে`, href: "/dashboard" })),
    ...pend.filter((p) => p.status === "pending").map((p) => ({ icon: "hourglass_top", color: "text-amber-500", text: `${p.courses?.title ?? "কোর্স"}: পেমেন্ট যাচাই হচ্ছে`, href: "/dashboard" })),
  ];
  function upcomingAlerts(): Alert[] {
    return ((exams ?? []) as Exam[]).filter((x) => myCourseIds.has(x.course_id) && x.closes_at && Date.parse(x.closes_at) - now < 3 * 86400000)
      .map((x) => ({ icon: "event", color: "text-blue-500", text: `${x.title}: শেষ হবে শীঘ্রই`, href: "/dashboard/report" }));
  }

  // গত ৭ দিনে কতগুলো লেকচারে অগ্রগতি হয়েছে (ঢাকার দিন ধরে)
  const dk = (ms: number) => new Date(ms + DHAKA).toISOString().slice(0, 10);
  const week = Array.from({ length: 7 }, (_, i) => {
    const ms = now - (6 - i) * 86400000;
    return { d: WD[new Date(ms + DHAKA).getUTCDay()], n: ((acts ?? []) as { updated_at: string }[]).filter((a) => dk(Date.parse(a.updated_at)) === dk(ms)).length };
  });
  const maxN = Math.max(...week.map((w) => w.n), 0);
  const peak = week.findIndex((w) => w.n === maxN && maxN > 0);
  const staff = profile.role === "admin" || profile.role === "manager";
  const note = "rounded-2xl border p-4 text-sm";
  const cta = "flex-1 rounded-xl py-2.5 text-xs font-bold sm:text-sm";
  const ghost = "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-primary/30 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-on-primary sm:text-sm dark:border-primary-fixed/30 dark:text-primary-fixed";

  return (
    <>
      <SessionGuard />
      {sp.replaced && <p className={`mb-3 border-amber-300/50 bg-amber-50 text-amber-800 md:mb-6 dark:bg-amber-900/20 dark:text-amber-200 ${note}`}>আগে অন্য একটা ডিভাইসে লগইন ছিল, সেখান থেকে লগআউট হয়েছে। সেখানে কোনো পরীক্ষা চলছিল থাকলে জমা হয়ে গেছে।</p>}
      {sp.pwreset && <p className={`mb-3 border-emerald-300/50 bg-emerald-50 text-emerald-800 md:mb-6 dark:bg-emerald-900/20 dark:text-emerald-200 ${note}`}>পাসওয়ার্ড বদলানো হয়েছে। এখন থেকে নতুন পাসওয়ার্ড দিয়ে লগইন করবেন।</p>}
      {sp.enrolled && <p className={`mb-3 border-emerald-300/50 bg-emerald-50 text-emerald-800 md:mb-6 dark:bg-emerald-900/20 dark:text-emerald-200 ${note}`}>ভর্তি হয়েছে, কোর্সটা নিচে দেখুন।</p>}
      {sp.existing && <p className={`mb-3 border-amber-300/50 bg-amber-50 text-amber-800 md:mb-6 dark:bg-amber-900/20 dark:text-amber-200 ${note}`}>এই নম্বরে আগেই অ্যাকাউন্ট ছিল, তাই নতুন অ্যাকাউন্ট খোলা হয়নি; আগের অ্যাকাউন্টে লগইন হয়েছে।</p>}

      <div className="reveal mb-3 flex items-center justify-between gap-3 md:mb-8">
        <form role="search" className="relative w-full max-w-md">
          <span className="icon pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-on-surface-variant dark:text-surface-variant">search</span>
          <input name="q" type="search" defaultValue={q} placeholder="কোর্স, অ্যাসাইনমেন্ট খুঁজুন..." aria-label="খুঁজুন"
            className="w-full rounded-full border border-outline-variant/30 bg-surface-container-lowest py-2.5 pr-4 pl-12 text-sm focus:border-primary focus:outline-none dark:border-outline-variant/10 dark:bg-inverse-surface" />
        </form>
        <Bell items={alerts} />
      </div>

      <div className="reveal tilt-card relative mb-4 flex flex-col items-center justify-between overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-5 md:mb-8 md:flex-row md:p-8 dark:border-outline-variant/10 dark:bg-inverse-surface">
        <div className="relative z-10 w-full md:w-2/3">
          <h2 className="mb-2 text-2xl font-bold text-on-background md:text-3xl dark:text-background">স্বাগতম, {profile.full_name}! 👋</h2>
          <p className="mb-3 muted md:mb-6">{ROLE[profile.role] ?? profile.role} · আইডি <b className="trx">{profile.user_code}</b>{list.length ? " · এই সপ্তাহে আপনার অগ্রগতি খুব ভালো। এভাবেই চালিয়ে যান!" : ""}</p>
          <div className="flex flex-wrap gap-2 md:gap-4">
            <span className="flex items-center gap-2 rounded-lg border border-secondary-container bg-secondary-container px-4 py-2 text-sm font-bold text-on-secondary-container dark:bg-secondary-fixed/20 dark:text-secondary-fixed"><span className="icon text-[18px]">menu_book</span>{bn(list.length)}টি কোর্স চলমান</span>
            {upcoming.length > 0 && <span className="flex items-center gap-2 rounded-lg border border-error/30 bg-error-container px-4 py-2 text-sm font-bold text-error dark:bg-error-container/20 dark:text-red-300"><span className="icon text-[18px]">assignment_late</span>{bn(upcoming.length)}টি পরীক্ষার সময় ঘনিয়ে এসেছে</span>}
            {liveNow > 0 && <span className="flex items-center gap-2 rounded-lg bg-error px-4 py-2 text-sm font-bold text-white"><span className="h-2 w-2 animate-pulse rounded-full bg-white" />{bn(liveNow)}টি লাইভ ক্লাস চলছে</span>}
            {profile.role === "evaluator" && <Link href="/evaluator" className="btn-primary px-4! py-2!"><span className="icon text-[18px]">rate_review</span>খাতা মূল্যায়ন</Link>}
            {profile.role === "teacher" && <Link href="/teacher" className="btn-primary px-4! py-2!"><span className="icon text-[18px]">cast_for_education</span>শিক্ষক ড্যাশবোর্ড</Link>}
            {staff && <Link href={profile.role === "admin" ? "/admin" : "/manager"} className="btn-primary px-4! py-2!"><span className="icon text-[18px]">admin_panel_settings</span>{profile.role === "admin" ? "অ্যাডমিন প্যানেল" : "ম্যানেজার প্যানেল"}</Link>}
          </div>
        </div>
        <div className="relative z-10 hidden w-1/3 justify-end md:flex">
          <div className="relative h-32 w-48 overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-low p-2 shadow-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=400&auto=format&fit=crop" alt="" className="h-full w-full rounded-lg object-cover opacity-80" />
          </div>
        </div>
        <div className="pointer-events-none absolute top-0 right-0 h-64 w-64 -translate-y-1/2 translate-x-1/4 rounded-full bg-primary/5 blur-3xl" />
      </div>

      {(payments ?? []).length > 0 && (
        <section className="reveal card mb-4 p-5 md:mb-8 md:p-6" data-testid="my-payments">
          <h3 className="section-title mb-3">ভর্তির আবেদন</h3>
          <ul className="space-y-3">
            {(payments as unknown as Pay[]).map((p) => (
              <li key={p.id} className="rounded-2xl border border-outline-variant/30 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/courses/${p.courses?.slug}`} className="font-bold hover:text-primary">{p.courses?.title}</Link>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${p.status === "pending" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" : "bg-error/10 text-error"}`}>{p.status === "pending" ? "যাচাই বাকি" : "বাতিল"}</span>
                </div>
                <p className="mt-1 text-xs muted">TrxID <span className="trx font-bold">{p.trx_id}</span> · ৳{bn(Number(p.amount).toLocaleString("en-IN"))}</p>
                {p.status === "pending" && content.payment.review_time && <p className="mt-1 text-xs muted">{content.payment.review_time}</p>}
                {p.reject_reason && <p className="mt-1 text-xs text-error dark:text-red-300">কারণ: {p.reject_reason}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 md:gap-8 xl:grid-cols-3">
        <div className="space-y-4 md:space-y-8 xl:col-span-2">
          <div id="courses" className="scroll-mt-24">
            <div className="reveal mb-3 flex items-end justify-between md:mb-4">
              <div><h3 className="text-xl font-bold text-on-background dark:text-background">আমার কোর্সসমূহ</h3><p className="mt-1 text-xs muted">যেখান থেকে শেষ করেছিলেন সেখান থেকে শুরু করুন</p></div>
              <Link href="/courses" className="flex items-center text-sm font-bold text-primary hover:underline dark:text-primary-fixed">সব কোর্স <span className="icon text-[16px]">chevron_right</span></Link>
            </div>
            {list.length === 0 ? (
              <div className="reveal card p-8 text-center"><span className="icon text-5xl text-outline-variant">school</span><p className="mt-3 font-bold muted">{q ? `"${q}" এর সাথে মেলে এমন কোর্স নেই` : "এখনো কোনো কোর্সে ভর্তি হননি"}</p><Link href="/courses" className="btn-primary mt-4">কোর্স দেখুন</Link></div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6">
                {list.map((e, i) => {
                  const c = e.course!, p = pct.get(c.id) ?? 0, isLive = liveCourses.has(c.id);
                  const bg = c.thumbnail_url ? `linear-gradient(to top, rgba(0,0,0,0.5), rgba(0,0,0,0.1)), url("${c.thumbnail_url.replace(/"/g, "%22")}")` : "linear-gradient(to top, rgba(0,0,0,0.4), rgba(0,0,0,0.05)), linear-gradient(135deg, #006c49, #10b981)";
                  return (
                    <div key={c.id} className="reveal h-full" style={{ transitionDelay: `${(i % 2 + 1) * 100}ms` }}>
                      <div className="tilt-card group flex h-full flex-col overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm dark:border-outline-variant/10 dark:bg-inverse-surface">
                        <div className="relative h-40 overflow-hidden border-b border-outline-variant/20 bg-cover bg-center" style={{ backgroundImage: bg }}>
                          {(c.category || c.batch_name) && <div className="absolute top-2 right-2 rounded border border-outline-variant/30 bg-white/90 px-2 py-1 text-xs font-bold text-on-background shadow-sm backdrop-blur-sm">{c.category ?? c.batch_name}</div>}
                        </div>
                        <div className="flex grow flex-col p-5">
                          <h4 className="mb-1 text-lg font-bold text-on-background dark:text-background">{c.title}</h4>
                          <p className="mb-4 text-xs muted">{c.batch_name ?? ""}</p>
                          <div className="mb-4">
                            <div className="mb-1 flex justify-between text-xs font-bold"><span className="muted">অগ্রগতি</span><span className="text-primary dark:text-primary-fixed">{bn(p)}%</span></div>
                            <div className="h-1.5 w-full rounded-full bg-surface-container-highest dark:bg-on-surface-variant"><div className="hbar h-1.5 rounded-full bg-primary dark:bg-primary-fixed" style={{ "--target-width": `${p}%` } as React.CSSProperties} /></div>
                          </div>
                          <div className="mt-auto flex w-full flex-col gap-2">
                            {isLive ? (
                              <Link href={`/live/${liveOf.get(c.id)}`} className="flex w-full animate-pulse items-center justify-center gap-2 rounded-xl bg-error py-2.5 text-xs font-bold text-white sm:text-sm">
                                <span className="icon text-[18px]">videocam</span>লাইভ ক্লাসে যোগ দিন
                              </Link>
                            ) : (
                              <button type="button" disabled className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-surface-container-high py-2.5 text-xs font-bold text-on-surface-variant/60 sm:text-sm dark:bg-white/5">
                                <span className="icon text-[18px]">videocam_off</span>এখন কোনো লাইভ ক্লাস নেই
                              </button>
                            )}
                            <div className="flex w-full gap-2">
                              <Link href={`/learn/${c.slug}`} className={`${cta} bg-primary text-center text-on-primary hover:bg-surface-tint`}>শেখা চালিয়ে যান</Link>
                              <Link href={`/dashboard/materials?course=${c.id}`} className={`${cta} bg-surface-container-high text-center text-on-surface hover:bg-surface-variant dark:bg-white/10 dark:text-background`}>স্টাডি ম্যাটেরিয়ালস</Link>
                            </div>
                            <div className="flex w-full gap-2">
                              <Link href={`/dashboard/report?course=${c.id}`} className={ghost}><span className="icon text-[18px]">assessment</span> পরীক্ষার রিপোর্ট</Link>
                              <Link href={`/dashboard/leaderboard?course=${c.id}`} className={ghost}><span className="icon text-[18px]">leaderboard</span> লিডারবোর্ড</Link>
                            </div>
                            <Link href={`/dashboard/qa?course=${c.id}`} className={`${ghost} w-full flex-none`}><span className="icon text-[18px]">forum</span> প্রশ্নোত্তর</Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="reveal" style={{ transitionDelay: "300ms" }}>
            <div className="tilt-card rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm dark:border-outline-variant/10 dark:bg-inverse-surface">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="section-title">লার্নিং অ্যাক্টিভিটি</h3>
                <span className="rounded-lg border border-primary/20 bg-surface-container-low px-3 py-1 text-xs font-bold text-primary dark:bg-white/5 dark:text-primary-fixed">এই সপ্তাহ</span>
              </div>
              <div className="relative mt-4 flex h-48 items-end justify-between gap-2 px-2">
                <div className="pointer-events-none absolute inset-0 bottom-6 flex flex-col justify-between">{[0, 1, 2, 3].map((k) => <div key={k} className="h-0 w-full border-b border-outline-variant/10" />)}</div>
                {week.map((w, i) => (
                  <div key={i} className="z-10 flex h-full w-full flex-col items-center justify-end gap-2" title={`${w.d}: ${bn(w.n)}টি লেকচার`}>
                    <div className={`chart-bar w-8 rounded-t-md md:w-12 ${i === peak ? "bg-primary shadow-[0_0_15px_rgba(0,108,73,0.3)] dark:bg-primary-fixed" : "bg-primary-container/40"}`} style={{ "--target-height": `${maxN ? Math.max(4, (w.n / maxN) * 85) : 4}%` } as React.CSSProperties} />
                    <span className="text-[10px] font-bold text-on-surface-variant">{w.d}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 md:space-y-8">
          <div className="reveal" style={{ transitionDelay: "100ms" }}>
            <div className="tilt-card rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm dark:border-outline-variant/10 dark:bg-inverse-surface">
              <div className="mb-6 flex items-center justify-between"><h3 className="section-title">আসন্ন ডেডলাইন</h3><span className="icon text-[20px] muted">more_horiz</span></div>
              <div className="mb-6 space-y-4">
                {upcoming.length ? upcoming.map((x, i) => {
                  const d = new Date(Date.parse(x.closes_at!) + DHAKA);
                  const left = Math.max(0, Math.ceil((Date.parse(x.closes_at!) - now) / 86400000));
                  return (
                    <div key={x.id} className="flex items-start gap-4 rounded-xl border border-transparent p-3 transition-colors hover:border-outline-variant/20 hover:bg-surface-container-low dark:hover:bg-white/5">
                      <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border ${i === 0 ? "border-error/20 bg-error-container/30 text-error" : "border-transparent bg-surface-container-highest text-on-surface-variant dark:bg-outline-variant/20"}`}>
                        <span className="text-[10px] font-bold uppercase">{MONTHS[d.getUTCMonth()]}</span><span className="text-lg leading-none font-bold">{bn(d.getUTCDate())}</span>
                      </div>
                      <div><h4 className="text-sm font-bold text-on-background dark:text-background">{x.title}</h4>
                        <p className={`mt-1 flex items-center gap-1 text-xs ${i === 0 ? "font-bold text-error" : "muted"}`}><span className="icon text-[14px]">schedule</span>{left <= 1 ? "আজ বা কাল শেষ" : `${bn(left)} দিন বাকি`}</p></div>
                    </div>
                  );
                }) : <div className="py-6 text-center"><span className="icon text-4xl text-outline-variant">event_available</span><p className="mt-2 text-sm font-bold muted">সামনে কোনো পরীক্ষা নেই</p></div>}
              </div>
              <SoonButton text="রুটিন আর ক্যালেন্ডারের পাতা শীঘ্রই আসছে" className="block w-full rounded-xl border border-outline-variant/30 py-2.5 text-center text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container-low dark:text-surface-variant dark:hover:bg-white/5">ক্যালেন্ডার দেখুন</SoonButton>
            </div>
          </div>
          <div className="reveal" style={{ transitionDelay: "200ms" }}>
            <div className="tilt-card group relative overflow-hidden rounded-3xl bg-primary p-6 text-on-primary shadow-[0_10px_30px_rgba(0,108,73,0.3)]">
              <div className="absolute top-0 right-0 h-32 w-32 -translate-y-1/2 translate-x-1/4 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute bottom-0 left-0 h-32 w-32 -translate-x-1/4 translate-y-1/4 rounded-full bg-secondary-fixed/20 blur-2xl" />
              <div className="relative z-10">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-on-primary/20 backdrop-blur-sm"><span className="icon text-on-primary">support_agent</span></div>
                <h3 className="mb-2 text-xl font-bold">সাহায্য প্রয়োজন?</h3>
                <p className="mb-6 text-sm leading-relaxed text-primary-fixed">পড়াশোনায় সঠিক ট্র্যাকে থাকতে চাইলে আমাদের সাপোর্ট টিমের সাথে কথা বলুন।</p>
                {content.contact.phone ? (
                  <a href={`tel:${content.contact.phone.replace(/[^\d+]/g, "")}`} className="block w-full rounded-xl bg-on-primary py-2.5 text-center text-sm font-bold text-primary shadow-md transition-transform hover:scale-105">{content.contact.phone} এ কল করুন</a>
                ) : <Link href="/dashboard/qa" className="block w-full rounded-xl bg-on-primary py-2.5 text-center text-sm font-bold text-primary shadow-md transition-transform hover:scale-105">প্রশ্ন করুন</Link>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
