"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { bn } from "@/lib/content-schema";
import { SampleNote, SearchBox, useConfirm, useToast } from "../../admin/_components/kit";

type Q = { id: number; who: string; me?: boolean; body: string; chapter: string; time: string; seen?: boolean; answer?: { by: string; text: string; time: string } };
const COURSES = [{ id: 1, name: "উচ্চতর গণিত ১ম পত্র" }, { id: 2, name: "ইঞ্জিনিয়ারিং গণিত প্রস্তুতি" }];
const CHAPTERS = ["সব অধ্যায়", "সাধারণ প্রশ্ন (নির্দিষ্ট অধ্যায় নয়)", "ম্যাট্রিক্স ও নির্ণায়ক", "সরলরেখা", "বৃত্ত", "ত্রিকোণমিতি"];
const START: Q[] = [
  { id: 1, who: "আপনি", me: true, body: "ম্যাট্রিক্সের বিপরীত বের করার সময় নির্ণায়ক শূন্য হলে কী করব?", chapter: "ম্যাট্রিক্স ও নির্ণায়ক", time: "২ ঘণ্টা আগে" },
  { id: 4, who: "আপনি", me: true, seen: false, body: "দ্বিঘাত সমীকরণের নিশ্চায়ক ঋণাত্মক হলে মূল দুটো কেমন হবে?", chapter: "সাধারণ প্রশ্ন (নির্দিষ্ট অধ্যায় নয়)", time: "১ দিন আগে", answer: { by: "সাঈদ সামি", text: "তখন মূল দুটো জটিল (অবাস্তব) আর পরস্পরের অনুবন্ধী হবে।", time: "৩ ঘণ্টা আগে" } },
  { id: 2, who: "মেহেদী হাসান", body: "সরলরেখার ঢাল বের করার সূত্রটা কোন ক্ষেত্রে ব্যবহার করা যাবে না?", chapter: "সরলরেখা", time: "১ দিন আগে", answer: { by: "সাঈদ সামি", text: "লম্ব রেখার ক্ষেত্রে ঢাল অসংজ্ঞায়িত, তখন সরাসরি সমীকরণ x = k ব্যবহার করবেন।", time: "২০ ঘণ্টা আগে" } },
  { id: 3, who: "সুমি আক্তার", body: "বৃত্তের স্পর্শকের সমীকরণে কেন (x₁, y₁) বসাতে হয়?", chapter: "বৃত্ত", time: "৩ দিন আগে", answer: { by: "সাঈদ সামি", text: "কারণ স্পর্শবিন্দু বৃত্তের ওপরই থাকে। লেকচার ৪ এর ১৮ মিনিট থেকে দেখুন।", time: "২ দিন আগে" } },
];

