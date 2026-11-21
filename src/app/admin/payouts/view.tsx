"use client";

import { useState } from "react";
import { bn, taka } from "@/lib/content-schema";
import { Field, Modal, SampleNote, useToast } from "../_components/kit";
import { Avatar, Badge, EmptyState, PageHead } from "../_components/ui";

type R = { id: number; name: string; role: "শিক্ষক" | "মূল্যায়নকারী"; classes: number; classTotal: number; scripts: number; marks: number; earned: number; paid: number };
const START: R[] = [
  { id: 1, name: "রাফিউল ইসলাম", role: "শিক্ষক", classes: 8, classTotal: 6400, scripts: 40, marks: 600, earned: 1200, paid: 7600 },
  { id: 2, name: "তাসনিম আহমেদ", role: "শিক্ষক", classes: 6, classTotal: 4800, scripts: 0, marks: 0, earned: 0, paid: 2000 },
  { id: 3, name: "ফারহানা ইয়াসমিন", role: "শিক্ষক", classes: 5, classTotal: 2500, scripts: 22, marks: 330, earned: 660, paid: 0 },
  { id: 4, name: "নাজমুল হক", role: "মূল্যায়নকারী", classes: 0, classTotal: 0, scripts: 90, marks: 1350, earned: 2700, paid: 2700 },
];
const HISTORY = [
  { name: "রাফিউল ইসলাম", amount: 7600, method: "bKash", ref: "BK8H2K9Q", time: "১০ নভেম্বর, ২:৩০ পিএম", by: "অ্যাডমিন" },
  { name: "নাজমুল হক", amount: 2700, method: "নগদ", ref: "NG7D3L1P", time: "৮ নভেম্বর, ১১:০০ এএম", by: "অ্যাডমিন" },
  { name: "তাসনিম আহমেদ", amount: 2000, method: "bKash", ref: "BK2M4N8R", time: "৫ নভেম্বর, ৪:১৫ পিএম", by: "ম্যানেজার" },
];

