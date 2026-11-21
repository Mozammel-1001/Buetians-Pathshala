import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SessionGuard } from "@/components/session-guard";
import { bn, taka } from "@/lib/content-schema";
import { CountUp } from "../admin/_components/count-up";
import { PayActions } from "../admin/_components/pay-actions";
import { Avatar, Badge, EmptyState, when } from "../admin/_components/ui";
import { courseName, teacherName } from "../admin/_components/sample";

// ম্যানেজারের ড্যাশবোর্ড, হুবহু manager_dashboard.html এর "MANAGER OVERVIEW": স্বাগত, চার সংখ্যা, পাঁচটা দ্রুত কাজ,
// অপেক্ষমাণ পেমেন্ট, সামনের ক্লাস, বাকি সম্মানী, নজর দেওয়া দরকার।
// পেমেন্ট, ভর্তি আর প্রশ্নের সংখ্যা database থেকে; ক্লাস আর সম্মানী এখনো নমুনা (ওই দুই পাতার মতো)
export default function ManagerHome() {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse" />}>
      <Overview />
    </Suspense>
  );
}

const DHAKA = 6 * 3600 * 1000;
const dkey = (ms: number) => new Date(ms + DHAKA).toISOString().slice(0, 10);
const MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const CLASS_TYPE = { live: ["লাইভ", "red"], offline: ["অফলাইন", "blue"], doubt: ["ডাউট সলভিং", "purple"] } as const;

// নমুনা: সামনের ক্লাস আর এই মাসের সম্মানীর হিসাব (ক্লাস অ্যাসাইন / সম্মানী পাতার নমুনার সাথে মিলিয়ে)
const UPCOMING = [
  { id: 1, day: "২১", mon: "নভে", topic: "ত্রিকোণমিতি: অনুপাতের সমস্যা", teacher: 1, time: "৮:০০ পিএম", course: 2, type: "live" as const },
  { id: 2, day: "২২", mon: "নভে", topic: "নিউটনের গতিসূত্র", teacher: 2, time: "৯:০০ পিএম", course: 4, type: "live" as const },
  { id: 3, day: "২৩", mon: "নভে", topic: "মডেল টেস্ট রিভিউ", teacher: 3, time: "৫:০০ পিএম", course: 1, type: "doubt" as const },
];
const LEDGER = [
  { name: "রাফিউল ইসলাম", classes: 8, scripts: 40, due: 0 },
  { name: "তাসনিম আহমেদ", classes: 6, scripts: 0, due: 2800 },
  { name: "ফারহানা ইয়াসমিন", classes: 5, scripts: 22, due: 3160 },
  { name: "নাজমুল হক", classes: 0, scripts: 90, due: 0 },
];
const DONE_THIS_MONTH = 19;

type Pending = { id: number; amount: number; trx_id: string; created_at: string; student: { full_name: string } | null; course: { title: string } | null };

