"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ExModal, useExToast, type ModalSpec } from "@/app/practice/ui";
import { bn } from "@/app/evaluator/lib";
import { BTN_GHOST, BTN_PRI, MUTED } from "@/app/evaluator/ui";
import { addMaterial } from "./actions";

// শিক্ষকের কাজের modal গুলো (ড্যাশবোর্ড আর কোর্সের কন্টেন্টের পাতা দুই জায়গা থেকে খোলে):
// কোর্স বাছা, "কী যোগ করতে চান?", স্টাডি ম্যাটেরিয়াল আপলোড। রেকর্ডেড ভিডিও আপলোড (Bunny) এখনো যুক্ত নয়
export type ToolCourse = { id: number; title: string; batch: string; chapters: { id: number; title: string }[] };
type Tools = { selectCourse: (action: "material" | "video" | "live") => void; contentType: (courseId?: number) => void; material: (courseId?: number) => void; soon: (msg?: string) => void };
const Ctx = createContext<Tools | null>(null);
export const useTools = () => { const t = useContext(Ctx); if (!t) throw new Error("TeacherTools দরকার"); return t; };

const TYPES: Record<string, { label: string; desc: string; icon: string; cls: string }> = {
  sheet: { label: "লেকচার শিট", desc: "ক্লাসের নোট ও ব্যাখ্যা", icon: "description", cls: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" },
  bank: { label: "প্রশ্নব্যাংক", desc: "বোর্ড বা ভর্তি পরীক্ষার প্রশ্ন", icon: "quiz", cls: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" },
  solution: { label: "সমাধান", desc: "পরীক্ষা বা অনুশীলনীর সমাধান", icon: "task_alt", cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" },
  formula: { label: "সূত্র ও সারসংক্ষেপ", desc: "রিভিশনের জন্য সূত্রের তালিকা", icon: "functions", cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" },
};
const MAX = 50 * 1024 * 1024;
const fullName = (c: ToolCourse) => (c.batch ? `${c.title} (${c.batch})` : c.title);

// PDF এর পৃষ্ঠা গোনা (সাধারণ PDF এ কাজ করে; না পারলে খালি থাকে)
async function countPdfPages(file: File) {
  try {
    const text = new TextDecoder("latin1").decode(await file.slice(0, Math.min(file.size, 8 * 1024 * 1024)).arrayBuffer());
    const pages = text.match(/\/Type\s*\/Page(?!s)/g);
    return pages ? pages.length : null;
  } catch { return null; }
}

export function TeacherTools({ courses, children }: { courses: ToolCourse[]; children: ReactNode }) {
  const router = useRouter();
  const [toast, toastNode] = useExToast();
  const [modal, setModal] = useState<ModalSpec | null>(null);
  const [mat, setMat] = useState<{ course: number } | null>(null);
  const close = useCallback(() => setModal(null), []);
  const empty = useCallback(() => { toast("আপনাকে এখনো কোনো কোর্সে শিক্ষক করা হয়নি", "info"); }, [toast]);
  const soon = useCallback((msg = "এই অংশটি শীঘ্রই আসছে") => toast(msg, "info"), [toast]);

  const material = useCallback((courseId?: number) => { if (!courses.length) return empty(); setMat({ course: courseId ?? courses[0].id }); }, [courses, empty]);
  const choose = useCallback((action: "material" | "video" | "live", c: ToolCourse) => {
    if (action === "material") setTimeout(() => setMat({ course: c.id }), 320);   // আগের modal বন্ধ হওয়ার পর
    else if (action === "live") router.push(`/teacher/live?course=${c.id}`);
    else soon("রেকর্ডেড ভিডিও আপলোড শীঘ্রই আসছে");
  }, [router, soon]);
  const selectCourse = useCallback((action: "material" | "video" | "live") => {
    if (!courses.length) return empty();
    setModal({
      icon: "school", title: "কোর্স নির্বাচন করুন",
      body: <div className="flex flex-col gap-2">{courses.map((c) => (
        <button key={c.id} type="button" data-course={c.id} onClick={() => { close(); choose(action, c); }}
          className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant/40 p-4 text-left transition-colors hover:border-primary hover:bg-surface-container-low dark:hover:border-primary-fixed dark:hover:bg-white/5">
          <span className="font-bold text-on-background dark:text-background">{fullName(c)}</span><span className={`icon ${MUTED}`}>arrow_forward</span>
        </button>
      ))}</div>,
      actions: [{ label: "বন্ধ করুন", kind: "ghost" }],
    });
  }, [courses, empty, close, choose]);
  const contentType = useCallback((courseId?: number) => {
    const c = courses.find((x) => x.id === courseId) ?? courses[0];
    if (!c) return empty();
    const opt = (id: string, icon: string, cls: string, t: string, d: string, on: () => void) => (
      <button key={id} type="button" data-type={id} onClick={() => { close(); on(); }}
        className="flex w-full items-center gap-4 rounded-xl border border-outline-variant/40 p-4 text-left transition-colors hover:border-primary hover:bg-surface-container-low dark:hover:border-primary-fixed dark:hover:bg-white/5">
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${cls}`}><span className="icon">{icon}</span></span>
        <span><span className="block font-bold text-on-background dark:text-background">{t}</span><span className={`block text-xs ${MUTED}`}>{d}</span></span>
      </button>
    );
    setModal({
      icon: "add_circle", title: "কী যোগ করতে চান?",
      body: <><p className={`mb-3 text-xs ${MUTED}`}>{c.title}</p><div className="flex flex-col gap-2">
        {opt("video", "video_file", "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400", "ভিডিও ক্লাস", "রেকর্ডেড লেকচার আপলোড করুন", () => soon("রেকর্ডেড ভিডিও আপলোড শীঘ্রই আসছে"))}
        {opt("material", "description", "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400", "স্টাডি ম্যাটেরিয়াল", "পিডিএফ, নোট বা লেকচার শিট", () => setTimeout(() => setMat({ course: c.id }), 320))}
      </div></>,
      actions: [{ label: "বন্ধ করুন", kind: "ghost" }],
    });
  }, [courses, empty, close, soon]);

  const tools = useMemo<Tools>(() => ({ selectCourse, contentType, material, soon }), [selectCourse, contentType, material, soon]);
  return (
    <Ctx.Provider value={tools}>
      {children}
      <ExModal spec={modal} close={close} />
      {mat && <MaterialModal key={mat.course} courses={courses} start={mat.course} onClose={() => setMat(null)} onDone={(label) => { setMat(null); toast(`আপলোড হয়েছে · শিক্ষার্থীরা "${label}" ট্যাবে পাবে`); router.refresh(); }} toast={toast} />}
      {toastNode}
    </Ctx.Provider>
  );
}

// স্টাডি ম্যাটেরিয়াল আপলোড (teacher_dashboard.html এর material-modal): কোর্স, অধ্যায়, ধরন, শিরোনাম, PDF
function MaterialModal({ courses, start, onClose, onDone, toast }: { courses: ToolCourse[]; start: number; onClose: () => void; onDone: (label: string) => void; toast: (m: string, t?: "success" | "error" | "info") => void }) {
  const [course, setCourse] = useState(start);
  const c = courses.find((x) => x.id === course) ?? courses[0];
  const [chapter, setChapter] = useState<string>("");
  const [kind, setKind] = useState("");
  const [title, setTitle] = useState("");
  const [bad, setBad] = useState({ kind: false, title: false, file: false });
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const chap = c.chapters.find((x) => String(x.id) === chapter) ?? c.chapters[0];

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") { if (input.current) input.current.value = ""; setBad((b) => ({ ...b, file: true })); return toast("শুধু PDF ফাইল আপলোড করা যাবে", "error"); }
    if (f.size > MAX) { if (input.current) input.current.value = ""; setBad((b) => ({ ...b, file: true })); return toast("ফাইল ৫০ MB এর বেশি, ছোট করে আবার দিন", "error"); }
    setBad((b) => ({ ...b, file: false })); setFile(f); setPages(await countPdfPages(f));
    if (!title.trim()) { setTitle(f.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim()); setBad((b) => ({ ...b, title: false })); }
  };
  const submit = async () => {
    const t = title.trim();
    const b = { kind: !kind, title: !t, file: !file };
    setBad(b);
    if (b.kind || b.title || b.file || !file) return toast("ধরন, শিরোনাম আর ফাইল দিন", "error");
    setBusy(true); setPct(20);
    const path = `${c.id}/${crypto.randomUUID()}.pdf`;
    const sb = createClient();
    const up = await sb.storage.from("materials").upload(path, file, { contentType: "application/pdf" });
    if (up.error) { setBusy(false); setPct(null); return toast("ফাইল আপলোড হয়নি, আবার চেষ্টা করুন", "error"); }
    setPct(80);
    const r = await addMaterial({ courseId: c.id, chapterId: chap?.id ?? null, kind, title: t, path, pages, bytes: file.size });
    if (!r.ok) { await sb.storage.from("materials").remove([path]); setBusy(false); setPct(null); return toast(r.error, "error"); }
    setPct(100);
    onDone(TYPES[kind].label);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-on-background/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="স্টাডি ম্যাটেরিয়াল আপলোড" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-2xl dark:border-outline-variant/10 dark:bg-inverse-surface">
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 md:px-8 md:pt-8">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"><span className="icon">upload_file</span></div>
            <div><h3 className="text-xl font-bold text-on-background dark:text-background">স্টাডি ম্যাটেরিয়াল আপলোড</h3><p className={`mt-1 text-xs ${MUTED}`}>ধরন আর অধ্যায় বেছে দিন, শিক্ষার্থীরা সেভাবেই সাজানো পাবে</p></div>
          </div>
          <button type="button" aria-label="বন্ধ করুন" disabled={busy} onClick={onClose} className={`${MUTED} transition-colors hover:text-error`}><span className="icon">close</span></button>
        </div>
        <div className="space-y-2.5 overflow-y-auto px-6 pb-2 md:space-y-5 md:px-8">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:gap-4">
            <div><label htmlFor="mat-course" className={`mb-1.5 block text-xs font-bold ${MUTED}`}>কোর্স</label>
              <select id="mat-course" className="ex-field" value={course} onChange={(e) => { setCourse(Number(e.target.value)); setChapter(""); }}>{courses.map((x) => <option key={x.id} value={x.id}>{fullName(x)}</option>)}</select></div>
            <div><label htmlFor="mat-chapter" className={`mb-1.5 block text-xs font-bold ${MUTED}`}>অধ্যায়</label>
              <select id="mat-chapter" className="ex-field" value={chap?.id ?? ""} onChange={(e) => setChapter(e.target.value)} disabled={!c.chapters.length}>
                {c.chapters.map((x, i) => <option key={x.id} value={x.id}>অধ্যায় {bn(i + 1)}: {x.title}</option>)}{!c.chapters.length && <option value="">কোনো অধ্যায় নেই</option>}</select></div>
          </div>
          <div>
            <span className={`mb-1.5 block text-xs font-bold ${MUTED}`}>ধরন <span className="text-error">*</span></span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{Object.entries(TYPES).map(([k, t]) => (
              <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors hover:border-primary dark:hover:border-primary-fixed ${kind === k ? "border-primary bg-primary/10 shadow-[0_0_0_1px_#006c49] dark:border-primary-fixed dark:bg-primary-fixed/10" : "border-outline-variant/40"}`}>
                <input type="radio" name="mat-type" value={k} className="sr-only" checked={kind === k} onChange={() => { setKind(k); setBad((b) => ({ ...b, kind: false })); }} />
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${t.cls}`}><span className="icon text-[20px]">{t.icon}</span></span>
                <span><span className="block text-sm font-bold text-on-background dark:text-background">{t.label}</span><span className={`block text-[11px] ${MUTED}`}>{t.desc}</span></span>
              </label>
            ))}</div>
            {bad.kind && <p id="mat-type-err" className="mt-1.5 text-xs font-bold text-error">একটা ধরন বেছে নিন</p>}
          </div>
          <div><label htmlFor="mat-title" className={`mb-1.5 block text-xs font-bold ${MUTED}`}>শিরোনাম <span className="text-error">*</span></label>
            <input id="mat-title" className={`ex-field ${bad.title ? "is-invalid" : ""}`} maxLength={120} value={title} placeholder="যেমন: লেকচার শিট ০৭: ত্রিকোণমিতি" onChange={(e) => { setTitle(e.target.value); setBad((b) => ({ ...b, title: false })); }} /></div>
          <div>
            <span className={`mb-1.5 block text-xs font-bold ${MUTED}`}>ফাইল (PDF, সর্বোচ্চ ৫০ MB) <span className="text-error">*</span></span>
            <label htmlFor="mat-file" className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed p-5 text-center transition-colors hover:border-primary dark:hover:border-primary-fixed ${bad.file ? "border-error" : "border-outline-variant/50"}`}>
              <span className="icon text-3xl text-primary dark:text-primary-fixed">cloud_upload</span>
              <span id="mat-file-name" className="text-sm font-bold text-on-background dark:text-background">{file ? file.name : "PDF ফাইল বেছে নিন"}</span>
              <span id="mat-file-info" className={`text-xs ${MUTED}`}>{file ? `${bn((file.size / 1048576).toFixed(1))} MB${pages ? " · " + bn(pages) + " পৃষ্ঠা" : ""}` : ""}</span>
              <input ref={input} id="mat-file" type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
            </label>
          </div>
          <div className={`flex items-start gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-low p-3 text-xs dark:bg-white/5 ${MUTED}`}>
            <span className="icon text-[18px] text-primary dark:text-primary-fixed">visibility</span>
            <span>শিক্ষার্থীরা পাবে: <b>স্টাডি ম্যাটেরিয়ালস › {c.title}{chap ? " › " + chap.title : ""}</b>{kind ? <>, &quot;<b>{TYPES[kind].label}</b>&quot; ট্যাবে</> : ""}</span>
          </div>
          {pct !== null && (
            <div><div className="mb-1 flex justify-between text-xs font-bold text-on-background dark:text-background"><span>আপলোড হচ্ছে...</span><span>{bn(pct)}%</span></div>
              <div className="h-2 w-full rounded-full bg-surface-container-highest dark:bg-on-surface-variant"><div className="h-2 rounded-full bg-primary transition-all duration-200 dark:bg-primary-fixed" style={{ width: pct + "%" }} /></div></div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 pt-2.5 pb-6 md:px-8 md:pt-4 md:pb-8">
          <button type="button" className={BTN_GHOST} disabled={busy} onClick={onClose}>বাতিল করুন</button>
          <button type="button" id="mat-submit" className={BTN_PRI} disabled={busy} onClick={() => void submit()}><span className="icon text-[18px]">upload</span>আপলোড করুন</button>
        </div>
      </div>
    </div>
  );
}