// প্রশ্নোত্তর (dashboard.html এর qa-view): প্রশ্ন করা, কোর্সের সবার প্রশ্ন ও উত্তর। ধাপ ১: শুধু UI (নমুনা তথ্য)
export function QaStudentView() {
  const sp = useSearchParams();
  const router = useRouter();
  const course = COURSES.find((c) => c.id === Number(sp.get("course"))) ?? COURSES[0];
  const [list, setList] = useState(START);
  const [tab, setTab] = useState<"all" | "mine" | "open">("all");
  const [q, setQ] = useState("");
  const [fch, setFch] = useState(0);
  const [ch, setCh] = useState(1);
  const [body, setBody] = useState("");
  const [err, setErr] = useState("");
  const [toast, node] = useToast();
  const [ask, askNode] = useConfirm();
  const rows = list.filter((x) => (tab === "all" || (tab === "mine" ? x.me : !x.answer)) && (!fch || x.chapter === CHAPTERS[fch]) && (!q || x.body.includes(q) || x.who.includes(q) || !!x.answer?.text.includes(q)));
  const send = () => {
    if (body.trim().length < 10) return setErr("প্রশ্নটা অন্তত ১০ অক্ষরের লিখুন");
    setErr(""); setBody("");
    setList((s) => [{ id: Date.now(), who: "আপনি", me: true, body: body.trim(), chapter: CHAPTERS[ch], time: "এইমাত্র" }, ...s]);
    toast("প্রশ্ন পাঠানো হয়েছে (নমুনা)");
  };
  const sel = "field";
  return (
    <>
      {node}{askNode}
      <div className="reveal mb-3 flex flex-wrap items-center gap-4 md:mb-6">
        <Link href="/dashboard" aria-label="ড্যাশবোর্ডে ফিরুন" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant/20 bg-surface-container-low hover:bg-surface-variant dark:bg-white/5"><span className="icon">arrow_back</span></Link>
        <div className="min-w-0 grow"><h2 className="text-2xl font-bold text-on-background md:text-3xl dark:text-background">প্রশ্নোত্তর</h2><p className="mt-1 text-sm muted">{course.name}</p></div>
      </div>
      <SampleNote />
      <div className="reveal mb-4 flex flex-wrap gap-2 md:mb-8">
        {COURSES.map((c) => <button key={c.id} type="button" onClick={() => router.replace(`/dashboard/qa?course=${c.id}`)} className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${c.id === course.id ? "border-primary bg-primary text-on-primary" : "border-outline-variant/40 muted hover:border-primary hover:text-primary"}`}>{c.name}</button>)}
      </div>
      <div className="grid grid-cols-1 items-start gap-4 md:gap-8 xl:grid-cols-3">
        <div className="space-y-3 md:space-y-6 xl:sticky xl:top-28 xl:order-2">
          <div className="reveal card p-5 md:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary dark:bg-primary-fixed/10 dark:text-primary-fixed"><span className="icon">edit_note</span></div>
              <div><h3 className="text-lg font-bold text-on-background dark:text-background">প্রশ্ন করুন</h3><p className="text-xs muted">শিক্ষক বা অ্যাডমিন উত্তর দেবেন</p></div>
            </div>
            <label htmlFor="qa-ch" className="label">অধ্যায়</label>
            <select id="qa-ch" className={`${sel} mb-4`} value={ch} onChange={(e) => setCh(Number(e.target.value))} aria-label="অধ্যায় বাছাই করুন">{CHAPTERS.slice(1).map((c, i) => <option key={c} value={i + 1}>{c}</option>)}</select>
            <label htmlFor="qa-body" className="label">আপনার প্রশ্ন</label>
            <textarea id="qa-body" rows={5} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} aria-invalid={!!err} className={`${sel} resize-y`} placeholder="কোন লেকচারের কোন জায়গায় বা কোন অঙ্কে আটকে গেছেন, বিস্তারিত লিখুন..." />
            <div className="mt-1.5 mb-4 flex items-start justify-between gap-3">{err ? <p className="text-xs font-bold text-error" role="alert">{err}</p> : <span />}<span className="ml-auto shrink-0 text-xs muted">{bn(body.length)}/১০০০</span></div>
            <button type="button" onClick={send} className="btn-primary w-full py-3!"><span className="icon text-[20px]">send</span> প্রশ্ন পাঠান</button>
          </div>
          <div className="reveal card p-5 md:p-6" style={{ transitionDelay: "100ms" }}>
            <h3 className="mb-4 font-bold text-on-background dark:text-background">যেভাবে কাজ করে</h3>
            <ul className="space-y-3 text-sm muted">
              {[["search", "প্রশ্ন করার আগে খুঁজে দেখুন, হয়তো উত্তর আগেই আছে।"], ["groups", "কোর্সের সবাই সবার প্রশ্ন ও উত্তর দেখতে পারে।"], ["schedule", "সাধারণত ২৪ ঘণ্টার মধ্যে উত্তর আসে।"], ["notifications_active", "উত্তর এলে ঘণ্টা আইকনে জানানো হবে।"], ["delete", "উত্তর আসার আগে নিজের প্রশ্ন মুছে ফেলা যায়।"]].map(([ic, t]) => <li key={ic} className="flex gap-3"><span className="icon shrink-0 text-[20px] text-primary dark:text-primary-fixed">{ic}</span><span>{t}</span></li>)}
            </ul>
          </div>
        </div>
        <div className="reveal card p-4 md:p-6 xl:order-1 xl:col-span-2">
          <div className="mb-3 flex flex-col justify-between gap-3 md:mb-5 2xl:flex-row 2xl:items-center">
            <div className="tabs" role="tablist">{([["all", "সব প্রশ্ন", list.length], ["mine", "আমার প্রশ্ন", list.filter((x) => x.me).length], ["open", "উত্তর বাকি", list.filter((x) => !x.answer).length]] as const).map(([k, l, n]) => <button key={k} type="button" role="tab" aria-selected={tab === k} aria-current={tab === k ? "page" : undefined} className="tab" onClick={() => setTab(k)}>{l}<span className="opacity-70"> ({bn(n)})</span></button>)}</div>
            <div className="flex flex-col gap-2 sm:flex-row"><SearchBox value={q} onChange={setQ} placeholder="প্রশ্ন বা উত্তরে খুঁজুন" width="sm:w-56" /><select className="field sm:w-48" aria-label="অধ্যায় অনুযায়ী দেখুন" title="অধ্যায় অনুযায়ী দেখুন" value={fch} onChange={(e) => setFch(Number(e.target.value))}>{CHAPTERS.map((c, i) => <option key={c} value={i}>{c}</option>)}</select></div>
          </div>
          <div className="space-y-3 md:space-y-4">
            {rows.length ? rows.map((x, i) => (
              <div key={x.id} className={`row-in rounded-2xl border p-4 md:p-5 ${x.me ? "border-primary/30 bg-primary/5" : "border-outline-variant/20 bg-surface-container-low dark:bg-white/5"}`} style={{ "--i": i } as React.CSSProperties}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary dark:bg-primary-fixed/10 dark:text-primary-fixed">{Array.from(x.who)[0]}</div><div><div className="font-bold">{x.who}</div><div className="text-xs muted">{x.chapter} · {x.time}</div></div></div>
                  <span className="flex flex-wrap items-center gap-1.5">{x.me && x.answer && x.seen === false && <span className="rounded-full bg-error px-2 py-0.5 text-[11px] font-bold text-white">নতুন উত্তর</span>}{x.answer ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700"><span className="icon text-[13px]">check_circle</span>উত্তর হয়েছে</span> : <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700"><span className="icon text-[13px]">hourglass_top</span>অপেক্ষায়</span>}</span>
                </div>
                <p className="text-sm">{x.body}</p>
                {x.answer && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-800/40 dark:bg-emerald-900/20"><div className="mb-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">{x.answer.by} · {x.answer.time}</div>{x.answer.text}</div>}
                {x.me && !x.answer && <button type="button" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-error hover:underline" onClick={async () => { if (await ask({ title: "প্রশ্নটা মুছে ফেলবেন?", tone: "danger", icon: "delete", ok: "হ্যাঁ, মুছুন", body: "উত্তর আসার আগে নিজের প্রশ্ন মুছে ফেলতে পারবেন। মুছলে আর ফেরানো যাবে না।" })) { setList((s) => s.filter((y) => y.id !== x.id)); toast("প্রশ্ন মুছে ফেলা হয়েছে (নমুনা)"); } }}><span className="icon text-[16px]">delete</span>মুছুন</button>}
              </div>
            )) : <div className="py-14 text-center"><span className="icon text-5xl text-outline-variant">forum</span><p className="mt-3 font-bold muted">কোনো প্রশ্ন পাওয়া যায়নি</p></div>}
          </div>
        </div>
      </div>
    </>
  );
}
