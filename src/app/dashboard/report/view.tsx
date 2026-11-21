"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { bn } from "@/lib/content-schema";
import { SampleNote, useToast } from "../../admin/_components/kit";

type Exam = { id: number; title: string; date: string; marks: number; minutes: number; mine: number | null; rank?: number; of?: number; upcoming?: boolean };
const COURSES = [
  { id: 1, name: "উচ্চতর গণিত ১ম পত্র", batch: "এইচএসসি ব্যাচ" },
  { id: 2, name: "ইঞ্জিনিয়ারিং গণিত প্রস্তুতি", batch: "অ্যাডমিশন ব্যাচ" },
];
const EXAMS: Record<number, Exam[]> = {
  1: [
    { id: 1, title: "ম্যাট্রিক্স ও নির্ণায়ক, চ্যাপ্টার টেস্ট", date: "১২ অক্টো", marks: 50, minutes: 40, mine: 41, rank: 4, of: 86 },
    { id: 2, title: "সরলরেখা, চ্যাপ্টার টেস্ট", date: "২৬ অক্টো", marks: 50, minutes: 40, mine: 44, rank: 2, of: 84 },
    { id: 3, title: "মডেল টেস্ট ০১", date: "৯ নভে", marks: 100, minutes: 90, mine: null },
    { id: 4, title: "বৃত্ত, চ্যাপ্টার টেস্ট", date: "২৩ নভে", marks: 50, minutes: 40, mine: null, upcoming: true },
  ],
  2: [
    { id: 5, title: "ক্যালকুলাস পরিচিতি", date: "১৫ অক্টো", marks: 60, minutes: 45, mine: 37, rank: 12, of: 64 },
    { id: 6, title: "মডেল টেস্ট ০১", date: "৫ নভে", marks: 100, minutes: 90, mine: 58, rank: 20, of: 62 },
  ],
};
const BOARD = [
  { r: 1, name: "তাসনিম আহমেদ", inst: "ঢাকা কলেজ", p: 91 }, { r: 2, name: "রাফিউল ইসলাম", inst: "নটর ডেম কলেজ", p: 88 },
  { r: 3, name: "ফারহানা ইয়াসমিন", inst: "হলি ক্রস কলেজ", p: 85 }, { r: 4, name: "আপনি", inst: "আপনার কলেজ", p: 82, me: true },
  { r: 5, name: "মাহমুদুল হাসান", inst: "রাজউক কলেজ", p: 79 }, { r: 6, name: "সাদিয়া ইসলাম", inst: "ঢাকা কলেজ", p: 76 },
  { r: 7, name: "নাজমুল হক", inst: "সিটি কলেজ", p: 71 },
];
const ORD = ["", "১ম", "২য়", "৩য়", "৪র্থ", "৫ম", "৬ষ্ঠ", "৭ম"];
const ordinal = (n: number) => ORD[n] ?? `${bn(n)}তম`;
const MEDAL = ["#f59e0b", "#94a3b8", "#c2410c"];
const CARD = "rounded-3xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm dark:border-outline-variant/10 dark:bg-inverse-surface";

