import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SessionGuard } from "@/components/session-guard";
import { bn, taka } from "@/lib/content-schema";
import { auditLabel } from "./_components/audit-labels";
import { CountUp } from "./_components/count-up";
import { PayActions } from "./_components/pay-actions";
import { Avatar, EmptyState, when } from "./_components/ui";

// ড্যাশবোর্ড, হুবহু admin_dashboard.html এর overview: স্বাগত, চার সংখ্যা, দ্রুত কাজ, অপেক্ষমাণ পেমেন্ট, গত ৭ দিনের আয়,
// কোর্সভিত্তিক শিক্ষার্থী, আজকের ক্লাস, নজর দেওয়া দরকার, সাম্প্রতিক কার্যকলাপ। সব সংখ্যা সরাসরি database থেকে
export default function AdminHome() {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse" />}>
      <Overview />
    </Suspense>
  );
}

const DHAKA = 6 * 3600 * 1000;
const dkey = (ms: number) => new Date(ms + DHAKA).toISOString().slice(0, 10);
const WD = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];
const MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];

type Pending = { id: number; amount: number; trx_id: string; created_at: string; student: { full_name: string } | null; course: { title: string } | null };
type Log = { id: number; action: string; entity: string; entity_id: string | null; meta: { title?: string } | null; created_at: string };

