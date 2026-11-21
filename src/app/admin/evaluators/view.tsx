"use client";

import Link from "next/link";
import { useState } from "react";
import { bn, taka } from "@/lib/content-schema";
import { Field, Modal, SampleNote, useConfirm, useToast } from "../_components/kit";
import { Avatar, Badge, TONE, EmptyState, PageHead } from "../_components/ui";

type Ev = { id: number; name: string; inst: string; scripts: number; marks: number; earned: number; paid: number; active: boolean };
const EVS: Ev[] = [
  { id: 1, name: "নাজমুল হক", inst: "BUET ’21", scripts: 90, marks: 1350, earned: 2700, paid: 2700, active: true },
  { id: 2, name: "আরিফ রহমান", inst: "BUET ’22", scripts: 64, marks: 960, earned: 1920, paid: 0, active: true },
  { id: 3, name: "সাদিয়া ইসলাম", inst: "ঢাকা বিশ্ববিদ্যালয় ’21", scripts: 0, marks: 0, earned: 0, paid: 0, active: false },
];
const EXAMS = [
  { id: 1, title: "মডেল টেস্ট ০৩ (লিখিত অংশ)", course: "জুনিয়র স্কলারশিপ এক্সাম ব্যাচ", ended: "২ দিন আগে", kind: "mixed", scripts: 201, marked: 150, inHand: 30, returned: 3, modLeft: 12, flagged: 3, published: false, q: [["প্রশ্ন ১", 50, 60], ["প্রশ্ন ২", 48, 60]] },
  { id: 2, title: "পদার্থবিজ্ঞান লিখিত পরীক্ষা", course: "ইঞ্জিনিয়ারিং প্রস্তুতি", ended: "১ সপ্তাহ আগে", kind: "written", scripts: 96, marked: 96, inHand: 0, returned: 0, modLeft: 0, flagged: 0, published: true, q: [["প্রশ্ন ১", 96, 96]] },
];
const NOTICES = [["শুক্রবারের মধ্যে ০৩ নম্বর পরীক্ষার খাতা শেষ করুন", "অ্যাডমিন · ২ দিন আগে · SMS সহ"], ["নতুন মার্কিং গাইড ড্যাশবোর্ডে যোগ হয়েছে", "অ্যাডমিন · ১ সপ্তাহ আগে"]];

// খাতা মূল্যায়ন (admin_dashboard.html এর evaluators): রেট ও সারাংশ, পরীক্ষাভিত্তিক অগ্রগতি, মান যাচাই, মূল্যায়নকারী, নোটিশ। ধাপ ১: শুধু UI
// খাতার মান যাচাই: যাঁদের নম্বরে খেয়াল করা দরকার (নমুনা)
const FLAGGED = [
  { by: "নাজমুল হক", q: "প্রশ্ন ২ (খ)", exam: "সৃজনশীল মডেল টেস্ট ০২", scripts: 38, avg: 81, all: 64, flags: ["নরম"] },
  { by: "সাবরিনা ইয়াসমিন", q: "প্রশ্ন ৩", exam: "সৃজনশীল মডেল টেস্ট ০২", scripts: 25, avg: 47, all: 64, flags: ["কড়া", "খুব দ্রুত"] },
  { by: "তাসনিম রহমান", q: "প্রশ্ন ১ (ক)", exam: "এইচএসসি পদার্থ: অধ্যায় ১", scripts: 30, avg: 70, all: 66, flags: ["দ্বিতীয় যাচাইয়ে অমিল"] },
];