// সম্মানী (admin_dashboard.html এর payouts): মাসের সারাংশ, জনপ্রতি হিসাব, পেমেন্টের ইতিহাস। ধাপ ১: শুধু UI
export function PayoutsView() {
  const [pay, setPay] = useState<R | null>(null);
  const [toast, node] = useToast();
  const [info, setInfo] = useState<R | null>(null);
  const total = (r: R) => r.classTotal + r.earned;
  const due = (r: R) => total(r) - r.paid;
  const sum = (f: (r: R) => number) => START.reduce((s, r) => s + f(r), 0);
  const card = (icon: string, cls: string, label: string, value: string, sub: string, i: number) => (
    <div className="reveal h-full" style={{ transitionDelay: `${i * 100}ms` }}>
      <div className="tilt-card card h-full rounded-2xl! p-5">
        <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${cls}`}><span className="icon">{icon}</span></div>
        <div className="text-2xl font-bold md:text-3xl">{value}</div><div className="mt-1 text-sm font-bold muted">{label}</div><div className="mt-2 text-xs muted">{sub}</div>
      </div>
    </div>
  );
  return (
    <>
      {node}
      <PageHead title="সম্মানী" sub="নেওয়া ক্লাস আর কাটা খাতার হিসাবে শিক্ষক ও মূল্যায়নকারীদের সম্মানী দিন, রেকর্ড রাখুন">
        <select className="field md:w-56" aria-label="মাস" defaultValue="n"><option value="n">নভেম্বর ২০২৬</option><option>অক্টোবর ২০২৬</option><option>সেপ্টেম্বর ২০২৬</option></select>
      </PageHead>
      <SampleNote />
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3 md:mb-6 md:gap-6">
        {card("request_quote", "bg-blue-100 text-blue-600", "মোট সম্মানী", taka(sum(total)), `${bn(sum((r) => r.classes))}টি ক্লাস · ${bn(sum((r) => r.scripts))}টি খাতা`, 0)}
        {card("task_alt", "bg-emerald-100 text-emerald-600", "পরিশোধ করা হয়েছে", taka(sum((r) => r.paid)), `${bn(HISTORY.length)}টি পেমেন্ট`, 1)}
        {card("pending_actions", "bg-red-100 text-red-600", "বাকি", taka(sum(due)), `${bn(START.filter((r) => due(r) > 0).length)} জন পাবেন`, 2)}
      </div>
      <div className="reveal card mb-3 p-4 md:mb-6 md:p-6">
        <h3 className="section-title mb-4">জনপ্রতি হিসাব (শিক্ষক ও মূল্যায়নকারী)</h3>
        <div className="custom-scrollbar -mx-2 overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead><tr className="border-b border-outline-variant/20"><th className="th">নাম</th><th className="th">ক্লাস</th><th className="th">খাতা কাটা</th><th className="th">মোট সম্মানী</th><th className="th">পরিশোধিত</th><th className="th">বাকি</th><th className="th">স্ট্যাটাস</th><th className="th text-right">অ্যাকশন</th></tr></thead>
            <tbody className="divide-y divide-outline-variant/10">
              {START.map((r, i) => (
                <tr key={r.id} className="row-in hover:bg-surface-container-low/60 dark:hover:bg-white/5" style={{ "--i": i } as React.CSSProperties}>
                  <td className="td"><div className="flex items-center gap-3"><Avatar name={r.name} size="h-9 w-9" /><div><div className="font-bold">{r.name}</div><Badge tone={r.role === "শিক্ষক" ? "green" : "cyan"}>{r.role}</Badge></div></div></td>
                  <td className="td">{r.classes ? <>{bn(r.classes)}টি<div className="text-xs muted">{taka(r.classTotal)}</div></> : <span className="muted">—</span>}</td>
                  <td className="td">{r.scripts ? <>{bn(r.scripts)}টি<div className="text-xs muted">{bn(r.marks)} নম্বর · {taka(r.earned)}</div></> : <span className="muted">—</span>}</td>
                  <td className="td font-bold">{taka(total(r))}</td>
                  <td className="td font-bold text-emerald-700 dark:text-emerald-300">{taka(r.paid)}</td>
                  <td className={`td font-bold ${due(r) ? "text-error" : "muted"}`}>{taka(due(r))}</td>
                  <td className="td">{!due(r) ? <Badge tone="green" icon="check_circle">পরিশোধিত</Badge> : r.paid ? <Badge tone="amber">আংশিক</Badge> : <Badge tone="red">বাকি</Badge>}</td>
                  <td className="td"><div className="flex items-center justify-end gap-1">
                    <button type="button" className="icon-btn" title="বিস্তারিত" aria-label="বিস্তারিত" onClick={() => setInfo(r)}><span className="icon text-[20px]">receipt_long</span></button>
                    {due(r) > 0 && <button type="button" className="btn-soft px-3! py-1.5!" onClick={() => setPay(r)}><span className="icon text-[18px]">payments</span> পেমেন্ট দিন</button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="reveal card p-4 md:p-6">
        <h3 className="section-title mb-4">পেমেন্টের ইতিহাস</h3>
        {HISTORY.length ? (
          <div className="space-y-3">
            {HISTORY.map((p, i) => (
              <div key={p.ref} className="row-in flex flex-col justify-between gap-3 rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4 sm:flex-row sm:items-center dark:bg-white/5" style={{ "--i": i } as React.CSSProperties}>
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><span className="icon">payments</span></div>
                  <div className="min-w-0"><div className="font-bold">{p.name} <span className="font-normal muted">· {p.method}</span></div><div className="mt-0.5 text-xs muted">{p.time} · <span className="trx">{p.ref}</span> · দিয়েছেন {p.by}</div></div>
                </div>
                <div className="shrink-0 text-lg font-bold text-emerald-700 dark:text-emerald-300">{taka(p.amount)}</div>
              </div>
            ))}
          </div>
        ) : <EmptyState icon="history" text="এই মাসে এখনো কোনো পেমেন্ট দেওয়া হয়নি" />}
      </div>
      <Modal open={!!info} onClose={() => setInfo(null)} icon="receipt_long" title={info?.name ?? ""} sub={info ? `নভেম্বর ২০২৬ · ${bn(info.classes)}টি ক্লাস · ${bn(info.scripts)}টি খাতা · ${taka(total(info))}` : ""} size="max-w-xl"
        actions={[{ label: "বন্ধ করুন", kind: "ghost" }, { label: "CSV ডাউনলোড", onClick: () => toast("CSV নামানো পরে যুক্ত হবে", "info") }]}>
        {info && (<>
          {info.classes > 0 && (<>
            <div className="mb-1 font-bold">ক্লাস</div>
            <table className="mb-4 w-full">
              <thead><tr className="border-b border-outline-variant/20"><th className="th px-2!">তারিখ</th><th className="th px-2!">বিষয়</th><th className="th px-2! text-right">সম্মানী</th></tr></thead>
              <tbody className="divide-y divide-outline-variant/10">
                {Array.from({ length: Math.min(info.classes, 4) }, (_, k) => (
                  <tr key={k}><td className="td px-2! whitespace-nowrap">{bn(4 + k * 4)} নভে</td><td className="td px-2!">{["সরলরেখা: প্রশ্ন সমাধান", "বৃত্ত", "ভেক্টর: মৌলিক ধারণা", "ম্যাট্রিক্স ও নির্ণায়ক"][k]}<div className="text-xs muted">প্রগ্রেসিভ এইচএসসি ২৮ এক্সাম ব্যাচ</div></td><td className="td px-2! text-right font-bold">{taka(Math.round(info.classTotal / info.classes))}</td></tr>
                ))}
              </tbody>
            </table>
          </>)}
          {info.scripts > 0 && (<>
            <div className="mb-1 font-bold">খাতা কাটা (পূর্ণমান × রেট)</div>
            <table className="mb-2 w-full">
              <thead><tr className="border-b border-outline-variant/20"><th className="th px-2!">তারিখ</th><th className="th px-2!">পরীক্ষা ও প্রশ্ন</th><th className="th px-2! text-right">সম্মানী</th></tr></thead>
              <tbody className="divide-y divide-outline-variant/10">
                {[["১৮ নভে", "প্রশ্ন ১ (ক) · খাতা #A-1024", 0.5], ["১৮ নভে", "প্রশ্ন ২ (খ) · খাতা #A-1031", 0.3], ["১৯ নভে", "প্রশ্ন ৩ · খাতা #A-1047", 0.2]].map(([d, q, p]) => (
                  <tr key={q as string}><td className="td px-2! whitespace-nowrap">{d}</td><td className="td px-2!">{q}<div className="text-xs muted">সৃজনশীল মডেল টেস্ট ০২ · পূর্ণমান {bn(15)}</div></td><td className="td px-2! text-right font-bold">{taka(Math.round(info.earned * (p as number)))}</td></tr>
                ))}
              </tbody>
            </table>
          </>)}
        </>)}
      </Modal>
      <Modal open={!!pay} onClose={() => setPay(null)} icon="payments" title="সম্মানী পরিশোধ" sub={pay ? `${pay.name} · নভেম্বর ২০২৬` : ""}
        actions={[{ label: "বাতিল", kind: "ghost" }, { label: "পরিশোধ রেকর্ড করুন", onClick: () => { setPay(null); toast("পেমেন্ট রেকর্ড হয়েছে (নমুনা)"); } }]}>
        {pay && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[[taka(total(pay)), "মোট"], [taka(pay.paid), "আগে দেওয়া"], [taka(due(pay)), "বাকি"]].map(([v, l]) => <div key={l} className="rounded-xl bg-surface-container-low p-3 dark:bg-white/5"><div className="font-bold">{v}</div><div className="text-xs muted">{l}</div></div>)}
            </div>
            <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-200">আগে bKash/নগদ/ব্যাংক থেকে টাকা পাঠান, তারপর এখানে রেকর্ড করুন।</p>
            <Field id="pt-amount" label="পরিমাণ (৳)"><input id="pt-amount" type="number" min={1} className="field" defaultValue={due(pay)} /></Field>
            <div><span className="label">কীভাবে দিয়েছেন</span><div className="grid grid-cols-4 gap-2">{["bKash", "নগদ", "ব্যাংক", "নগদ টাকা"].map((m, i) => <label key={m} className="flex cursor-pointer items-center justify-center rounded-xl border border-outline-variant/30 p-2 text-center text-xs font-bold has-[:checked]:border-primary has-[:checked]:bg-primary/5"><input type="radio" name="pt-m" defaultChecked={i === 0} className="sr-only" />{m}</label>)}</div></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="pt-account" label="নম্বর / অ্যাকাউন্ট"><input id="pt-account" className="field trx" /></Field>
              <Field id="pt-ref" label="TrxID / রেফারেন্স"><input id="pt-ref" className="field trx" placeholder="ক্যাশ হলে খালি রাখুন" /></Field>
            </div>
            <Field id="pt-note" label="নোট (ঐচ্ছিক)"><input id="pt-note" className="field" placeholder="যেমন: অক্টোবরের বাকি সহ" /></Field>
          </div>
        )}
      </Modal>
    </>
  );
}