async function Overview() {
  const me = await requireStaff("/admin");
  const admin = me.role === "admin";
  const supabase = await createClient();
  const now = new Date().getTime();
  const monthStart = new Date(`${dkey(now).slice(0, 7)}-01T00:00:00+06:00`).toISOString();
  const weekAgo = new Date(now - 6 * 86400000).toISOString();
  const since = monthStart < weekAgo ? monthStart : weekAgo;
  const soon = new Date(now + 7 * 86400000).toISOString();
  const dayStart = new Date(`${dkey(now)}T00:00:00+06:00`).getTime();

  const [students, active, paid, pending, pendingCount, courses, enr, live, qa, expiring, logs] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("payments").select("amount, reviewed_at").eq("status", "approved").gte("reviewed_at", since).limit(5000),
    supabase.from("payments").select("id, amount, trx_id, created_at, student:profiles!payments_user_id_fkey(full_name), course:courses(title)").eq("status", "pending").order("created_at").limit(4),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("courses").select("id, title, is_published").order("position").order("id"),
    supabase.from("enrollments").select("course_id").eq("status", "active").limit(20000),
    supabase.from("live_sessions").select("id, title, status, scheduled_at, started_at").or(`status.eq.live,and(status.eq.scheduled,scheduled_at.gte.${new Date(dayStart).toISOString()},scheduled_at.lt.${new Date(dayStart + 86400000).toISOString()})`).limit(6),
    supabase.from("qa_questions").select("id", { count: "exact", head: true }).eq("kind", "study").is("answered_at", null),
    supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("status", "active").not("expires_at", "is", null).lte("expires_at", soon).gte("expires_at", new Date(now).toISOString()),
    admin ? supabase.from("audit_logs").select("id, action, entity, entity_id, meta, created_at").order("id", { ascending: false }).limit(5) : Promise.resolve({ data: [] as Log[] }),
  ]);

  const pays = (paid.data ?? []) as { amount: number; reviewed_at: string }[];
  const monthKey = dkey(now).slice(0, 7);
  const income = pays.filter((p) => dkey(Date.parse(p.reviewed_at)).startsWith(monthKey)).reduce((t, p) => t + Number(p.amount), 0);
  const week = Array.from({ length: 7 }, (_, i) => {
    const ms = now - (6 - i) * 86400000;
    const k = dkey(ms);
    return { d: WD[new Date(ms + DHAKA).getUTCDay()], v: pays.filter((p) => dkey(Date.parse(p.reviewed_at)) === k).reduce((t, p) => t + Number(p.amount), 0) };
  });
  const maxV = Math.max(...week.map((w) => w.v), 0);
  const weekSum = week.reduce((t, w) => t + w.v, 0);

  const perCourse = new Map<number, number>();
  for (const e of (enr.data ?? []) as { course_id: number }[]) perCourse.set(e.course_id, (perCourse.get(e.course_id) ?? 0) + 1);
  const courseRows = ((courses.data ?? []) as { id: number; title: string; is_published: boolean }[]).map((c) => ({ ...c, n: perCourse.get(c.id) ?? 0 }));
  const maxStudents = Math.max(...courseRows.map((c) => c.n), 0);

  const p = pendingCount.count ?? 0;
  const liveNow = ((live.data ?? []) as { status: string }[]).filter((l) => l.status === "live").length;
  const unanswered = qa.count ?? 0;
  const attention = [
    p && { icon: "pending_actions", color: "text-error", text: `${bn(p)}টি পেমেন্ট যাচাই বাকি`, href: "/admin/payments" },
    unanswered && { icon: "forum", color: "text-amber-500", text: `${bn(unanswered)}টি পড়াশোনার প্রশ্নের উত্তর দেওয়া বাকি`, href: "/admin/qa" },
    (expiring.count ?? 0) && { icon: "timer", color: "text-amber-500", text: `${bn(expiring.count ?? 0)}টি এনরোলমেন্টের মেয়াদ ৭ দিনে শেষ`, href: "/admin/enrollments?status=soon" },
  ].filter(Boolean) as { icon: string; color: string; text: string; href: string }[];

  const stat = (icon: string, cls: string, label: string, value: number, prefix: string, sub: string, href: string | null, delay: number) => (
    <div className="reveal h-full" style={{ transitionDelay: `${delay}ms` }}>
      <div className={`tilt-card card h-full rounded-2xl! p-5 ${href ? "cursor-pointer" : ""}`}>
        {href && <Link href={href} className="absolute inset-0 z-10 rounded-2xl" aria-label={label} />}
        <div className="mb-4 flex items-center justify-between">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${cls}`}><span className="icon">{icon}</span></div>
          {href && <span className="icon text-[20px] muted">arrow_forward</span>}
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
      <span className="mt-auto w-full rounded-lg bg-surface-container-low py-2 text-sm font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-white dark:bg-white/5 dark:text-primary-fixed">{btn}</span>
    </Link>
  );
  const chip = "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold bg-secondary-container text-on-secondary-container dark:bg-secondary-fixed/20 dark:text-secondary-fixed";

  return (
    <>
      <SessionGuard />
      <div className="reveal tilt-card card relative mb-4 flex flex-col items-center justify-between overflow-hidden p-5 md:mb-8 md:flex-row md:p-8">
        <div className="relative z-10 w-full">
          <h2 className="mb-2 text-2xl font-bold text-on-background md:text-3xl dark:text-background">স্বাগতম, {me.full_name}! 👋</h2>
          <p className="mb-3 muted md:mb-6">আজ {bn(p)}টি পেমেন্ট যাচাই বাকি{liveNow ? ` এবং ${bn(liveNow)}টি ক্লাস লাইভ চলছে` : ""}।</p>
          <div className="flex flex-wrap gap-2 md:gap-4">
            <Link href="/admin/payments" className="flex items-center gap-2 rounded-lg bg-error-container px-4 py-2 text-sm font-bold text-error dark:bg-error-container/20 dark:text-red-300"><span className="icon text-[18px]">pending_actions</span>{bn(p)}টি পেমেন্ট অপেক্ষমাণ</Link>
            <Link href="/admin/live" className={chip}><span className="icon text-[18px]">sensors</span>{bn(liveNow)}টি লাইভ ক্লাস</Link>
            <Link href="/admin/qa" className={chip}><span className="icon text-[18px]">forum</span>{bn(unanswered)}টি প্রশ্নের উত্তর বাকি</Link>
          </div>
        </div>
        <div className="pointer-events-none absolute top-0 right-0 h-64 w-64 -translate-y-1/2 translate-x-1/4 rounded-full bg-primary/5 blur-3xl dark:bg-primary-fixed/5" />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:mb-8 md:gap-6 xl:grid-cols-4">
        {stat("groups", "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400", "মোট শিক্ষার্থী", students.count ?? 0, "", `${bn(courseRows.length)}টি কোর্সে`, admin ? "/admin/users" : null, 0)}
        {stat("school", "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400", "সক্রিয় এনরোলমেন্ট", active.count ?? 0, "", `${bn(courseRows.filter((c) => c.is_published).length)}টি কোর্স প্রকাশিত`, "/admin/enrollments", 100)}
        {stat("payments", "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400", `আয় (${MONTHS[new Date(now + DHAKA).getUTCMonth()]})`, income, "৳", "অনুমোদিত পেমেন্ট থেকে", admin ? "/admin/transactions" : null, 200)}
        {stat("pending_actions", "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400", "অপেক্ষমাণ পেমেন্ট", p, "", "যাচাই করতে হবে", "/admin/payments", 300)}
      </div>

      <div className="reveal mb-4 grid grid-cols-1 gap-3 md:mb-8 md:grid-cols-2 md:gap-6 xl:grid-cols-4" style={{ transitionDelay: "100ms" }}>
        <Link href="/admin/payments" className="tilt-card group relative flex cursor-pointer flex-col items-center overflow-hidden rounded-2xl bg-primary p-6 text-center text-on-primary shadow-md">
          <div className="absolute top-0 right-0 h-24 w-24 -translate-y-1/2 translate-x-1/4 rounded-full bg-white/10 blur-2xl" />
          <div className="relative z-10 mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-on-primary/20 backdrop-blur-sm transition-transform group-hover:scale-110"><span className="icon text-3xl">verified_user</span></div>
          <h3 className="relative z-10 mb-2 font-bold text-white">পেমেন্ট যাচাই</h3>
          <p className="relative z-10 mb-4 text-xs text-primary-fixed">bKash TrxID মিলিয়ে কোর্স চালু করুন</p>
          <span className="relative z-10 mt-auto w-full rounded-lg bg-on-primary py-2 text-sm font-bold text-primary shadow-sm transition-transform group-hover:scale-105">{bn(p)}টি অপেক্ষমাণ</span>
        </Link>
        {admin && action("add_circle", "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400", "নতুন কোর্স", "দাম, রুটিন আর ছবি দিয়ে কোর্স চালু করুন", "কোর্স তৈরি করুন", "/admin/courses/new")}
        {action("calendar_add_on", "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400", "লাইভ ক্লাস শিডিউল", "কোর্স, শিক্ষক আর সময় ঠিক করুন", "ক্লাস শিডিউল করুন", "/admin/live")}
        {action("campaign", "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400", "নোটিশ পাঠান", "ওয়েবসাইটে বা SMS এ শিক্ষার্থীদের জানান", "নোটিশ লিখুন", "/admin/notices")}
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-8 xl:grid-cols-3">
        <div className="space-y-4 md:space-y-8 xl:col-span-2">
          <div className="reveal card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div><h3 className="section-title">অপেক্ষমাণ পেমেন্ট</h3><p className="mt-1 text-xs muted">যেটা আগে এসেছে সেটা আগে যাচাই করুন</p></div>
              <Link href="/admin/payments" className="flex items-center text-sm font-bold text-primary hover:underline dark:text-primary-fixed">সব দেখুন <span className="icon text-[18px]">chevron_right</span></Link>
            </div>
            <div className="space-y-2">
              {(pending.data as unknown as Pending[] ?? []).length ? (pending.data as unknown as Pending[]).map((x, i) => (
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
            <div className="mb-6 flex items-center justify-between">
              <h3 className="section-title">গত ৭ দিনের আয়</h3>
              <span className="rounded-lg border border-primary/20 bg-surface-container-low px-3 py-1 text-xs font-bold text-primary dark:bg-white/5 dark:text-primary-fixed">মোট {taka(weekSum)}</span>
            </div>
            <div className="relative mt-4 flex h-52 items-end justify-between gap-2 px-2">
              <div className="pointer-events-none absolute inset-0 bottom-6 flex flex-col justify-between">
                {[0, 1, 2, 3].map((k) => <div key={k} className="h-0 w-full border-b border-outline-variant/10" />)}
              </div>
              {week.map((w, i) => (
                <div key={i} className="group z-10 flex h-full w-full flex-col items-center justify-end gap-2" title={`${w.d}: ${taka(w.v)}`}>
                  <span className="text-[10px] font-bold opacity-0 transition-opacity group-hover:opacity-100 muted">{taka(w.v)}</span>
                  <div className={`chart-bar w-8 rounded-t-md md:w-12 ${w.v === maxV && maxV > 0 ? "bg-primary shadow-[0_0_15px_rgba(0,108,73,0.3)] dark:bg-primary-fixed" : "bg-primary/30 dark:bg-primary-fixed/30"}`}
                    style={{ "--target-height": `${maxV ? Math.max(3, (w.v / maxV) * 78) : 3}%` } as React.CSSProperties} />
                  <span className="text-[10px] font-bold text-on-surface-variant">{w.d}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="reveal card p-6" style={{ transitionDelay: "200ms" }}>
            <h3 className="section-title mb-5">কোর্সভিত্তিক শিক্ষার্থী</h3>
            {courseRows.length === 0 ? <EmptyState icon="school" text="এখনো কোনো কোর্স নেই" /> : (
              <div className="space-y-4">
                {courseRows.map((c) => (
                  <div key={c.id}>
                    <div className="mb-1.5 flex justify-between text-xs font-bold">
                      <span className="text-on-background dark:text-background">{c.title}{c.is_published ? "" : <span className="muted"> (ড্রাফট)</span>}</span>
                      <span className="text-primary dark:text-primary-fixed">{bn(c.n)} জন</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-surface-container-highest dark:bg-on-surface-variant">
                      <div className="hbar h-2 rounded-full bg-primary dark:bg-primary-fixed" style={{ "--target-width": `${maxStudents ? Math.max(2, (c.n / maxStudents) * 100) : 0}%` } as React.CSSProperties} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 md:space-y-8">
          <div className="reveal card p-6" style={{ transitionDelay: "100ms" }}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="section-title">লাইভ ও আজকের ক্লাস</h3>
              <Link href="/admin/live" aria-label="লাইভ ক্লাস" className="text-on-surface-variant transition-colors hover:text-primary"><span className="icon text-[20px]">more_horiz</span></Link>
            </div>
            <div className="space-y-3">
              {((live.data ?? []) as { id: string; title: string; status: string; scheduled_at: string | null }[]).length ? ((live.data ?? []) as { id: string; title: string; status: string; scheduled_at: string | null }[]).map((l) => (
                <Link key={l.id} href="/admin/live" className="flex items-start gap-4 rounded-xl border border-transparent p-3 transition-colors hover:border-outline-variant/20 hover:bg-surface-container-low dark:hover:bg-white/10">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border ${l.status === "live" ? "border-error/20 bg-error-container/30 text-error" : "border-transparent bg-surface-container-highest text-on-surface-variant dark:bg-outline-variant/20"}`}>
                    <span className="icon text-2xl">{l.status === "live" ? "sensors" : "video_camera_front"}</span>
                  </div>
                  <div className="min-w-0 grow">
                    <h4 className="text-sm font-bold text-on-background dark:text-background">{l.title}</h4>
                    <p className={`mt-1 flex items-center gap-1 text-xs ${l.status === "live" ? "font-bold text-error" : "muted"}`}>
                      <span className="icon text-[14px]">schedule</span>{l.status === "live" ? "এখন লাইভ" : l.scheduled_at ? when(l.scheduled_at) : "আজ"}
                    </p>
                  </div>
                </Link>
              )) : <EmptyState icon="event_available" text="আজ আর কোনো ক্লাস নেই" />}
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

          {admin && (
            <div className="reveal card p-6" style={{ transitionDelay: "300ms" }}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="section-title">সাম্প্রতিক কার্যকলাপ</h3>
                <Link href="/admin/audit" className="text-sm font-bold text-primary hover:underline dark:text-primary-fixed">অডিট লগ</Link>
              </div>
              {((logs.data ?? []) as Log[]).length === 0 ? <EmptyState icon="history" text="এখনো কিছু ঘটেনি" /> : (
                <div className="relative space-y-4 pl-5 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-0.5 before:bg-outline-variant/30">
                  {((logs.data ?? []) as Log[]).map((l) => (
                    <div key={l.id} className="relative">
                      <span className={`absolute top-1 -left-5 h-3.5 w-3.5 rounded-full border-2 border-surface-container-lowest dark:border-inverse-surface ${auditLabel(l.action).dot}`} />
                      <div className="text-sm font-bold">{auditLabel(l.action).label}: {l.meta?.title ?? `#${l.entity_id ?? ""}`}</div>
                      <div className="mt-0.5 text-xs muted">{when(l.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