// ম্যানেজার প্যানেলে (manager_dashboard.html): নিজে খাতা কাটা, রেট বদল, ফল প্রকাশ, সিদ্ধান্ত আর নোটিশ পাঠানো নেই
export function EvaluatorsView({ panel = "admin" }: { panel?: "admin" | "manager" }) {
  const admin = panel === "admin";
  const [list, setList] = useState(EVS);
  const [add, setAdd] = useState(false);
  const [rate, setRate] = useState(false);
  const [title, setTitle] = useState("");
  const [toast, node] = useToast();
  const [ask, askNode] = useConfirm();
  const [quality, setQuality] = useState(false);
  const monthPay = EVS.reduce((s, e) => s + e.earned, 0);
  const tile = (icon: string, cls: string, value: string, label: string, sub: string) => (
    <div className="tilt-card card rounded-2xl! p-5">
      <div className={`mb-3 grid h-11 w-11 place-items-center rounded-full ${cls}`}><span className="icon">{icon}</span></div>
      <div className="text-2xl font-bold">{value}</div><div className="mt-1 text-sm font-bold muted">{label}</div><div className="mt-1 text-xs muted">{sub}</div>
    </div>
  );
  return (
    <>
      {node}{askNode}
      <PageHead title="খাতা মূল্যায়ন" sub="লিখিত পরীক্ষার খাতা কাটার অগ্রগতি, মূল্যায়নকারী আর খাতাপ্রতি সম্মানী">
        {admin && <Link href="/evaluator" className="btn-outline"><span className="icon text-[18px]">rate_review</span> নিজে খাতা কাটুন</Link>}
        <button type="button" className="btn-primary" onClick={() => setAdd(true)}><span className="icon text-[18px]">person_add</span> নতুন মূল্যায়নকারী</button>
      </PageHead>
      <SampleNote />
      <div className="reveal mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:mb-6 md:gap-6 2xl:grid-cols-4">
        <div className="tilt-card relative overflow-hidden rounded-3xl bg-primary p-6 text-on-primary shadow-md">
          <div className="absolute top-0 right-0 h-28 w-28 -translate-y-1/2 translate-x-1/4 rounded-full bg-white/10 blur-2xl" />
          <div className="text-sm font-bold text-primary-fixed">খাতা কাটার সম্মানী</div>
          <div className="mt-1 text-4xl font-bold">{taka(2)} <span className="text-base font-normal text-primary-fixed">/ নম্বর</span></div>
          <p className="mt-2 text-xs text-primary-fixed">খাতা কাটা (পূর্ণমান × রেট)। যেমন ১০ নম্বরের প্রশ্নে ২০ টাকা।</p>
          <div className="mt-3 space-y-0.5 text-[11px] text-primary-fixed/90"><div>এখন: {taka(2)} · ১ নভেম্বর</div><div>আগে: {taka(1.5)} · ১ আগস্ট</div></div>
          {admin ? <button type="button" onClick={() => setRate(true)} className="relative mt-4 w-full rounded-lg bg-on-primary py-2 text-sm font-bold text-primary shadow-sm transition-transform hover:scale-105">রেট বদলান</button> : <p className="mt-4 text-[11px] text-primary-fixed">রেট ঠিক করেন অ্যাডমিন</p>}
        </div>
        {tile("groups", "bg-blue-100 text-blue-600", bn(list.filter((e) => e.active).length), "সক্রিয় মূল্যায়নকারী", `মোট ${bn(list.length)} জন`)}
        {tile("rate_review", "bg-amber-100 text-amber-600", bn(51), "খাতা কাটা বাকি", "১টি পরীক্ষার ফল আটকে")}
        {tile("payments", "bg-emerald-100 text-emerald-600", taka(monthPay), "এই মাসে খাতার সম্মানী", "মূল্যায়নকারীদের বাবদ")}
      </div>
      <div className="reveal card mb-3 p-4 md:mb-6 md:p-6">
        <h3 className="section-title mb-1">পরীক্ষাভিত্তিক অগ্রগতি</h3>
        <p className="mb-4 text-xs muted">পরীক্ষার সময় শেষ হলে খাতা কাটা শুরু হয়। সব খাতা কাটা হলে ফল প্রকাশ করা যায়।</p>
        <div className="space-y-3">
          {EXAMS.map((e, i) => (
            <div key={e.id} className="row-in rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4 dark:bg-white/5" style={{ "--i": i } as React.CSSProperties}>
              <div className="mb-3 flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div className="min-w-0"><div className="font-bold">{e.title}</div><div className="mt-0.5 text-xs muted">{e.course} · পরীক্ষা শেষ {e.ended}</div></div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Badge tone={e.kind === "mixed" ? "purple" : "blue"}>{e.kind === "mixed" ? "MCQ + লিখিত" : "লিখিত"}</Badge>
                  {e.published ? <Badge tone="green" icon="verified">ফল প্রকাশিত</Badge> : admin && <button type="button" disabled={e.marked < e.scripts || e.modLeft > 0} className="btn-soft px-3! py-1.5! disabled:cursor-not-allowed disabled:opacity-40" title={e.marked < e.scripts ? `আরও ${bn(e.scripts - e.marked)}টি খাতা কাটা বাকি` : e.modLeft ? `${bn(e.modLeft)}টি খাতার দ্বিতীয় যাচাই বাকি` : ""} onClick={() => toast("ফল প্রকাশ হয়েছে (নমুনা)")}><span className="icon text-[18px]">publish</span>ফল প্রকাশ</button>}
                </div>
              </div>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-container-highest dark:bg-on-surface-variant">
                <i className="block h-full bg-emerald-500" style={{ width: `${(e.marked * 100) / e.scripts}%` }} /><i className="block h-full bg-amber-400" style={{ width: `${(e.inHand * 100) / e.scripts}%` }} /><i className="block h-full bg-red-500" style={{ width: `${(e.returned * 100) / e.scripts}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs muted"><span>মোট {bn(e.scripts)}টি খাতা</span><span className="font-bold text-emerald-600">কাটা {bn(e.marked)}</span><span>কারো হাতে {bn(e.inHand)}</span><span className="text-error dark:text-red-300">ফেরত {bn(e.returned)}</span><span>বাকি {bn(e.scripts - e.marked - e.inHand - e.returned)}</span>{e.modLeft > 0 && <span className="font-bold text-purple-700 dark:text-purple-300">দ্বিতীয় যাচাই বাকি {bn(e.modLeft)}{e.flagged ? ` (পার্থক্য ${bn(e.flagged)})` : ""}</span>}{e.q.map((q) => <span key={String(q[0])} className="opacity-80">{q[0]}: {bn(Number(q[1]))}/{bn(Number(q[2]))}</span>)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="reveal card mb-3 p-4 md:mb-6 md:p-6">
        <div className="mb-1 flex flex-wrap items-start justify-between gap-2"><h3 className="section-title">খাতার মান যাচাই</h3><button type="button" className="btn-outline px-3! py-1.5!" onClick={() => setQuality(true)}><span className="icon text-[18px]">tune</span>নিয়ম</button></div>
        <p className="mb-4 text-xs muted">দ্বিতীয় যাচাই, নমুনা খাতা (ক্যালিব্রেশন) আর পুনর্মূল্যায়নের আবেদন</p>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {([[3, "দ্বিতীয় যাচাইয়ে পার্থক্য", "red"], [12, "দ্বিতীয় যাচাই বাকি", "purple"], [2, "পুনর্মূল্যায়নের আবেদন", "amber"], [1, "নমুনায় মেলেননি", "blue"]] as const).map(([n, l, t]) => (
            <div key={l} className={`rounded-xl border p-3 ${TONE[n ? t : "gray"]}`}><div className="text-xl font-bold">{bn(n)}</div><div className="mt-0.5 text-xs">{l}</div></div>
          ))}
        </div>
        {admin ? <Link href="/evaluator/quality" className="btn-primary mb-4 inline-flex!"><span className="icon text-[18px]">verified</span> সিদ্ধান্ত দিন</Link>
          : <p className="mb-4 text-xs muted">পার্থক্য আর পুনর্মূল্যায়নের সিদ্ধান্ত দেন অ্যাডমিন বা কোর্সের শিক্ষক।</p>}
        <div className="mb-2 text-sm font-bold">যাঁদের নম্বরে খেয়াল করা দরকার</div>
        <div className="custom-scrollbar -mx-2 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead><tr className="border-b border-outline-variant/20"><th className="th">মূল্যায়নকারী</th><th className="th">পরীক্ষা ও প্রশ্ন</th><th className="th">খাতা</th><th className="th">গড় নম্বর</th><th className="th">সংকেত</th></tr></thead>
            <tbody className="divide-y divide-outline-variant/10">
              {FLAGGED.map((r, i) => (
                <tr key={i} className="row-in" style={{ "--i": i } as React.CSSProperties}>
                  <td className="td font-bold">{r.by}</td><td className="td text-sm">{r.q}<div className="text-xs muted">{r.exam}</div></td>
                  <td className="td">{bn(r.scripts)}</td><td className="td">{bn(r.avg)}%<div className="text-xs muted">সবার গড় {bn(r.all)}%</div></td>
                  <td className="td">{r.flags.map((x) => <span key={x} className="mr-1"><Badge tone="amber">{x}</Badge></span>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs muted">সংকেত মানে শুধু খেয়াল করা: নরম/কড়া (সবার গড়ের চেয়ে ১৫% বেশি বা কম), খুব দ্রুত (গড় সময়ের ৪০% এর কম), দ্বিতীয় যাচাইয়ে অমিল।</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:gap-6 2xl:grid-cols-3">
        <div className="reveal card p-4 md:p-6 2xl:col-span-2">
          <h3 className="section-title mb-1">মূল্যায়নকারী</h3>
          <p className="mb-4 text-xs muted">এই মাসের হিসাব। শিক্ষকের খাতা কাটার সম্মানী &quot;সম্মানী&quot; পাতায় থাকে।</p>
          {list.length ? (
            <div className="custom-scrollbar -mx-2 overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead><tr className="border-b border-outline-variant/20"><th className="th">মূল্যায়নকারী</th><th className="th">এই মাসে কাটা</th><th className="th">সম্মানী</th><th className="th">পরিশোধিত</th><th className="th">বাকি</th><th className="th">অবস্থা</th><th className="th text-right">অ্যাকশন</th></tr></thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {list.map((e, i) => (
                    <tr key={e.id} className={`row-in ${e.active ? "" : "opacity-60"}`} style={{ "--i": i } as React.CSSProperties}>
                      <td className="td"><div className="flex items-center gap-3"><Avatar name={e.name} size="h-9 w-9" /><div><div className="font-bold">{e.name}</div><div className="text-xs muted">{e.inst}</div></div></div></td>
                      <td className="td">{bn(e.scripts)}টি খাতা<div className="text-xs muted">{bn(e.marks)} নম্বর</div></td>
                      <td className="td font-bold">{taka(e.earned)}</td>
                      <td className="td font-bold text-emerald-700 dark:text-emerald-300">{taka(e.paid)}</td>
                      <td className={`td font-bold ${e.earned - e.paid ? "text-error" : "muted"}`}>{taka(e.earned - e.paid)}</td>
                      <td className="td">{e.active ? <Badge tone="green">সক্রিয়</Badge> : <Badge tone="gray">বাদ দেওয়া</Badge>}</td>
                      <td className="td"><div className="flex items-center justify-end gap-1">
                        {e.earned - e.paid > 0 && <button type="button" className="btn-soft px-3! py-1.5!" onClick={() => toast("সম্মানী পাতায় নেওয়া হবে", "info")}><span className="icon text-[18px]">payments</span> পেমেন্ট দিন</button>}
                        <button type="button" className={`icon-btn ${e.active ? "hover:text-error!" : ""}`} title={e.active ? "বাদ দিন" : "আবার চালু করুন"} aria-label={e.active ? "বাদ দিন" : "আবার চালু করুন"} onClick={async () => { if (!e.active || await ask({ title: "মূল্যায়নকারী বাদ", sub: e.name, tone: "danger", icon: "person_off", ok: "বাদ দিন", body: "হাতে থাকা খাতা ছেড়ে দেওয়া হবে, অন্যরা কাটতে পারবেন। পরে আবার চালু করলে আবার খাতা কাটতে পারবেন।" })) setList((s) => s.map((x) => (x.id === e.id ? { ...x, active: !x.active } : x))); }}><span className="icon text-[20px]">{e.active ? "person_off" : "person_check"}</span></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon="person_add" text="এখনো কোনো মূল্যায়নকারী নেই" />}
        </div>
        <div className="reveal card p-4 md:p-6">
          <h3 className="section-title mb-1">মূল্যায়নকারীদের নোটিশ</h3>
          <p className="mb-4 text-xs muted">{admin ? "তাঁদের ড্যাশবোর্ডে দেখাবে, চাইলে SMS ও যাবে" : "নোটিশ পাঠান অ্যাডমিন। আপনি মূল্যায়নকারী যোগ বা বাদ দিতে আর সম্মানী দিতে পারেন।"}</p>
          {admin && <div className="mb-5 space-y-3">
            <Field id="evn-title" label="শিরোনাম"><input id="evn-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="যেমন: শুক্রবারের মধ্যে খাতা কাটা শেষ করুন" /></Field>
            <Field id="evn-body" label="বার্তা"><textarea id="evn-body" className="field min-h-[90px]" placeholder="কোন পরীক্ষা, কবের মধ্যে, কোনো নিয়ম থাকলে" /></Field>
            <label className="flex cursor-pointer items-center gap-3 select-none"><input type="checkbox" className="chk" /> SMS ও পাঠান</label>
            <button type="button" className="btn-primary w-full" onClick={() => { setTitle(""); toast("নোটিশ পাঠানো হয়েছে (নমুনা)"); }}><span className="icon text-[18px]">send</span> পাঠান</button>
          </div>}
          <div className="mb-2 text-sm font-bold">সাম্প্রতিক নোটিশ</div>
          <div className="space-y-2">{NOTICES.map(([t, m]) => <div key={t} className="rounded-xl border border-outline-variant/20 p-3"><div className="text-sm font-bold">{t}</div><div className="mt-1 text-xs muted">{m}</div></div>)}</div>
        </div>
      </div>

      <Modal open={add} onClose={() => setAdd(false)} icon="person_add" title="নতুন মূল্যায়নকারী" sub="লিখিত পরীক্ষার খাতা কাটবেন, শিক্ষার্থীর তথ্য দেখবেন না"
        actions={[{ label: "বাতিল", kind: "ghost" }, { label: "যোগ করুন", onClick: () => { setAdd(false); toast("মূল্যায়নকারী যোগ হয়েছে (নমুনা)"); } }]}>
        <div className="space-y-4">
          <Field id="evn-name" label="পুরো নাম"><input id="evn-name" className="field" placeholder="যেমন: তাসনিম রহমান" /></Field>
          <Field id="evn-phone" label="মোবাইল নম্বর"><input id="evn-phone" className="field trx" inputMode="numeric" maxLength={11} placeholder="01XXXXXXXXX" /></Field>
          <Field id="evn-inst" label="প্রতিষ্ঠান ও ব্যাচ (ঐচ্ছিক)"><input id="evn-inst" className="field" placeholder="যেমন: BUET ’22" /></Field>
          <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-200">তিনি এই নম্বরে OTP দিয়ে লগইন করে &quot;খাতা মূল্যায়ন&quot; পাতা পাবেন।</p>
        </div>
      </Modal>
      <Modal open={quality} onClose={() => setQuality(false)} icon="fact_check" title="খাতার মান যাচাইয়ের নিয়ম" sub="প্রতিটি নতুন লিখিত পরীক্ষায় এগুলো ডিফল্ট হিসেবে বসবে"
        actions={[{ label: "বাতিল", kind: "ghost" }, { label: "সেভ করুন", onClick: () => { setQuality(false); toast("নিয়ম সংরক্ষণ হয়েছে (নমুনা)"); } }]}>
        <div className="space-y-4">
          <Field id="q-mod" label="দ্বিতীয় যাচাই (%)"><input id="q-mod" type="number" min={0} max={100} className="field" defaultValue={10} /></Field>
          <p className="-mt-2 text-xs muted">প্রত্যেকের প্রথম ২টা আর এত % খাতা আরেকজন কাটবেন</p>
          <Field id="q-tol" label="পার্থক্যের সীমা (পূর্ণমানের %)"><input id="q-tol" type="number" min={0} max={100} className="field" defaultValue={15} /></Field>
          <p className="-mt-2 text-xs muted">পার্থক্য আর পুনর্মূল্যায়নের সিদ্ধান্ত দেন অ্যাডমিন বা কোর্সের শিক্ষক</p>
          <Field id="q-days" label="পুনর্মূল্যায়নের সময় (দিন)"><input id="q-days" type="number" min={0} max={14} className="field" defaultValue={3} /></Field>
          <p className="-mt-2 text-xs muted">ফল প্রকাশের পর শিক্ষার্থী আবেদন করতে পারবে</p>
        </div>
      </Modal>
      <Modal open={rate} onClose={() => setRate(false)} icon="tune" title="খাতার সম্মানীর রেট" sub="নতুন রেট এখন থেকে কাটা খাতায় বসবে। আগে কাটা খাতার হিসাব বদলাবে না।"
        actions={[{ label: "বাতিল", kind: "ghost" }, { label: "সেভ করুন", onClick: () => { setRate(false); toast("রেট বদলানো হয়েছে (নমুনা)"); } }]}>
        <Field id="rate-v" label="প্রতি নম্বরে কত টাকা"><input id="rate-v" type="number" min={0} step={0.25} className="field" defaultValue={2} /></Field>
      </Modal>
    </>
  );
}
