import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SessionGuard } from "@/components/session-guard";
import { bn, taka } from "@/lib/content-schema";
import { CountUp } from "../_components/count-up";
import { CsvButton } from "../_components/csv-button";
import { Badge, EmptyState, PageHead, TabLinks } from "../_components/ui";

export const metadata: Metadata = { title: "মাসিক লেনদেন" };

const DHAKA = 6 * 3600 * 1000;
const MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const CAT: Record<string, string> = { fee: "কোর্স ফি", teacher: "শিক্ষক সম্মানী", service: "সার্ভিস (Vercel, Supabase)", sms: "SMS", refund: "রিফান্ড", other: "অন্যান্য" };
const TABS = [{ key: "all", label: "সব" }, { key: "income", label: "আয়" }, { key: "expense", label: "খরচ" }] as const;
const ym = (ms: number) => new Date(ms + DHAKA).toISOString().slice(0, 7);
// ডেমোর মতো তারিখ ("২০ নভে") আর নিচে সময়
const dayShort = (iso: string) => new Date(iso).toLocaleDateString("bn-BD", { day: "2-digit", month: "short", timeZone: "Asia/Dhaka" });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("bn-BD", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" });
const label = (m: string) => `${MONTHS[Number(m.slice(5)) - 1]} ${bn(m.slice(0, 4))}`;

type Raw = { id: string; happened_at: string; direction: "income" | "expense"; category: string; amount: number; reference: string | null; method: string | null; course_id: number | null; party_id: string | null; recorded_by: string | null };
type Tx = Raw & { course: { title: string } | null; party: { full_name: string } | null; by: string | null };

// মাসিক লেনদেন (শুধু admin), হুবহু admin_dashboard.html এর transactions: মাস বাছাই, চার সংখ্যা, ৬ মাসের আয়-খরচ, আয়ের উৎস, খরচের খাত, তালিকা
export default function TransactionsPage({ searchParams }: PageProps<"/admin/transactions">) {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse" />}>
      <Transactions searchParams={searchParams} />
    </Suspense>
  );
}

