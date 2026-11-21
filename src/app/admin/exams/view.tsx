"use client";

import { useState } from "react";
import Link from "next/link";
import { bn } from "@/lib/content-schema";
import { COURSES, courseName } from "../_components/sample";
import { Field, Modal, SampleNote, Tabs, useConfirm, useToast } from "../_components/kit";
import { Badge, EmptyState, PageHead, type Tone } from "../_components/ui";

type State = "draft" | "published" | "closed";
type E = { id: number; title: string; course: number; state: State; kind: "mcq" | "written" | "mixed"; questions: string; duration: number; attempts: number; avg: number; window: string; neg: string };
const START: E[] = [
  { id: 1, title: "ত্রিকোণমিতি চ্যাপ্টার টেস্ট", course: 2, state: "published", kind: "mcq", questions: "৩০", duration: 40, attempts: 148, avg: 68, window: "২০ নভেম্বর, ৮:০০ পিএম – ১০:০০ পিএম", neg: "নেগেটিভ ০.২৫" },
  { id: 2, title: "মডেল টেস্ট ০৩ (MCQ + লিখিত)", course: 1, state: "closed", kind: "mixed", questions: "২০+৪", duration: 90, attempts: 201, avg: 61, window: "১৫ নভেম্বর, ৭:০০ পিএম – ৯:৩০ পিএম", neg: "নেগেটিভ ০.২৫" },
  { id: 3, title: "পদার্থবিজ্ঞান লিখিত পরীক্ষা", course: 4, state: "draft", kind: "written", questions: "৬", duration: 120, attempts: 0, avg: 0, window: "সময় ঠিক হয়নি", neg: "" },
  { id: 4, title: "রসায়ন সাপ্তাহিক পরীক্ষা", course: 3, state: "published", kind: "mcq", questions: "২৫", duration: 30, attempts: 96, avg: 72, window: "২২ নভেম্বর, ৯:০০ পিএম – ১১:০০ পিএম", neg: "নেগেটিভ ০.২৫" },
];
const STATE: Record<State, [string, Tone]> = { draft: ["ড্রাফট", "gray"], published: ["প্রকাশিত", "green"], closed: ["শেষ", "blue"] };
const KIND: Record<E["kind"], [string, Tone]> = { mcq: ["MCQ", "purple"], written: ["লিখিত", "amber"], mixed: ["MCQ + লিখিত", "cyan"] };

