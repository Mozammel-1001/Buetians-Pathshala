import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentRate, evMe, loadLedger } from "../data";
import { bn, fmtDate, lastMonths, monthKey, monthLabel, monthStart, taka } from "../lib";
import { Badge, CARD, MUTED } from "../ui";
import { MonthSelect } from "./month-select";

export const metadata = { title: "আমার সম্মানী" };

// আমার সম্মানী (evaluator_dashboard.html এর earn): মাসভিত্তিক কাটা খাতার হিসাব আর পরিশোধ। অ্যাডমিনের সম্মানী হয় না
export default function Page({ searchParams }: PageProps<"/evaluator/earn">) {
  return (
    <Suspense fallback={<div className="h-60 animate-pulse rounded-3xl bg-surface-container dark:bg-white/5" />}>
      <Loaded searchParams={searchParams} />
    </Suspense>
  );
}

const Stat = ({ v, l, cls = "text-on-background dark:text-background" }: { v: string; l: string; cls?: string }) => (
  <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4 dark:bg-white/5"><div className={`text-xl font-bold ${cls}`}>{v}</div><div className={`mt-1 text-xs ${MUTED}`}>{l}</div></div>
);

async function Loaded({ searchParams }: { searchParams: PageProps<"/evaluator/earn">["searchParams"] }) {
  const me = await evMe("/evaluator/earn");
  if (me.role === "admin") redirect("/evaluator");
  const sp = await searchParams;
  const sb = await createClient();
  const now = new Date().getTime();
  const months = lastMonths(now, 12);
  const want = String(Array.isArray(sp.month) ? sp.month[0] : sp.month ?? "");
  const month = months.includes(want) ? want : monthKey(now);
  const [led, rate] = await Promise.all([loadLedger(sb, me.id, monthStart(month)), currentRate(sb)]);
  const teacher = me.role === "teacher";
  return (
    <>
      <div className="mb-3 flex flex-col justify-between gap-2 md:mb-6 md:flex-row md:items-end md:gap-4">
        <div><h2 className="text-2xl font-bold text-on-background md:text-3xl dark:text-background">আমার সম্মানী</h2>
          <p className={`mt-1 text-sm ${MUTED}`}>{teacher ? "খাতা কাটার সম্মানী ক্লাসের সম্মানীর সাথে একসাথে পাবেন" : "ক্লাসের সম্মানীর মতো মাস শেষে অ্যাডমিন বা ম্যানেজার পরিশোধ করেন"}</p></div>
        <MonthSelect value={month} options={months.map((m) => ({ value: m, label: monthLabel(m) }))} />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-1.5 md:mb-6 md:grid-cols-3 md:gap-3 xl:grid-cols-6">
        <Stat v={bn(led.scripts)} l="কাটা খাতা" /><Stat v={bn(led.marks)} l="কাটা নম্বর (পূর্ণমান)" /><Stat v={taka(rate)} l="এখন প্রতি নম্বরে" />
        <Stat v={taka(led.marking)} l="মোট সম্মানী" cls="text-primary dark:text-primary-fixed" />
        {!teacher && <><Stat v={taka(led.paid)} l="পেয়েছেন" cls="text-emerald-600 dark:text-emerald-400" /><Stat v={taka(led.due)} l="বাকি" cls={led.due ? "text-error dark:text-red-300" : MUTED} /></>}
      </div>
      <div className={`${CARD} mb-3 overflow-hidden md:mb-6`}>
        <div className="border-b border-outline-variant/20 px-5 py-4 font-bold text-on-background dark:text-background">কাটা খাতার হিসাব</div>
        {led.items.length ? (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
            <thead><tr className={`border-b border-outline-variant/20 text-left text-xs font-bold ${MUTED}`}><th className="px-4 py-3">সময়</th><th className="px-4 py-3">পরীক্ষা ও প্রশ্ন</th><th className="px-4 py-3">পূর্ণমান</th><th className="px-4 py-3 text-right">সম্মানী</th></tr></thead>
            <tbody className="divide-y divide-outline-variant/10">{led.items.map((it, i) => (
              <tr key={i} className={`ev-row ${it.status === "returned" ? "opacity-70" : ""}`} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                <td className={`px-4 py-3 text-xs whitespace-nowrap ${MUTED}`}>{fmtDate(it.at)}</td>
                <td className="px-4 py-3 text-sm"><b>প্রশ্ন {bn(it.no)}</b>{it.task === "moderate" && <> <Badge tone="purple">দ্বিতীয় যাচাই</Badge></>}<div className={`text-xs ${MUTED}`}>{it.exam}</div></td>
                <td className="px-4 py-3">{bn(it.full)}</td>
                <td className="px-4 py-3 text-right font-bold">{it.status === "returned" ? <Badge tone="red">ফেরত, সম্মানী বাদ</Badge> : taka(it.pay)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className={`p-8 text-center ${MUTED}`}>এই মাসে কোনো খাতা কাটা হয়নি</p>}
      </div>
      {!teacher && (
        <div className={`${CARD} p-5`}>
          <div className="mb-1.5 font-bold text-on-background md:mb-3 dark:text-background">পরিশোধ</div>
          {led.payouts.length ? led.payouts.map((p) => (
            <div key={p.id} className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-surface-container-low p-3 dark:bg-white/5">
              <div><div className="text-sm font-bold">{p.method === "bkash" ? "bKash" : p.method === "nagad" ? "Nagad" : p.method === "bank" ? "ব্যাংক" : p.method === "cash" ? "নগদ টাকা" : p.method}{p.ref && <> · <span className="font-mono">{p.ref}</span></>}</div>
                <div className={`text-xs ${MUTED}`}>{fmtDate(p.at)}{p.note ? " · " + p.note : ""}</div></div>
              <div className="font-bold text-emerald-600 dark:text-emerald-400">{taka(p.amount)}</div>
            </div>
          )) : <p className={`text-sm ${MUTED}`}>এই মাসে এখনো পরিশোধ হয়নি</p>}
        </div>
      )}
      <p className="sr-only"><Link href="/evaluator">ড্যাশবোর্ড</Link></p>
    </>
  );
}
