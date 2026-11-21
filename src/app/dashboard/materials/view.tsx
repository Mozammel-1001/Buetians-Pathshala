"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { bn } from "@/lib/content-schema";
import { Modal, SampleNote, useToast } from "../../admin/_components/kit";

type T = "sheet" | "bank" | "solution" | "formula";
const TYPES: Record<T, { label: string; icon: string; cls: string }> = {
  sheet: { label: "লেকচার শিট", icon: "description", cls: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  bank: { label: "প্রশ্নব্যাংক", icon: "quiz", cls: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" },
  solution: { label: "সমাধান", icon: "task_alt", cls: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
  formula: { label: "সূত্র ও সারসংক্ষেপ", icon: "functions", cls: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
};
const COURSES = [
  { id: 1, name: "উচ্চতর গণিত ১ম পত্র", batch: "এইচএসসি ব্যাচ", teacher: "সাঈদ সামি" },
  { id: 2, name: "ইঞ্জিনিয়ারিং গণিত প্রস্তুতি", batch: "অ্যাডমিশন ব্যাচ", teacher: "সাঈদ সামি" },
];
const CHAPTERS: Record<number, { id: string; title: string; f: string[] }[]> = {
  1: [
    { id: "c1", title: "ম্যাট্রিক্স ও নির্ণায়ক", f: ["(AB)ᵀ = BᵀAᵀ", "|AB| = |A| × |B|", "A⁻¹ = adj(A) ÷ |A|, যেখানে |A| ≠ ০"] },
    { id: "c2", title: "সরলরেখা", f: ["ঢাল m = (y₂ − y₁) ÷ (x₂ − x₁)", "বিন্দু-ঢাল আকার: y − y₁ = m(x − x₁)"] },
    { id: "c3", title: "বৃত্ত", f: ["(x − h)² + (y − k)² = r²"] },
  ],
  2: [
    { id: "d1", title: "সীমা ও অন্তরীকরণ", f: ["lim(x→০) sin x ÷ x = ১", "d/dx (xⁿ) = n xⁿ⁻¹"] },
    { id: "d2", title: "যোগজীকরণ", f: ["∫ xⁿ dx = xⁿ⁺¹ ÷ (n + ১) + c, n ≠ −১"] },
  ],
};
type M = { id: string; ch: string; type: T; title: string; pages: number; mb: number; date: string; fresh?: boolean };
const MATS: Record<number, M[]> = {
  1: [
    { id: "a1", ch: "c1", type: "sheet", title: "লেকচার শিট ০১: ম্যাট্রিক্সের ধারণা ও প্রকারভেদ", pages: 12, mb: 2.4, date: "৩ অক্টো, ২০২৬" },
    { id: "a2", ch: "c1", type: "bank", title: "বোর্ড প্রশ্ন: ম্যাট্রিক্স ও নির্ণায়ক (২০১৮–২০২৫)", pages: 20, mb: 3.8, date: "১০ অক্টো, ২০২৬" },
    { id: "a3", ch: "c1", type: "solution", title: "সাপ্তাহিক পরীক্ষা ০১ ও ০২ এর সমাধান", pages: 8, mb: 1.2, date: "১৫ অক্টো, ২০২৬" },
    { id: "a4", ch: "c2", type: "sheet", title: "লেকচার শিট ০৩: সরলরেখার ঢাল ও সমীকরণ", pages: 16, mb: 3.1, date: "২৪ অক্টো, ২০২৬" },
    { id: "a5", ch: "c2", type: "formula", title: "সরলরেখা: সব সূত্র এক পাতায়", pages: 2, mb: 0.6, date: "২৫ অক্টো, ২০২৬" },
    { id: "a6", ch: "c3", type: "solution", title: "বৃত্ত: অনুশীলনীর সম্পূর্ণ সমাধান", pages: 22, mb: 4.1, date: "১৪ নভে, ২০২৬", fresh: true },
  ],
  2: [
    { id: "b1", ch: "d1", type: "sheet", title: "লেকচার শিট ০১: সীমার ধারণা", pages: 10, mb: 2.0, date: "৪ অক্টো, ২০২৬" },
    { id: "b2", ch: "d1", type: "bank", title: "বুয়েট ভর্তি প্রশ্ন: অন্তরীকরণ (২০১০–২০২৫)", pages: 24, mb: 4.4, date: "১৮ অক্টো, ২০২৬" },
    { id: "b3", ch: "d2", type: "formula", title: "যোগজীকরণ: গুরুত্বপূর্ণ সূত্র", pages: 2, mb: 0.5, date: "১৫ নভে, ২০২৬", fresh: true },
  ],
};

// স্টাডি ম্যাটেরিয়ালস (materials.html): কোর্স বাছাই, খোঁজা, চার সংখ্যা, ধরনের ট্যাব, অধ্যায়ভিত্তিক ভাঁজ করা তালিকা,
// দেখা (প্রিভিউ) আর ডাউনলোড। ধাপ ১: শুধু UI (নমুনা তথ্য)
export function MaterialsView() {
  const sp = useSearchParams();
  const router = useRouter();
  const course = COURSES.find((c) => c.id === Number(sp.get("course"))) ?? COURSES[0];
  const [type, setType] = useState<"all" | T>("all");
  const [q, setQ] = useState("");
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [view, setView] = useState<M | null>(null);
  const [toast, node] = useToast();
  const all = MATS[course.id];
  const list = all.filter((m) => (type === "all" || m.type === type) && (!q || m.title.includes(q)));
  const groups = CHAPTERS[course.id].map((ch, i) => ({ ch, i, items: list.filter((m) => m.ch === ch.id) })).filter((g) => g.items.length);
  const stat = (icon: string, cls: string, v: string, l: string) => (
    <div className="tilt-card rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 dark:border-outline-variant/10 dark:bg-inverse-surface">
      <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-full ${cls}`}><span className="icon">{icon}</span></div>
      <div className="text-2xl font-bold text-on-background dark:text-background">{v}</div><div className="text-sm muted">{l}</div>
    </div>
  );
  const dl = () => toast("ডাউনলোড প্রস্তুত হচ্ছে... (নমুনা)", "info");
  const chOf = (m: M) => CHAPTERS[course.id].find((c) => c.id === m.ch);
  return (
    <>
      {node}
      <div className="reveal mb-3 flex flex-wrap items-center gap-4 md:mb-6">
        <Link href="/dashboard" aria-label="ড্যাশবোর্ডে ফিরুন" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant/20 bg-surface-container-low hover:bg-surface-variant dark:bg-white/5"><span className="icon">arrow_back</span></Link>
        <div className="min-w-0 grow"><h2 className="text-2xl font-bold text-on-background md:text-3xl dark:text-background">স্টাডি ম্যাটেরিয়ালস</h2><p className="mt-1 text-sm muted">{course.name} · {course.batch} · {course.teacher}</p></div>
      </div>
      <SampleNote />
      <div className="reveal mb-3 flex flex-col justify-between gap-3 md:mb-6 md:gap-4 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-2">
          {COURSES.map((c) => <button key={c.id} type="button" onClick={() => { setType("all"); router.replace(`/dashboard/materials?course=${c.id}`); }} className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${c.id === course.id ? "border-primary bg-primary text-on-primary" : "border-outline-variant/40 muted hover:border-primary hover:text-primary"}`}>{c.name}</button>)}
        </div>
        <div className="relative w-full lg:w-80">
          <span className="icon pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-on-surface-variant">search</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ম্যাটেরিয়াল খুঁজুন..." aria-label="ম্যাটেরিয়াল খুঁজুন" className="w-full rounded-full border border-outline-variant/30 bg-surface-container-lowest py-2.5 pr-4 pl-12 text-sm focus:border-primary focus:outline-none dark:border-outline-variant/10 dark:bg-inverse-surface" />
        </div>
      </div>
      <div className="reveal mb-4 grid grid-cols-2 gap-3 md:mb-8 md:gap-6 lg:grid-cols-4">
        {stat("folder_open", TYPES.sheet.cls, bn(all.length), "মোট ফাইল")}
        {stat("menu_book", TYPES.formula.cls, bn(CHAPTERS[course.id].length), "অধ্যায়")}
        {stat("fiber_new", TYPES.solution.cls, bn(all.filter((m) => m.fresh).length), "গত ৭ দিনে নতুন")}
        {stat("cloud_download", TYPES.bank.cls, `${bn(all.reduce((a, m) => a + m.mb, 0).toFixed(1))} MB`, "মোট সাইজ")}
      </div>
      <div className="reveal mb-3 md:mb-6">
        <div className="tabs" role="tablist">
          {(["all", ...Object.keys(TYPES)] as ("all" | T)[]).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={type === k} aria-current={type === k ? "page" : undefined} className="tab" onClick={() => setType(k)}>
              {k === "all" ? "সব" : TYPES[k].label}<span className="opacity-70"> ({bn(k === "all" ? all.length : all.filter((m) => m.type === k).length)})</span>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3 md:space-y-5">
        {groups.length ? groups.map((g) => {
          const open = !closed.has(g.ch.id);
          return (
            <div key={g.ch.id} className="overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm dark:border-outline-variant/10 dark:bg-inverse-surface">
              <button type="button" aria-expanded={open} onClick={() => setClosed((s) => { const n = new Set(s); if (n.has(g.ch.id)) n.delete(g.ch.id); else n.add(g.ch.id); return n; })}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-surface-container-low/60 md:px-6 dark:hover:bg-white/5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary dark:text-primary-fixed">{bn(g.i + 1)}</span>
                  <div className="min-w-0"><div className="truncate font-bold text-on-background dark:text-background">{g.ch.title}</div><div className="text-xs muted">{bn(g.items.length)}টি ফাইল</div></div>
                </div>
                <span className={`icon muted transition-transform ${open ? "rotate-180" : ""}`}>expand_more</span>
              </button>
              <div className={`grid transition-[grid-template-rows] duration-300 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="overflow-hidden">
                  <div className="space-y-2 px-3 pb-4 md:px-4">
                    {g.items.map((m, k) => {
                      const t = TYPES[m.type];
                      return (
                        <div key={m.id} className="row-in flex flex-col gap-3 rounded-2xl border border-outline-variant/20 bg-surface-container-low/60 p-3 sm:flex-row sm:items-center md:p-4 dark:bg-white/5" style={{ "--i": k } as React.CSSProperties}>
                          <div className="flex min-w-0 grow items-center gap-4">
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${t.cls}`}><span className="icon">{t.icon}</span></div>
                            <div className="min-w-0">
                              <div className="font-bold text-on-background dark:text-background">{m.title}{m.fresh && <span className="ml-1 rounded bg-error px-1.5 py-0.5 align-middle text-[10px] font-bold text-white">নতুন</span>}</div>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs muted"><span className="font-bold">{t.label}</span><span>{bn(m.pages)} পৃষ্ঠা</span><span>PDF · {bn(m.mb)} MB</span><span>{m.date}</span></div>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button type="button" onClick={() => setView(m)} className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant/40 px-4 py-2 text-sm font-bold muted hover:border-primary hover:text-primary"><span className="icon text-[18px]">visibility</span>দেখুন</button>
                            <button type="button" onClick={dl} className="btn-primary px-4! py-2!"><span className="icon text-[18px]">download</span>ডাউনলোড</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        }) : <div className="py-16 text-center muted"><span className="icon text-5xl opacity-60">search_off</span><p className="mt-3 font-bold">কোনো ম্যাটেরিয়াল পাওয়া যায়নি</p></div>}
      </div>
      <Modal open={!!view} onClose={() => setView(null)} icon={view ? TYPES[view.type].icon : "description"} title={view?.title ?? ""} sub={view ? `${TYPES[view.type].label} · ${bn(view.pages)} পৃষ্ঠা · ${bn(view.mb)} MB · ${view.date}` : ""} size="max-w-3xl"
        actions={[{ label: "বন্ধ করুন", kind: "ghost" }, { label: "ডাউনলোড", onClick: dl }]}>
        {view && (
          <div className="rounded-xl bg-surface-container-low p-3 md:p-6 dark:bg-white/5">
            <div className="mx-auto max-w-[794px] rounded-md bg-white p-6 text-[13.5px] leading-relaxed text-[#0b1c30] shadow-lg md:p-10">
              <div className="mb-2 border-b-[3px] border-[#006c49] pb-2.5">
                <div className="text-lg font-bold text-[#006c49]">বুয়েটিয়ান&apos;স পাঠশালা</div>
                <h1 className="mt-0.5 text-[19px] font-bold">{view.title}</h1>
                <div className="mt-1 text-xs text-[#3c4a42]">কোর্স: {course.name} · অধ্যায়: {chOf(view)?.title} · ধরন: {TYPES[view.type].label}</div>
              </div>
              <h2 className="mt-4 mb-1.5 border-b border-[#d3e4fe] pb-1 text-[15px] font-bold text-[#006c49]">মূল সূত্র</h2>
              <ul className="list-disc pl-5">{chOf(view)?.f.map((f) => <li key={f}>{f}</li>)}</ul>
              <div className="mt-4 border-t border-[#d3e4fe] pt-1.5 text-center text-[11px] text-[#6c7a71]">শুধু কোর্সের শিক্ষার্থীদের জন্য, শেয়ার করা নিষেধ</div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