// পরীক্ষার রিপোর্ট ও লিডারবোর্ড (dashboard.html এর report-view): কোর্স বাছাই, দুই ট্যাব। ধাপ ১: শুধু UI (নমুনা তথ্য)
export function ReportView({ initialTab }: { initialTab: "report" | "board" }) {
  const sp = useSearchParams();
  const router = useRouter();
  const course = COURSES.find((c) => c.id === Number(sp.get("course"))) ?? COURSES[0];
  const [tab, setTab] = useState(initialTab);
  const [toast, node] = useToast();
  const exams = EXAMS[course.id];
  const held = exams.filter((e) => !e.upcoming);
  const attended = held.filter((e) => e.mine !== null);
  const pcts = attended.map((e) => ((e.mine ?? 0) / e.marks) * 100);
  const best = pcts.length ? Math.max(...pcts) : 0;
  const avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
  const total = attended.reduce((s, e) => s + (e.mine ?? 0), 0) / (attended.reduce((s, e) => s + e.marks, 0) || 1) * 100;
  const setTabUrl = (t: "report" | "board") => { setTab(t); window.history.replaceState(null, "", `/dashboard/${t === "board" ? "leaderboard" : "report"}${sp.get("course") ? `?course=${sp.get("course")}` : ""}`); };
  const tile = (icon: string, cls: string, value: string, label: string) => (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4 dark:bg-white/5"><span className={`icon ${cls}`}>{icon}</span><div className="mt-2 text-xl font-bold text-on-background dark:text-background">{value}</div><div className="text-xs muted">{label}</div></div>
  );
  return (
    <>
      {node}
      <div className="reveal mb-3 flex flex-wrap items-center gap-4 md:mb-6">
        <Link href="/dashboard" aria-label="ড্যাশবোর্ডে ফিরুন" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant/20 bg-surface-container-low hover:bg-surface-variant dark:bg-white/5"><span className="icon">arrow_back</span></Link>
        <div className="min-w-0 grow"><h2 className="text-2xl font-bold text-on-background md:text-3xl dark:text-background">{tab === "board" ? "লিডারবোর্ড" : "পরীক্ষার রিপোর্ট"}</h2><p className="mt-1 text-sm muted">{course.name} · {course.batch}</p></div>
      </div>
      <SampleNote />
      <div className="reveal mb-4 flex flex-col justify-between gap-3 md:mb-8 md:gap-4 xl:flex-row xl:items-center">
        <div className="flex flex-wrap gap-2">
          {COURSES.map((c) => <button key={c.id} type="button" onClick={() => router.replace(`/dashboard/${tab === "board" ? "leaderboard" : "report"}?course=${c.id}`)}
            className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${c.id === course.id ? "border-primary bg-primary text-on-primary" : "border-outline-variant/40 muted hover:border-primary hover:text-primary"}`}>{c.name}</button>)}
        </div>
        <div className="tabs w-fit" role="tablist">
          {([["report", "assessment", "আমার রিপোর্ট"], ["board", "leaderboard", "লিডারবোর্ড"]] as const).map(([k, ic, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} aria-current={tab === k ? "page" : undefined} className="tab flex items-center gap-1.5" onClick={() => setTabUrl(k)}><span className="icon text-[18px]">{ic}</span>{l}</button>
          ))}
        </div>
      </div>

      {tab === "report" ? (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 md:mb-8 md:gap-6 lg:grid-cols-2 2xl:grid-cols-3">
            <div className={`tilt-card ${CARD} flex items-center gap-6 p-6`}>
              <div className="grid h-32 w-32 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(var(--color-primary) ${total * 3.6}deg, rgba(120,130,125,0.2) 0)` }}>
                <div className="grid h-[104px] w-[104px] place-items-center rounded-full bg-surface-container-lowest text-center dark:bg-inverse-surface"><div><div className="text-2xl font-bold text-on-background dark:text-background">{bn(total.toFixed(1))}%</div><div className="text-[11px] muted">মোট প্রাপ্ত নম্বর</div></div></div>
              </div>
              <div className="min-w-0"><div className="text-xs muted">কোর্সে আপনার অবস্থান</div><div className="text-4xl leading-tight font-bold text-primary dark:text-primary-fixed">{ordinal(attended[attended.length - 1]?.rank ?? 0)}</div><div className="text-sm muted">{bn(attended[0]?.of ?? 0)} জনের মধ্যে</div>
                <button type="button" onClick={() => setTabUrl("board")} className="mt-3 flex items-center text-sm font-bold text-primary hover:underline dark:text-primary-fixed">লিডারবোর্ড দেখুন <span className="icon text-[16px]">chevron_right</span></button></div>
            </div>
            <div className={`${CARD} p-6`}>
              <div className="grid grid-cols-2 gap-3">
                {tile("task_alt", "text-primary dark:text-primary-fixed", `${bn(attended.length)}/${bn(held.length)}`, "দেওয়া পরীক্ষা")}
                {tile("event_busy", "text-error", bn(held.length - attended.length), "অনুপস্থিত")}
                {tile("emoji_events", "text-amber-500", `${bn(best.toFixed(0))}%`, "সর্বোচ্চ")}
                {tile("functions", "text-blue-500", `${bn(avg.toFixed(0))}%`, "গড় (দেওয়া পরীক্ষায়)")}
              </div>
              <p className="mt-3 flex items-start gap-1 text-[11px] muted"><span className="icon text-[14px]">info</span>মোট শতাংশ = প্রাপ্ত নম্বর ÷ সব পরীক্ষার পূর্ণমান। অনুপস্থিত পরীক্ষায় ০ ধরা হয়।</p>
            </div>
            <div className={`${CARD} p-6 lg:col-span-2 2xl:col-span-1`}>
              <h3 className="section-title mb-4">পরীক্ষাভিত্তিক অগ্রগতি</h3>
              <div className="relative flex h-44 items-end justify-between gap-2 px-1">
                <div className="pointer-events-none absolute inset-0 bottom-6 flex flex-col justify-between">{[0, 1, 2, 3].map((k) => <div key={k} className="h-0 w-full border-b border-outline-variant/10" />)}</div>
                {held.map((e) => { const p = e.mine === null ? null : (e.mine / e.marks) * 100; return (
                  <div key={e.id} className="z-10 flex h-full w-full flex-col items-center justify-end gap-1.5" title={`${e.title}: ${p === null ? "এই পরীক্ষায় অনুপস্থিত" : `${bn(p.toFixed(0))}%`}`}>
                    <span className={`text-[10px] font-bold ${p === null ? "text-error" : "muted"}`}>{p === null ? "অনু." : bn(Math.round(p))}</span>
                    <div className={`chart-bar w-6 rounded-t-md md:w-9 ${p === null ? "bg-error/30" : p === best ? "bg-primary dark:bg-primary-fixed" : "bg-primary-container/50"}`} style={{ "--target-height": `${p === null ? 6 : Math.max(6, p * 0.78)}%` } as React.CSSProperties} />
                    <span className="text-[10px] font-bold whitespace-nowrap muted">{e.date}</span>
                  </div>); })}
              </div>
            </div>
          </div>
          <div className={`reveal ${CARD} p-4 md:p-6`}>
            <h3 className="text-xl font-bold text-on-background dark:text-background">পরীক্ষার তালিকা</h3>
            <p className="mt-1 mb-4 text-xs muted">প্রতিটি পরীক্ষার সমাধান আর আপনার উত্তরপত্র PDF হিসেবে নামানো যাবে</p>
            <div className="space-y-3">
              {[...exams].reverse().map((e, i) => (
                <div key={e.id} className={`row-in flex flex-col gap-4 rounded-2xl border p-4 xl:flex-row xl:items-center ${e.mine === null && !e.upcoming ? "border-error/30 bg-error/5" : "border-outline-variant/20 bg-surface-container-low dark:bg-white/5"}`} style={{ "--i": i } as React.CSSProperties}>
                  <div className="flex min-w-0 grow items-center gap-4">
                    <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${e.upcoming ? "bg-blue-50 text-blue-700" : e.mine === null ? "bg-error/10 text-error" : "bg-surface-container-highest text-on-surface-variant dark:bg-outline-variant/20"}`}><span className="text-sm leading-tight font-bold">{e.date}</span></div>
                    <div className="min-w-0"><h4 className="font-bold text-on-background dark:text-background">{e.title}</h4><p className="mt-1 text-xs muted">পূর্ণমান {bn(e.marks)} · {bn(e.minutes)} মিনিট</p></div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 md:gap-5">
                    {e.upcoming ? <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700"><span className="icon text-[14px]">schedule</span>আসন্ন</span>
                      : e.mine === null ? <><span className="inline-flex items-center gap-1 rounded-full border border-error/30 bg-error-container px-3 py-1 text-xs font-bold text-error"><span className="icon text-[14px]">event_busy</span>অনুপস্থিত</span><span className="text-xs muted">০ ধরা হয়েছে</span></>
                      : <>
                        <div className="text-center"><div className="font-bold">{bn(e.mine)}/{bn(e.marks)}</div><div className="text-[11px] muted">প্রাপ্ত নম্বর</div></div>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">{bn(((e.mine / e.marks) * 100).toFixed(0))}%</span>
                        <div className="text-center"><div className="font-bold">{ordinal(e.rank ?? 0)}<span className="text-xs muted">/{bn(e.of ?? 0)}</span></div><div className="text-[11px] muted">অবস্থান</div></div></>}
                    <div className="flex gap-2">
                      {[["সমাধান", "picture_as_pdf"], ["উত্তরপত্র", "description"]].map(([l, ic]) => (
                        <button key={l} type="button" disabled={!!e.upcoming} title={e.upcoming ? "পরীক্ষার পরে পাওয়া যাবে" : ""} onClick={() => toast("PDF নামানো পরে যুক্ত হবে", "info")}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 px-3 py-2 text-xs font-bold text-primary transition-colors enabled:hover:bg-primary enabled:hover:text-on-primary disabled:cursor-not-allowed disabled:opacity-50 dark:text-primary-fixed"><span className="icon text-[16px]">{ic}</span>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="reveal mb-3 flex flex-col justify-between gap-3 md:mb-6 md:flex-row md:items-center md:gap-4">
            <div className={`tilt-card ${CARD} flex items-center gap-4 rounded-2xl! px-5 py-4`}><span className="icon text-3xl text-amber-500">military_tech</span><div><div className="text-xs muted">আপনার অবস্থান</div><div className="text-xl font-bold text-on-background dark:text-background">৪র্থ <span className="text-sm font-normal muted">/ {bn(86)} জন · ৮২%</span></div></div></div>
            <select className="field md:w-72" aria-label="পরীক্ষা"><option>সব পরীক্ষা মিলিয়ে ({bn(held.length)}টি)</option>{[...held].reverse().map((e) => <option key={e.id}>{e.title}</option>)}</select>
          </div>
          <div className="mb-4 grid grid-cols-1 gap-3 md:mb-8 md:grid-cols-3 md:gap-6 md:pt-4">
            {[1, 0, 2].map((i) => { const r = BOARD[i]; return (
              <div key={r.r} className={`tilt-card ${CARD} p-5 text-center ${i === 0 ? "ring-2 ring-amber-400/60 md:-translate-y-4" : ""}`}>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full text-xl font-bold text-white shadow-lg" style={{ background: MEDAL[i] }}>{ordinal(r.r)}</div>
                <div className="mt-3 truncate font-bold text-on-background dark:text-background">{r.name}</div><div className="truncate text-xs muted">{r.inst}</div>
                <div className="mt-2 text-2xl font-bold" style={{ color: MEDAL[i] }}>{bn(r.p)}%</div>
              </div>); })}
          </div>
          <div className={`reveal ${CARD} overflow-hidden`}>
            <div className="overflow-x-auto"><table className="w-full min-w-[560px]">
              <thead><tr className="border-b border-outline-variant/20 text-left text-xs font-bold muted"><th className="px-4 py-3">অবস্থান</th><th className="px-4 py-3">শিক্ষার্থী</th><th className="px-4 py-3">প্রাপ্ত</th><th className="px-4 py-3">প্রাপ্ত শতাংশ</th></tr></thead>
              <tbody className="divide-y divide-outline-variant/10">
                {BOARD.map((r, i) => (
                  <tr key={r.r} className={`row-in ${r.me ? "bg-primary/10" : "hover:bg-surface-container-low/60 dark:hover:bg-white/5"}`} style={{ "--i": i } as React.CSSProperties}>
                    <td className={`px-4 py-3 font-bold ${r.r <= 3 ? "text-amber-500" : ""}`}>{ordinal(r.r)}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${r.me ? "bg-primary text-white" : "bg-primary/10 text-primary dark:text-primary-fixed"}`}>{Array.from(r.name)[0]}</div><div className="min-w-0"><div className="truncate font-bold">{r.name}{r.me && <span className="text-xs text-primary dark:text-primary-fixed"> (আপনি)</span>}</div><div className="truncate text-xs muted">{r.inst}</div></div></div></td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{bn(r.p * 2)}/২০০</td>
                    <td className="w-[38%] px-4 py-3"><div className="flex items-center gap-3"><div className="h-2 grow rounded-full bg-surface-container-highest dark:bg-on-surface-variant"><div className="hbar h-2 rounded-full bg-primary dark:bg-primary-fixed" style={{ width: `${r.p}%` }} /></div><span className="w-10 text-sm font-bold">{bn(r.p)}%</span></div></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </>
      )}
    </>
  );
}