// পরীক্ষা (admin_dashboard.html এর exams): কার্ডের তালিকা, প্রকাশ/ড্রাফট, ফলাফল। ধাপ ১: শুধু UI
export function ExamsView() {
  const [list, setList] = useState(START);
  const [tab, setTab] = useState<"all" | "published" | "draft">("all");
  const [course, setCourse] = useState(0);
  const [res, setRes] = useState<E | null>(null);
  const [toast, node] = useToast();
  const [ask, askNode] = useConfirm();
  const [create, setCreate] = useState(false);
  const [fix, setFix] = useState<E | null>(null);
  const [ana, setAna] = useState<E | null>(null);
  const [kindNew, setKindNew] = useState<E["kind"]>("mcq");
  const match = (e: E, t: string) => t === "all" || (t === "draft" ? e.state === "draft" : e.state !== "draft");
  const rows = list.filter((e) => match(e, tab) && (!course || e.course === course));
  return (
    <>
      {node}{askNode}
      <PageHead title="পরীক্ষা" sub="MCQ পরীক্ষা তৈরি, প্রশ্ন যোগ, প্রকাশ আর ফলাফল দেখুন">
        <Link href="/exam-editor" className="btn-outline"><span className="icon text-[18px]">edit_note</span> প্রশ্নপত্র ও সময়সূচি</Link>
        <button type="button" className="btn-primary" onClick={() => setCreate(true)}><span className="icon text-[18px]">add</span> নতুন পরীক্ষা</button>
      </PageHead>
      <SampleNote />
      <div className="reveal card p-4 md:p-6">
        <div className="mb-3 flex flex-col justify-between gap-3 md:mb-5 xl:flex-row xl:items-center">
          <Tabs value={tab} onChange={setTab} items={[{ key: "all", label: "সব", count: bn(list.length) }, { key: "published", label: "প্রকাশিত", count: bn(list.filter((e) => match(e, "published")).length) }, { key: "draft", label: "ড্রাফট", count: bn(list.filter((e) => match(e, "draft")).length) }]} />
          <select className="field sm:w-56" aria-label="কোর্স" value={course} onChange={(e) => setCourse(Number(e.target.value))}><option value={0}>সব কোর্স</option>{COURSES.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
        </div>
        {rows.length ? (
          <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2">
            {rows.map((e, i) => (
              <div key={e.id} className="row-in flex flex-col rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5 dark:bg-white/5" style={{ "--i": i } as React.CSSProperties}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0"><h4 className="font-bold text-on-background dark:text-background">{e.title}</h4><p className="mt-1 text-xs muted">{courseName(e.course)}</p></div>
                  <div className="flex shrink-0 flex-col items-end gap-1"><Badge tone={STATE[e.state][1]}>{STATE[e.state][0]}</Badge><Badge tone={KIND[e.kind][1]}>{KIND[e.kind][0]}</Badge></div>
                </div>
                <div className="mb-4 grid grid-cols-4 gap-2 text-center">
                  {[[e.questions, e.kind === "mixed" ? "MCQ+লিখিত" : "প্রশ্ন"], [bn(e.duration), "মিনিট"], [bn(e.attempts), "অংশ নিয়েছে"], [e.attempts ? `${bn(e.avg)}%` : "—", "গড়"]].map(([v, l]) => (
                    <div key={l} className="rounded-xl bg-surface-container-lowest p-2 dark:bg-inverse-surface"><div className="font-bold">{v}</div><div className="text-[11px] muted">{l}</div></div>
                  ))}
                </div>
                <p className="mb-4 flex items-center gap-1 text-xs muted"><span className="icon text-[14px]">date_range</span>{e.window}{e.neg && ` · ${e.neg}`}</p>
                <div className="mt-auto flex flex-wrap gap-2">
                  {/* পরীক্ষা শুরু হলে প্রশ্নপত্র আটকে যায় (ডেমোর মতো তালা), তখন শুধু সংশোধন */}
                  {e.attempts > 0 || e.state === "closed"
                    ? <button type="button" className="btn-outline flex-1 cursor-not-allowed px-2! opacity-60" title="পরীক্ষা শুরু হয়েছে, প্রশ্নপত্র আর বদলানো যায় না। উত্তরে ভুল থাকলে সংশোধন ব্যবহার করুন" onClick={() => toast("পরীক্ষা শুরু হয়েছে, প্রশ্নপত্র আর বদলানো যায় না", "info")}><span className="icon text-[18px]">lock</span> প্রশ্ন</button>
                    : <Link href="/exam-editor" className="btn-outline flex-1 px-2!" title="প্রশ্নপত্রের পাতায়: MCQ ও লিখিত প্রশ্ন, গণিত, ছবি, সময় আর প্রকাশ"><span className="icon text-[18px]">edit_note</span> প্রশ্ন</Link>}
                  <button type="button" className="btn-outline flex-1 px-2!" disabled={!e.attempts} onClick={() => setRes(e)}><span className="icon text-[18px]">leaderboard</span> ফলাফল</button>
                  <button type="button" className={`${e.state === "draft" ? "btn-primary" : "btn-outline"} flex-1 px-2!`}
                    onClick={async () => { if (e.state !== "draft" && e.attempts) { toast("শিক্ষার্থীরা অংশ নিয়েছে, এখন ড্রাফট করা যাবে না", "info"); return; } if (await ask(e.state === "draft" ? { title: "পরীক্ষা প্রকাশ", sub: e.title, icon: "publish", ok: "প্রকাশ করুন", body: "প্রকাশিত (শিক্ষার্থীরা দেখতে পাবে)। সময় শুরু হলে প্রশ্নপত্র আর বদলানো যাবে না।" } : { title: "পরীক্ষা ড্রাফট", sub: e.title, tone: "amber", icon: "edit_note", ok: "ড্রাফটে নিন", body: "শিক্ষার্থীরা আর পরীক্ষাটি দেখবে না।" })) setList((s) => s.map((x) => (x.id === e.id ? { ...x, state: x.state === "draft" ? "published" : "draft" } : x))); }}>{e.state === "draft" ? "প্রকাশ করুন" : "ড্রাফট করুন"}</button>
                  {e.state !== "draft" && e.kind !== "written" && <button type="button" className="btn-outline flex-1 px-2!" onClick={() => setFix(e)}><span className="icon text-[18px]">rule</span> সংশোধন</button>}
                  {e.state === "closed" && e.attempts > 0 && <button type="button" className="btn-outline flex-1 px-2!" onClick={() => setAna(e)}><span className="icon text-[18px]">analytics</span> বিশ্লেষণ</button>}
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState icon="quiz" text="কোনো পরীক্ষা নেই" />}
      </div>
      <Modal open={!!res} onClose={() => setRes(null)} icon="leaderboard" title="ফলাফল" sub={res?.title} size="max-w-2xl"
        actions={[{ label: "CSV ডাউনলোড", kind: "ghost", onClick: () => toast("CSV নামানো পরে যুক্ত হবে", "info") }, { label: "বন্ধ করুন", kind: "ghost" }]}>
        <div className="mb-4 grid grid-cols-3 gap-3 text-center">
          {[[bn(res?.attempts ?? 0), "মোট"], [`${bn(res?.avg ?? 0)}%`, "গড়"], ["৯৮%", "সর্বোচ্চ"]].map(([v, l]) => <div key={l} className="rounded-xl bg-surface-container-low p-3 dark:bg-white/5"><div className="font-bold">{v}</div><div className="text-xs muted">{l}</div></div>)}
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[420px]">
          <thead><tr className="border-b border-outline-variant/20"><th className="th px-2!">#</th><th className="th px-2!">শিক্ষার্থী</th><th className="th px-2!">নম্বর</th></tr></thead>
          <tbody className="divide-y divide-outline-variant/10">{[["তাসনিম আহমেদ", 98], ["রাফিউল ইসলাম", 94], ["সুমি আক্তার", 91], ["মেহেদী হাসান", 87], ["নুসরাত জাহান", 85]].map(([n, p], i) => (
            <tr key={String(n)}><td className="td px-2! font-bold">{bn(i + 1)}</td><td className="td px-2!">{n}</td><td className="td px-2! font-bold">{bn(Number(p))}%</td></tr>))}</tbody>
        </table></div>
      </Modal>
      <Modal open={create} onClose={() => setCreate(false)} icon="quiz" title="নতুন পরীক্ষা" sub="ড্রাফট হিসেবে তৈরি হবে, প্রশ্ন যোগ করে প্রকাশ করুন"
        actions={[{ label: "বাতিল", kind: "ghost" }, { label: "তৈরি করুন", onClick: () => { setCreate(false); toast("পরীক্ষা তৈরি হয়েছে (নমুনা)"); } }]}>
        <div className="space-y-4">
          <Field id="ex-title" label="পরীক্ষার নাম"><input id="ex-title" className="field" placeholder="যেমন: সাপ্তাহিক মডেল টেস্ট ০৬" /></Field>
          <div><span className="label">পরীক্ষার ধরন</span>
            <div className="grid grid-cols-3 gap-2">{(Object.keys(KIND) as E["kind"][]).map((k) => <button key={k} type="button" onClick={() => setKindNew(k)} className={`rounded-xl border p-3 text-sm font-bold ${kindNew === k ? "border-primary bg-primary/5 text-primary dark:text-primary-fixed" : "border-outline-variant/30 muted"}`}>{KIND[k][0]}</button>)}</div></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="ex-c" label="কোর্স"><select id="ex-c" className="field">{COURSES.map((c) => <option key={c.id}>{c.title}</option>)}</select></Field>
            <Field id="ex-dur" label="সময় (মিনিট)"><input id="ex-dur" type="number" min={5} className="field" defaultValue={40} /></Field>
          </div>
          {kindNew !== "written" && <Field id="ex-neg" label="MCQ ভুলে নেগেটিভ"><select id="ex-neg" className="field" defaultValue="0.25"><option value="0">নেই</option><option value="0.25">০.২৫</option><option value="0.5">০.৫০</option></select></Field>}
          {kindNew !== "mcq" && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="ex-mod" label="দ্বিতীয় যাচাই (%)"><input id="ex-mod" type="number" min={0} max={100} className="field" defaultValue={10} /></Field>
            <Field id="ex-recheck" label="পুনর্মূল্যায়নের সময় (দিন)"><input id="ex-recheck" type="number" min={0} max={14} className="field" defaultValue={3} /></Field></div>}
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" defaultChecked className="accent-[var(--color-primary)]" /> প্রশ্ন আর অপশন প্রতিজনের আলাদা ক্রমে</label>
          {kindNew === "mcq" && <label className="flex items-center gap-3 text-sm"><input type="checkbox" defaultChecked className="accent-[var(--color-primary)]" /> অন্য ট্যাব বা অ্যাপে গেলে সাথে সাথে জমা</label>}
        </div>
      </Modal>
      <Modal open={!!fix} onClose={() => setFix(null)} icon="rule" tone="amber" title="প্রশ্ন সংশোধন" sub={fix?.title}
        actions={[{ label: "বাতিল", kind: "ghost" }, { label: "সংশোধন করুন", onClick: () => { setFix(null); toast("সংশোধন হয়েছে, নম্বর আবার হিসাব হবে (নমুনা)"); } }]}>
        <div className="space-y-4">
          <Field id="cx-q" label="কোন প্রশ্ন"><select id="cx-q" className="field">{Array.from({ length: 10 }, (_, i) => <option key={i}>প্রশ্ন {bn(i + 1)}</option>)}</select></Field>
          <div><span className="label">কী সংশোধন</span>
            <div className="space-y-2">{["সঠিক উত্তর বদলান", "একাধিক উত্তর সঠিক ধরুন", "প্রশ্নটি বাতিল (সবাই পূর্ণ নম্বর পাবে)"].map((t, i) => <label key={t} className="flex cursor-pointer items-center gap-3 rounded-xl border border-outline-variant/30 p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"><input type="radio" name="cx-k" defaultChecked={i === 0} className="accent-[var(--color-primary)]" />{t}</label>)}</div></div>
          <Field id="cx-opt" label="নতুন সঠিক উত্তর"><select id="cx-opt" className="field"><option>ক</option><option>খ</option><option>গ</option><option>ঘ</option></select></Field>
          <Field id="cx-why" label="কারণ (শিক্ষার্থীরা পরীক্ষা শেষে দেখবে)"><input id="cx-why" className="field" placeholder="যেমন: বইয়ের উত্তরে ভুল ছিল, সঠিক উত্তর গ" /></Field>
          <div className="rounded-xl bg-surface-container-low p-3 text-xs muted dark:bg-white/5"><div className="mb-1 font-bold">আগের সংশোধন</div>এখনো কোনো সংশোধন হয়নি</div>
        </div>
      </Modal>
      <Modal open={!!ana} onClose={() => setAna(null)} icon="analytics" title="পরীক্ষার বিশ্লেষণ" sub={ana?.title} size="max-w-3xl"
        actions={[{ label: "CSV ডাউনলোড", kind: "ghost", onClick: () => toast("CSV নামানো পরে যুক্ত হবে", "info") }, { label: "বন্ধ করুন", kind: "ghost" }]}>
        <h4 className="mb-2 text-sm font-bold">প্রশ্নভিত্তিক</h4>
        <div className="mb-5 overflow-x-auto"><table className="w-full min-w-[520px]">
          <thead><tr className="border-b border-outline-variant/20"><th className="th px-2!">প্রশ্ন</th><th className="th px-2!">সঠিক</th><th className="th px-2!">অপশন</th><th className="th px-2!">সময়</th></tr></thead>
          <tbody className="divide-y divide-outline-variant/10">{[[1, 92, "ক ৯২% · খ ৪% · গ ৩%", "৩৮ সে"], [2, 41, "ক ২২% · খ ৪১% · গ ৩০%", "১ মি ১০ সে"], [3, 18, "ক ৫৫% · খ ১৮% · ঘ ২০%", "১ মি ৪০ সে"]].map(([q, c, o, t]) => (
            <tr key={String(q)}><td className="td px-2! font-bold">প্রশ্ন {bn(Number(q))}</td><td className="td px-2!"><Badge tone={Number(c) > 70 ? "green" : Number(c) > 30 ? "amber" : "red"}>{bn(Number(c))}%{Number(c) > 90 ? " · খুব সহজ" : Number(c) < 20 ? " · খুব কঠিন" : ""}</Badge></td><td className="td px-2! text-xs muted">{o}</td><td className="td px-2! text-xs">{t}</td></tr>))}</tbody>
        </table></div>
        <h4 className="mb-1 text-sm font-bold">যাঁদের নম্বরে খেয়াল করা দরকার</h4>
        <p className="mb-2 text-xs muted">ট্যাব বদল, খুব কম সময়ে বেশি নম্বর, বা পাশের জনের সাথে প্রায় একই উত্তর</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[520px]">
          <thead><tr className="border-b border-outline-variant/20"><th className="th px-2!">শিক্ষার্থী</th><th className="th px-2!">নম্বর</th><th className="th px-2!">ট্যাব বদল</th><th className="th px-2!">পার্থক্য</th><th className="th px-2!">সংকেত</th></tr></thead>
          <tbody className="divide-y divide-outline-variant/10"><tr><td className="td px-2!">তানভীর আহমেদ</td><td className="td px-2!">৯৬%</td><td className="td px-2!">৩</td><td className="td px-2!">মিল: ৯৪%</td><td className="td px-2!"><Badge tone="red">বেশি মিল</Badge></td></tr></tbody>
        </table></div>
      </Modal>
    </>
  );
}