async function Transactions({ searchParams }: { searchParams: PageProps<"/admin/transactions">["searchParams"] }) {
  await requireAdmin("/admin/transactions");
  const sp = await searchParams;
  const now = new Date().getTime();
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(now + DHAKA); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); return d.toISOString().slice(0, 7); });
  const month = typeof sp.month === "string" && months.includes(sp.month) ? sp.month : months[0];
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as string) : "all";
  // ডেমোর মতো ২৫টা করে দেখায়, "আরও দেখুন" চাপলে আরও ২৫টা
  const lim = Math.min(Math.max(Number(sp.lim) || 25, 25), 1000);
  const supabase = await createClient();
  const startOf = (m: string) => new Date(`${m}-01T00:00:00+06:00`);
  const six = months.slice(0, 6).reverse();
  const from = startOf(six[0]).toISOString();
  const next = (m: string) => { const d = startOf(m); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString(); };

  const [{ data: all, error }, { data: sum }, { data: cs }] = await Promise.all([
    supabase.from("transactions").select("id, happened_at, direction, category, amount, reference, method, course_id, party_id, recorded_by").gte("happened_at", from).lt("happened_at", next(months[0])).order("happened_at", { ascending: false }).limit(5000),
    supabase.rpc("month_summary", { p_month: `${month}-01` }),
    supabase.from("courses").select("id, title"),
  ]);
  const raw = (all ?? []) as unknown as Raw[];
  // view এ foreign key নেই, তাই কোর্স আর পক্ষের নাম আলাদা এনে জোড়া লাগাই (তালিকার ২০০টির জন্য)
  const partyIds = [...new Set(raw.slice(0, 1000).flatMap((t) => [t.party_id, t.recorded_by]).filter((x): x is string => !!x))];
  const { data: ps } = partyIds.length ? await supabase.from("profiles").select("id, full_name").in("id", partyIds) : { data: [] as { id: string; full_name: string }[] };
  const courseName = new Map((cs ?? []).map((c) => [c.id, c.title]));
  const partyName = new Map((ps ?? []).map((p) => [p.id, p.full_name]));
  const txs: Tx[] = raw.map((t) => ({ ...t, course: t.course_id && courseName.has(t.course_id) ? { title: courseName.get(t.course_id)! } : null, party: t.party_id && partyName.has(t.party_id) ? { full_name: partyName.get(t.party_id)! } : null, by: t.recorded_by ? partyName.get(t.recorded_by) ?? null : null }));
  const inMonth = txs.filter((t) => ym(Date.parse(t.happened_at)) === month);
  const s = (sum as { income: number; expense: number; net: number; tx_count: number }[] | null)?.[0];
  const income = Number(s?.income ?? 0), expense = Number(s?.expense ?? 0);

  const chart = six.map((m) => ({
    m, i: txs.filter((t) => t.direction === "income" && ym(Date.parse(t.happened_at)) === m).reduce((a, t) => a + Number(t.amount), 0),
    e: txs.filter((t) => t.direction === "expense" && ym(Date.parse(t.happened_at)) === m).reduce((a, t) => a + Number(t.amount), 0),
  }));
  const max = Math.max(...chart.flatMap((c) => [c.i, c.e]), 1);
  const group = (dir: string, key: (t: Tx) => string) => {
    const g = new Map<string, number>();
    for (const t of inMonth.filter((x) => x.direction === dir)) g.set(key(t), (g.get(key(t)) ?? 0) + Number(t.amount));
    return [...g.entries()].sort((a, b) => b[1] - a[1]);
  };
  const sources = group("income", (t) => t.course?.title ?? "অন্যান্য");
  const costs = group("expense", (t) => CAT[t.category] ?? t.category);
  const list = inMonth.filter((t) => tab === "all" || t.direction === tab);
  const href = (k: string) => `/admin/transactions?month=${month}&tab=${k}`;
  const cnt = (k: string) => inMonth.filter((t) => k === "all" || t.direction === k).length;
  const card = (icon: string, cls: string, name: string, v: number, d: number) => (
    <div className="reveal h-full" style={{ transitionDelay: `${d}ms` }}>
      <div className="tilt-card card h-full rounded-2xl! p-5">
        <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${cls}`}><span className="icon">{icon}</span></div>
        <div className="text-2xl font-bold text-on-background md:text-3xl dark:text-background"><CountUp target={v} prefix={name === "লেনদেন" ? "" : "৳"} /></div>
        <div className="mt-1 text-sm font-bold muted">{name}</div>
      </div>
    </div>
  );

  return (
    <>
      <SessionGuard />
      <PageHead title="মাসিক লেনদেন" sub="কোর্স ফি থেকে আয় আর শিক্ষক সম্মানী, সার্ভিস ও রিফান্ডসহ সব খরচ">
        <form className="flex gap-2"><input type="hidden" name="tab" value={tab} />
          <select name="month" defaultValue={month} className="field w-auto min-w-[180px]" aria-label="মাস">{months.map((m) => <option key={m} value={m}>{label(m)}</option>)}</select>
          <button className="btn-soft">দেখুন</button>
        </form>
        <CsvButton name={`transactions-${month}`} rows={[["তারিখ", "ধরন", "খাত", "টাকা", "কোর্স", "পক্ষ", "মাধ্যম", "রেফারেন্স"], ...inMonth.map((t) => [t.happened_at, t.direction, t.category, t.amount, t.course?.title ?? "", t.party?.full_name ?? "", t.method ?? "", t.reference ?? ""])]} />
      </PageHead>
      {error && <p className="mb-3 rounded-xl bg-error/10 p-3 text-sm text-error">লেনদেন আনা যায়নি: {error.message}</p>}
      <div className="mb-4 grid grid-cols-2 gap-3 md:mb-6 md:gap-6 xl:grid-cols-4">
        {card("trending_up", "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400", "আয়", income, 0)}
        {card("trending_down", "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400", "খরচ", expense, 100)}
        {card("account_balance_wallet", "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400", "নিট", Math.abs(income - expense), 200)}
        {card("receipt_long", "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400", "লেনদেন", Number(s?.tx_count ?? 0), 300)}
      </div>
      <div className="mb-4 grid grid-cols-1 gap-4 md:mb-6 md:gap-6 xl:grid-cols-3">
        <div className="reveal card p-6 xl:col-span-2">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h3 className="section-title">গত ৬ মাসের আয় ও খরচ</h3>
            <div className="flex items-center gap-4 text-xs font-bold muted"><span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-primary dark:bg-primary-fixed" />আয়</span><span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-amber-500" />খরচ</span></div>
          </div>
          <div className="flex h-52 items-end justify-between gap-2">
            {chart.map((c) => (
              <div key={c.m} className="flex h-full w-full flex-col items-center justify-end gap-2" title={`${label(c.m)}: আয় ${taka(c.i)}, খরচ ${taka(c.e)}`}>
                <div className="flex h-full w-full items-end justify-center gap-1">
                  <div className="chart-bar w-4 rounded-t-md bg-primary md:w-8 dark:bg-primary-fixed" style={{ "--target-height": `${Math.max(2, (c.i / max) * 88)}%` } as React.CSSProperties} />
                  <div className="chart-bar w-4 rounded-t-md bg-amber-500 md:w-8" style={{ "--target-height": `${Math.max(2, (c.e / max) * 88)}%` } as React.CSSProperties} />
                </div>
                <span className="text-[10px] font-bold text-on-surface-variant">{MONTHS[Number(c.m.slice(5)) - 1]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="reveal card p-6">
          <h3 className="section-title mb-4">আয়ের উৎস</h3>
          <div className="mb-6 space-y-4">
            {sources.length ? sources.map(([n, v]) => (
              <div key={n}><div className="mb-1.5 flex justify-between text-xs font-bold"><span>{n}</span><span className="text-primary dark:text-primary-fixed">{taka(v)}</span></div>
                <div className="h-2 rounded-full bg-surface-container-highest dark:bg-on-surface-variant"><div className="hbar h-2 rounded-full bg-primary dark:bg-primary-fixed" style={{ "--target-width": `${(v / (sources[0][1] || 1)) * 100}%` } as React.CSSProperties} /></div></div>
            )) : <p className="text-sm muted">এই মাসে আয় নেই</p>}
          </div>
          <h3 className="section-title mb-2">খরচের খাত</h3>
          {costs.length ? <ul className="divide-y divide-outline-variant/20 text-sm">{costs.map(([n, v]) => <li key={n} className="flex justify-between py-2"><span>{n}</span><b>{taka(v)}</b></li>)}</ul> : <p className="text-sm muted">এই মাসে খরচ নেই</p>}
        </div>
      </div>
      <div className="reveal card p-4 md:p-6">
        <div className="mb-3 md:mb-5"><TabLinks items={TABS.map((t) => ({ key: t.key, label: t.label, count: bn(cnt(t.key)) }))} active={tab} href={href} /></div>
        {list.length === 0 ? <EmptyState icon="receipt_long" text="এই মাসে কোনো লেনদেন নেই" /> : (
          <div className="custom-scrollbar -mx-2 overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead><tr className="border-b border-outline-variant/20"><th className="th">তারিখ</th><th className="th">বিবরণ</th><th className="th">খাত</th><th className="th">মাধ্যম</th><th className="th">রেফারেন্স</th><th className="th">করেছেন</th><th className="th text-right">পরিমাণ</th></tr></thead>
              <tbody className="divide-y divide-outline-variant/10">
                {list.slice(0, lim).map((t, i) => (
                  <tr key={t.id} className="row-in hover:bg-surface-container-low/60 dark:hover:bg-white/5" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                    <td className="td whitespace-nowrap"><div className="font-bold">{dayShort(t.happened_at)}</div><div className="text-xs muted">{timeOf(t.happened_at)}</div></td>
                    <td className="td max-w-[260px]"><div className="font-bold">{t.party?.full_name ?? CAT[t.category] ?? t.category}</div>{t.course && <div className="truncate text-xs muted">{t.course.title}</div>}</td>
                    <td className="td"><Badge tone={t.direction === "income" ? "green" : "amber"}>{CAT[t.category] ?? t.category}</Badge></td>
                    <td className="td text-xs">{t.method ?? "—"}</td>
                    <td className="td trx text-xs">{t.reference ?? "—"}</td>
                    <td className="td text-xs whitespace-nowrap muted">{t.by ?? "সিস্টেম"}</td>
                    <td className={`td text-right font-bold whitespace-nowrap ${t.direction === "income" ? "text-emerald-700 dark:text-emerald-300" : "text-error dark:text-red-300"}`}>{t.direction === "income" ? "+" : "−"}{taka(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length > lim && <div className="mt-5 text-center"><Link scroll={false} href={`${href(tab)}&lim=${lim + 25}`} className="btn-outline">আরও দেখুন (বাকি {bn(list.length - lim)}টি)</Link></div>}
          </div>
        )}
      </div>
    </>
  );
}