async function Overview() {
  const me = await requireStaff("/manager");
  const supabase = await createClient();
  const now = new Date().getTime();
  const monthStart = new Date(`${dkey(now).slice(0, 7)}-01T00:00:00+06:00`).toISOString();
  const soon = new Date(now + 7 * 86400000).toISOString();

  const [pending, pendingCount, enrolled, inq, qa, expiring] = await Promise.all([
    supabase.from("payments").select("id, amount, trx_id, created_at, student:profiles!payments_user_id_fkey(full_name), course:courses(title)").eq("status", "pending").order("created_at").limit(4),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "approved").gte("reviewed_at", monthStart),
    supabase.from("qa_questions").select("id", { count: "exact", head: true }).eq("kind", "enrollment").is("answered_at", null),
    supabase.from("qa_questions").select("id", { count: "exact", head: true }).eq("kind", "study").is("answered_at", null),
    supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("status", "active").not("expires_at", "is", null).lte("expires_at", soon).gte("expires_at", new Date(now).toISOString()),
  ]);
  const p = pendingCount.count ?? 0;
  const inquiries = inq.count ?? 0;
  const dueTotal = LEDGER.reduce((t, r) => t + r.due, 0);
  const attention = [
    p && { icon: "pending_actions", color: "text-error", text: `${bn(p)}টি পেমেন্ট যাচাই বাকি`, href: "/manager/payments" },
    inquiries && { icon: "contact_support", color: "text-amber-500", text: `${bn(inquiries)}টি ভর্তির প্রশ্নের উত্তর বাকি`, href: "/manager/inquiries" },
    (qa.count ?? 0) && { icon: "forum", color: "text-amber-500", text: `${bn(qa.count ?? 0)}টি পড়াশোনার প্রশ্নের উত্তর দেওয়া বাকি`, href: "/manager/qa" },
    (expiring.count ?? 0) && { icon: "timer", color: "text-amber-500", text: `${bn(expiring.count ?? 0)}টি এনরোলমেন্টের মেয়াদ ৭ দিনে শেষ`, href: "/manager/enrollments?status=soon" },
    dueTotal && { icon: "request_quote", color: "text-amber-500", text: `শিক্ষকদের ${taka(dueTotal)} সম্মানী বাকি`, href: "/manager/payouts" },
  ].filter(Boolean) as { icon: string; color: string; text: string; href: string }[];

  const stat = (icon: string, cls: string, label: string, value: number, prefix: string, sub: string, href: string, delay: number) => (
    <div className="reveal h-full" style={{ transitionDelay: `${delay}ms` }}>
      <div className="tilt-card card relative h-full cursor-pointer rounded-2xl! p-5">
        <Link href={href} className="absolute inset-0 z-10 rounded-2xl" aria-label={label} />
        <div className="mb-4 flex items-center justify-between">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${cls}`}><span className="icon">{icon}</span></div>
          <span className="icon text-[20px] muted">arrow_forward</span>
        </div>
        <div className="text-2xl font-bold text-on-background md:text-3xl dark:text-background"><CountUp target={value} prefix={prefix} /></div>
        <div className="mt-1 text-sm font-bold muted">{label}</div>
        <div className="mt-2 text-xs muted">{sub}</div>
      </div>
    </div>
  );
  const action = (icon: string, cls: string, title: string, text: string, btn: string, href: string) => (
    <Link href={href} className="tilt-card card group flex cursor-pointer flex-col items-center rounded-2xl! p-6 text-center">
      <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full transition-transform group-hover:scale-110 ${cls}`}><span className="icon text-3xl">{icon}</span></div>
      <h3 className="mb-2 font-bold text-on-background dark:text-background">{title}</h3>
      <p className="mb-4 text-xs muted">{text}</p>
      <span className="mt-auto w-full rounded-lg bg-surface-container-low py-2 text-sm font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-white dark:bg-white/5 dark:text-primary-fixed dark:group-hover:bg-primary-fixed dark:group-hover:text-on-primary-fixed">{btn}</span>
    </Link>
  );

  return (
    <>
      <SessionGuard />
      <div className="reveal tilt-card card relative mb-4 overflow-hidden p-5 md:mb-8 md:p-8">
        <div className="relative z-10">
          <h2 className="mb-2 text-2xl font-bold text-on-background md:text-3xl dark:text-background">স্বাগতম, {me.full_name}! 👋</h2>
          <p className="mb-3 muted md:mb-6">আজ {bn(p)}টি পেমেন্ট যাচাই বাকি আর {bn(UPCOMING.length)}টি ক্লাস অ্যাসাইন করা আছে।</p>
          <div className="flex flex-wrap gap-2 md:gap-4">
            <Link href="/manager/payments" className="flex items-center gap-2 rounded-lg border border-error-container bg-error-container px-4 py-2 text-sm font-bold text-error transition-transform hover:-translate-y-px dark:border-error/30 dark:bg-error-container/20 dark:text-red-300"><span className="icon text-[18px]">pending_actions</span> {bn(p)}টি পেমেন্ট অপেক্ষমাণ</Link>
            <Link href="/manager/payouts" className="flex items-center gap-2 rounded-lg border border-secondary-container bg-secondary-container px-4 py-2 text-sm font-bold text-on-secondary-container transition-transform hover:-translate-y-px dark:border-secondary-fixed/30 dark:bg-secondary-fixed/20 dark:text-secondary-fixed"><span className="icon text-[18px]">request_quote</span> শিক্ষকদের {taka(dueTotal)} বাকি</Link>
            <Link href="/manager/inquiries" className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 transition-transform hover:-translate-y-px dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300"><span className="icon text-[18px]">contact_support</span> {bn(inquiries)}টি ভর্তির প্রশ্নের উত্তর বাকি</Link>
          </div>
        </div>
        <div className="pointer-events-none absolute top-0 right-0 h-64 w-64 -translate-y-1/2 translate-x-1/4 rounded-full bg-primary/5 blur-3xl dark:bg-primary-fixed/5" />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:mb-8 md:gap-6 xl:grid-cols-4">
        {stat("pending_actions", "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400", "অপেক্ষমাণ পেমেন্ট", p, "", "যাচাই করতে ক্লিক করুন", "/manager/payments", 0)}
        {stat("how_to_reg", "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400", "এই মাসে ভর্তি", enrolled.count ?? 0, "", `${MONTHS[new Date(now + DHAKA).getUTCMonth()]} মাসে অনুমোদিত`, "/manager/enrollments", 100)}
        {stat("co_present", "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400", "এই মাসে নেওয়া ক্লাস", DONE_THIS_MONTH, "", `সামনে আরও ${bn(UPCOMING.length)}টি`, "/manager/classes", 200)}
        {stat("request_quote", "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400", "শিক্ষকদের বাকি সম্মানী", dueTotal, "৳", `${bn(LEDGER.filter((r) => r.due).length)} জন শিক্ষক`, "/manager/payouts", 300)}
      </div>

      <div className="reveal mb-4 grid grid-cols-1 gap-3 md:mb-8 md:grid-cols-2 md:gap-6 xl:grid-cols-5" style={{ transitionDelay: "100ms" }}>
        <Link href="/manager/payments" className="tilt-card group relative flex cursor-pointer flex-col items-center overflow-hidden rounded-2xl bg-primary p-6 text-center text-on-primary shadow-md">
          <div className="absolute top-0 right-0 h-24 w-24 -translate-y-1/2 translate-x-1/4 rounded-full bg-white/10 blur-2xl" />
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-on-primary/20 backdrop-blur-sm transition-transform group-hover:scale-110"><span className="icon text-3xl text-white">fact_check</span></div>
          <h3 className="relative z-10 mb-2 font-bold text-white">পেমেন্ট যাচাই</h3>
          <p className="relative z-10 mb-4 text-xs text-primary-fixed">bKash TrxID মিলিয়ে কোর্স চালু করুন</p>
          <span className="relative z-10 mt-auto w-full rounded-lg bg-on-primary py-2 text-sm font-bold text-primary shadow-sm transition-transform group-hover:scale-105">{bn(p)}টি অপেক্ষমাণ</span>
        </Link>
        {action("how_to_reg", "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400", "ম্যানুয়াল এনরোল", "স্কলারশিপ বা ক্যাশে ভর্তি", "এনরোল করুন", "/manager/enrollments?manual=1")}
        {action("assignment_ind", "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400", "ক্লাস অ্যাসাইন", "শিক্ষক, বিষয় আর সময় ঠিক করুন", "অ্যাসাইন করুন", "/manager/classes")}
        {action("payments", "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400", "শিক্ষক পেমেন্ট", "নেওয়া ক্লাসের সম্মানী দিন", "হিসাব দেখুন", "/manager/payouts")}
        {action("campaign", "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400", "নোটিশ পাঠান", "ওয়েবসাইটে বা SMS এ জানান", "নোটিশ লিখুন", "/manager/notices")}
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-8 xl:grid-cols-3">
        <div className="space-y-4 md:space-y-8 xl:col-span-2">
          <div className="reveal card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div><h3 className="section-title">অপেক্ষমাণ পেমেন্ট</h3><p className="mt-1 text-xs muted">যেটা আগে এসেছে সেটা আগে যাচাই করুন</p></div>
              <Link href="/manager/payments" className="flex items-center text-sm font-bold text-primary hover:underline dark:text-primary-fixed">সব দেখুন <span className="icon text-[16px]">chevron_right</span></Link>
            </div>
            <div className="space-y-2">
              {((pending.data ?? []) as unknown as Pending[]).length ? ((pending.data ?? []) as unknown as Pending[]).map((x, i) => (
                <div key={x.id} className="row-in flex items-center gap-3 rounded-xl border border-transparent p-3 transition-colors hover:border-outline-variant/20 hover:bg-surface-container-low dark:hover:bg-white/5" style={{ "--i": i } as React.CSSProperties}>
                  <Avatar name={x.student?.full_name ?? "?"} />
                  <div className="min-w-0 grow">
                    <div className="truncate text-sm font-bold">{x.student?.full_name} <span className="font-normal muted">· {x.course?.title}</span></div>
                    <div className="mt-0.5 text-xs muted"><span className="trx">{x.trx_id}</span> · {taka(x.amount)} · {when(x.created_at)}</div>
                  </div>
                  <PayActions id={x.id} label={`${x.student?.full_name} · ${x.course?.title} · ${taka(x.amount)} · TrxID ${x.trx_id}`} />
                </div>
              )) : <EmptyState icon="task_alt" text="কোনো পেমেন্ট অপেক্ষমাণ নেই" />}
            </div>
          </div>

          <div className="reveal card p-6" style={{ transitionDelay: "150ms" }}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="section-title">সামনের ক্লাস</h3>
              <Link href="/manager/classes" className="flex items-center text-sm font-bold text-primary hover:underline dark:text-primary-fixed">সব দেখুন <span className="icon text-[16px]">chevron_right</span></Link>
            </div>
            <div className="space-y-2">
              {UPCOMING.map((c) => (
                <div key={c.id} className="flex items-center gap-4 rounded-xl border border-transparent p-3 transition-colors hover:border-outline-variant/20 hover:bg-surface-container-low dark:hover:bg-white/10">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-container-highest leading-tight text-on-surface-variant dark:bg-outline-variant/20 dark:text-surface-variant">
                    <span className="text-sm font-bold">{c.day}</span><span className="text-[10px]">{c.mon}</span></div>
                  <div className="min-w-0 grow"><h4 className="truncate text-sm font-bold">{c.topic}</h4><p className="mt-0.5 truncate text-xs muted">{teacherName(c.teacher)} · {c.time} · {courseName(c.course)}</p></div>
                  <Badge tone={CLASS_TYPE[c.type][1]}>{CLASS_TYPE[c.type][0]}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4 md:space-y-8">
          <div className="reveal card p-6" style={{ transitionDelay: "100ms" }}>
            <h3 className="section-title mb-1">বাকি সম্মানী (শিক্ষক ও মূল্যায়নকারী)</h3>
            <p className="mb-4 text-xs muted">{MONTHS[new Date(now + DHAKA).getUTCMonth()]} {bn(new Date(now + DHAKA).getUTCFullYear())}, নেওয়া ক্লাস অনুযায়ী</p>
            <div className="space-y-2">
              {LEDGER.map((r) => (
                <div key={r.name} className="flex items-center gap-3 rounded-xl p-2">
                  <Avatar name={r.name} size="h-9 w-9" />
                  <div className="min-w-0 grow"><div className="truncate text-sm font-bold">{r.name}</div><div className="text-xs muted">{[r.classes ? `${bn(r.classes)}টি ক্লাস` : "", r.scripts ? `${bn(r.scripts)}টি খাতা` : ""].filter(Boolean).join(" · ")}</div></div>
                  {r.due ? <Link href="/manager/payouts" className="btn-soft px-3! py-1.5! text-xs!">{taka(r.due)}</Link> : <Badge tone="green">পরিশোধিত</Badge>}
                </div>
              ))}
            </div>
          </div>

          <div className="reveal card p-6" style={{ transitionDelay: "200ms" }}>
            <h3 className="section-title mb-4">নজর দেওয়া দরকার</h3>
            <div className="space-y-2">
              {attention.length ? attention.map((a) => (
                <Link key={a.href + a.text} href={a.href} className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-surface-container-low dark:hover:bg-white/5">
                  <span className={`icon ${a.color}`}>{a.icon}</span>
                  <span className="grow text-sm font-bold">{a.text}</span>
                  <span className="icon text-[18px] muted">chevron_right</span>
                </Link>
              )) : <EmptyState icon="verified" text="সব ঠিক আছে" />}
            </div>
          </div>
        </div>
      </div>
      {/* পুরো পাতা নমুনা নয়: শুধু দুটো অংশ */}
      <p className="mt-4 flex items-center gap-2 text-xs text-amber-700 md:mt-8 dark:text-amber-300"><span className="icon text-[16px]">science</span>&quot;সামনের ক্লাস&quot; আর &quot;বাকি সম্মানী&quot; এখনো নমুনা তথ্য; বাকি সব database থেকে।</p>
    </>
  );
}
