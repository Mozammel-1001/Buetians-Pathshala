"use client";
/* eslint-disable @next/next/no-img-element -- প্রশ্নের ছবি private Storage এর signed URL বা এখনই বাছা ফাইল, next/image এর উপযোগী নয় */

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { createClient } from "@/lib/supabase/client";
import { BTN_GHOST, MUTED, Tex } from "@/app/practice/ui";
import { saveQuestions } from "../actions";
import { L, LOCKWORDS, num, parseBulk, toNum, SAMPLE, type Chapter, type NewQ, type QKind, type QRow } from "../lib";

// প্রশ্নের ফর্ম আর "একসাথে অনেক MCQ" (modal এর ভেতরের অংশ)। modal এর বোতাম (সংরক্ষণ ইত্যাদি) বাইরে থেকে
// ref দিয়ে এই কম্পোনেন্টের save() ডাকে; সফল হলে এখান থেকেই বন্ধ আর তালিকা নতুন হয়

const SM = " px-3! py-1.5! text-xs!";
// ছবি: আগে থেকে রাখা (path + signed url) অথবা এইমাত্র বাছা (blob; সংরক্ষণের সময় Storage এ যায়)
export type DImg = { path: string | null; url: string; blob?: Blob };
export type Draft = {
  id?: number; kind: QKind; section: string; body: string; image: DImg | null; options: string[]; optionImages: (DImg | null)[];
  key: number | null; exp: string; scheme: string; chapterId: number | null; marks: number; lock: boolean; lockAuto: boolean;
};
// modal এর বোতাম এই ref এর ফাংশন ডাকে; true ফেরালে কাজ হয়ে গেছে (প্রশ্নের ফর্মে: আরেকটা চাই কিনা; অনেক MCQ তে: যোগ করব কিনা)
export type Saver = MutableRefObject<((flag: boolean) => Promise<boolean>) | null>;

export const blankDraft = (kind: QKind, section: string): Draft => kind === "mcq"
  ? { kind, section: "", body: "", image: null, options: ["", "", "", ""], optionImages: [null, null, null, null], key: null, exp: "", scheme: "", chapterId: null, marks: 1, lock: false, lockAuto: true }
  : { kind, section: section || "সৃজনশীল", body: "", image: null, options: [], optionImages: [], key: null, exp: "", scheme: "", chapterId: null, marks: 10, lock: false, lockAuto: false };
export const draftOf = (q: QRow): Draft => ({
  id: q.id, kind: q.kind, section: q.section, body: q.body, image: q.image && { ...q.image }, options: [...q.options], optionImages: q.optionImages.map((i) => (i ? { ...i } : null)),
  key: q.key, exp: q.exp, scheme: q.scheme, chapterId: q.chapterId, marks: q.marks, lock: q.lock, lockAuto: false,
});
// কপি: নতুন প্রশ্ন (id নেই); ছবি একই ফাইল ধরে রাখলে একটা মুছলে অন্যটার ছবি যেত, তাই ছবির ফাইল আবার নামিয়ে নতুন করে রাখা হবে
export async function copyDraft(q: QRow): Promise<Draft> {
  const again = async (i: { url: string } | null): Promise<DImg | null> => {
    if (!i) return null;
    try { const blob = await (await fetch(i.url)).blob(); return { path: null, url: URL.createObjectURL(blob), blob }; } catch { return null; }
  };
  return { ...draftOf(q), id: undefined, image: await again(q.image), optionImages: await Promise.all(q.optionImages.map(again)) };
}

// গণিতের বোতাম: শেষ যে ঘরে লিখছিলেন সেখানে কার্সরের জায়গায় বসে
const SNIPS: [string, string][] = [["ভগ্নাংশ", "\\frac{}{}"], ["বর্গমূল", "\\sqrt{}"], ["ঘাত", "^{}"], ["নিচে", "_{}"], ["π", "\\pi"], ["θ", "\\theta"], ["α", "\\alpha"], ["°", "^\\circ"], ["×", "\\times"], ["÷", "\\div"],
  ["≤", "\\le"], ["≥", "\\ge"], ["≠", "\\ne"], ["±", "\\pm"], ["→", "\\to"], ["∞", "\\infty"], ["∫", "\\int_{}^{}"], ["Σ", "\\sum_{}^{}"], ["lim", "\\lim_{x \\to }"], ["ভেক্টর", "\\vec{}"], ["ম্যাট্রিক্স", "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}"]];

// ছবি পড়া: বড় হলে ১০০০px এ ছোট করে JPEG (Storage এ <exam_id>/<uuid>.jpg)
function readImage(file: File | null): Promise<DImg> {
  return new Promise((res, rej) => {
    if (!file || !/^image\//.test(file.type)) { rej(new Error("শুধু ছবি (JPG, PNG, SVG) দেওয়া যায়")); return; }
    if (file.size > 10 * 1024 * 1024) { rej(new Error("ছবি ১০ MB এর বেশি বড়")); return; }
    const src = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const w0 = im.naturalWidth || 800, h0 = im.naturalHeight || 600, sc = Math.min(1, 1000 / Math.max(w0, h0));
      const c = document.createElement("canvas"); c.width = Math.round(w0 * sc); c.height = Math.round(h0 * sc);
      const g = c.getContext("2d")!; g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(src);
      c.toBlob((blob) => { if (!blob) { rej(new Error("ছবি পড়া যায়নি")); return; } res({ path: null, url: URL.createObjectURL(blob), blob }); }, "image/jpeg", 0.85);
    };
    im.onerror = () => { URL.revokeObjectURL(src); rej(new Error("ছবি পড়া যায়নি")); };
    im.src = src;
  });
}

// সংরক্ষণের আগে সহজ যাচাই (database এর নিয়মই; ছবি উঠানোর আগেই ভুল ধরা)
function localCheck(d: Draft, examKind: string): { error: string; field: string } | null {
  if ((examKind === "mcq" && d.kind !== "mcq") || (examKind === "written" && d.kind !== "written")) return { error: `এই পরীক্ষায় ${d.kind === "mcq" ? "MCQ" : "লিখিত"} প্রশ্ন দেওয়া যায় না`, field: "body" };
  if (!d.body.trim() && !d.image) return { error: "প্রশ্ন লিখুন বা ছবি দিন", field: "body" };
  if (!(d.marks > 0 && d.marks <= 100) || d.marks * 2 !== Math.trunc(d.marks * 2)) return { error: "নম্বর ০.৫ থেকে ১০০ এর মধ্যে, ০.৫ এর ঘরে", field: "marks" };
  if (d.kind === "mcq") {
    const empty = d.options.findIndex((o, i) => !o.trim() && !d.optionImages[i]);
    if (d.options.length < 2 || d.options.length > 6) return { error: "অপশন ২ থেকে ৬টি দিন", field: "opts" };
    if (empty >= 0) return { error: `অপশন ${"কখগঘঙচ"[empty]} খালি: লেখা বা ছবি দিন`, field: "opts" };
    if (!(Number.isInteger(d.key) && d.key! >= 0 && d.key! < d.options.length)) return { error: "সঠিক উত্তর বাছুন", field: "opts" };
  } else if (!d.section.trim()) return { error: "সেকশন দিন (যেমন সৃজনশীল)", field: "section" };
  return null;
}

type FieldId = "body" | "exp" | "scheme" | "section" | `opt-${number}`;

export function QuestionForm({ examId, examKind, init, chapters, sections, saveRef, onDone, toast }: {
  examId: number; examKind: string; init: Draft; chapters: Chapter[]; sections: string[]; saveRef: Saver; onDone: (next: QKind | null) => void; toast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const [d, setD] = useState<Draft>(init);
  const [err, setErr] = useState<{ error: string; field: string } | null>(null);
  const lastRef = useRef<FieldId>("body");
  const busy = useRef(false);
  const dRef = useRef(d);
  useEffect(() => { dRef.current = d; }, [d]);
  const secs = [...new Set(["সৃজনশীল", "সংক্ষিপ্ত", ...sections])];

  const setField = useCallback((id: FieldId, v: string) => {
    setD((x) => {
      if (id === "body" || id === "exp" || id === "scheme" || id === "section") return { ...x, [id]: v };
      const k = Number(id.slice(4)), options = [...x.options]; options[k] = v;
      return { ...x, options, lock: x.lockAuto && LOCKWORDS.test(v) ? true : x.lock };
    });
  }, []);
  const snip = (i: number) => {
    const el = document.getElementById("q-" + lastRef.current) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) return;
    let t = SNIPS[i][1];
    const a = el.selectionStart ?? el.value.length, b = el.selectionEnd ?? a, v = el.value;
    if ((v.slice(0, a).match(/\$/g) || []).length % 2 === 0) t = "$" + t + "$"; // আগে থেকেই $...$ এর ভেতরে না থাকলে
    setField(lastRef.current, v.slice(0, a) + t + v.slice(b));
    const caret = a + (t.indexOf("{}") >= 0 ? t.indexOf("{}") + 1 : t.length);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(caret, caret); });
  };
  const setImg = useCallback(async (target: "q" | number, file: File | null) => {
    try {
      const img = await readImage(file);
      setD((x) => target === "q" ? { ...x, image: img } : { ...x, optionImages: x.optionImages.map((o, k) => (k === target ? img : o)) });
    } catch (e) { toast((e as Error).message, "error"); }
  }, [toast]);
  // ছবি কপি করে Ctrl+V: অপশনের ঘরে থাকলে সেই অপশনে, নইলে প্রশ্নে
  useEffect(() => {
    const on = (ev: ClipboardEvent) => {
      const item = [...(ev.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      if (!item) return;
      ev.preventDefault();
      const a = document.activeElement as HTMLElement | null, m = /^q-opt-(\d+)$/.exec(a?.id ?? "");
      void setImg(m ? Number(m[1]) : "q", item.getAsFile());
    };
    document.addEventListener("paste", on);
    return () => document.removeEventListener("paste", on);
  }, [setImg]);

  const setOpt = (dir: 1 | -1, k = 0) => setD((x) => {
    if (dir > 0 && x.options.length < 6) return { ...x, options: [...x.options, ""], optionImages: [...x.optionImages, null] };
    if (dir < 0 && x.options.length > 2) return { ...x, options: x.options.filter((_, i) => i !== k), optionImages: x.optionImages.filter((_, i) => i !== k), key: x.key === k ? null : x.key !== null && x.key > k ? x.key - 1 : x.key };
    return x;
  });
  const template = () => setD((x) => {
    const t = "উদ্দীপক: \nক. ... (১)\nখ. ... (২)\nগ. ... (৩)\nঘ. ... (৪)";
    return { ...x, body: x.body.trim() ? x.body + "\n" + t : t, marks: 10 };
  });

  // সংরক্ষণ: আগে বাছা ছবি Storage এ, তারপর প্রশ্ন (database)
  const doSave = useCallback(async (next: boolean) => {
    if (busy.current) return false;
    const x = dRef.current;
    setErr(null);
    const bad = localCheck(x, examKind);
    if (bad) { setErr(bad); document.getElementById("q-" + (bad.field === "opts" ? "opts" : bad.field))?.scrollIntoView({ block: "center", behavior: "smooth" }); return false; }
    busy.current = true;
    try {
      const supabase = createClient();
      const up = async (i: DImg | null) => {
        if (!i) return null;
        if (i.path) return i.path;
        const path = `${examId}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from("question-images").upload(path, i.blob!, { contentType: "image/jpeg" });
        if (error) throw new Error("ছবি রাখা যায়নি: " + (error.message.includes("row-level") ? "অনুমতি নেই বা পরীক্ষা শুরু হয়ে গেছে" : error.message));
        return path;
      };
      const q: NewQ = {
        id: x.id, kind: x.kind, section: x.section, body: x.body, image: await up(x.image), options: x.options, optionImages: x.kind === "mcq" ? await Promise.all(x.optionImages.map(up)) : null,
        key: x.key, exp: x.exp, scheme: x.scheme, chapterId: x.chapterId, marks: x.marks, lock: x.lock,
      };
      const r = await saveQuestions(examId, [q]);
      if (!r.ok) { setErr({ error: r.error, field: r.field === "options" || r.field === "key" ? "opts" : r.field ?? "" }); return false; }
      toast(x.id ? "প্রশ্ন সংরক্ষিত" : "প্রশ্ন যোগ হলো");
      onDone(next ? x.kind : null);
      return true;
    } catch (e) {
      setErr({ error: (e as Error).message || "সংরক্ষণ হয়নি, আবার চেষ্টা করুন", field: "" });
      return false;
    } finally { busy.current = false; }
  }, [examId, examKind, onDone, toast]);
  useEffect(() => { saveRef.current = doSave; return () => { saveRef.current = null; }; }, [saveRef, doSave]);

  const bad = (f: string) => err?.field === f;
  const imgBlock = (src: DImg | null, target: "q", label: string) => (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <label className={`${BTN_GHOST + SM} cursor-pointer`}><span className="icon text-[16px]">add_photo_alternate</span>{src ? "ছবি বদলান" : label}
        <input type="file" accept="image/*" className="hidden" data-img={target} onChange={(e) => { void setImg(target, e.target.files?.[0] ?? null); e.target.value = ""; }} /></label>
      {src && <><img src={src.url} className="ed-thumb" alt="" /><button type="button" className={BTN_GHOST + SM} onClick={() => setD((x) => ({ ...x, image: null }))}>ছবি সরান</button></>}
    </div>
  );
  // লিখিত: অংশের নম্বর (বন্ধনীতে) যোগ করে পূর্ণমানের সাথে মিলিয়ে দেখা
  const parts = d.kind === "written" ? (d.body.match(/\(([০-৯\d.]+)\)\s*$/gm) || []).map((m) => toNum(m.replace(/[()\s]/g, ""))) : [];
  const sum = parts.reduce((t, n) => t + n, 0);

  return (
    <div id="q-form" onFocus={(ev) => { const m = /^q-(body|exp|scheme|section|opt-\d+)$/.exec((ev.target as HTMLElement).id); if (m) lastRef.current = m[1] as FieldId; }}>
      <div className="mb-3 flex flex-wrap gap-1 rounded-xl bg-surface-container-low p-2 dark:bg-white/5" title="যে ঘরে লিখছেন সেখানে বসবে">
        {SNIPS.map((sn, i) => <button key={sn[0]} type="button" className="ed-snip" onMouseDown={(e) => e.preventDefault()} onClick={() => snip(i)}>{sn[0]}</button>)}
        <span className={`text-[11px] ${MUTED} ml-1 self-center`}>গণিত $...$ এর ভেতরে, আলাদা লাইনে $$...$$</span>
      </div>
      {d.kind === "written" && (
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div><label className="ed-label" htmlFor="q-section">সেকশন</label>
            <input id="q-section" className={`ex-field ${bad("section") ? "is-invalid" : ""}`} list="q-secs" value={d.section} onChange={(e) => setField("section", e.target.value)} />
            <datalist id="q-secs">{secs.map((x) => <option key={x} value={x} />)}</datalist></div>
          <div className="flex items-end"><button type="button" className={BTN_GHOST + SM} onClick={template}>সৃজনশীলের কাঠামো বসান</button></div>
        </div>
      )}
      <label className="ed-label" htmlFor="q-body">প্রশ্ন{d.kind === "written" ? " (উদ্দীপক আর অংশগুলো, প্রতি অংশের শেষে বন্ধনীতে নম্বর)" : ""}</label>
      <textarea id="q-body" rows={d.kind === "written" ? 6 : 3} className={`ex-field font-mono text-sm! ${bad("body") ? "is-invalid" : ""}`} value={d.body} onChange={(e) => setField("body", e.target.value)}
        placeholder={d.kind === "mcq" ? "যেমন: $x^2 - 5x + 6 = 0$ এর মূলদ্বয় কী?" : "উদ্দীপক...\nক. ... (২)\nখ. ... (৪)\nগ. ... (৪)"} />
      <div id="q-body-pv" className="ed-pv">{d.body.trim() ? <Tex src={d.body} /> : <span className={MUTED}>প্রশ্নের preview এখানে</span>}</div>
      {imgBlock(d.image, "q", "চিত্র বা ছবি যোগ করুন")}
      <p className={`text-[11px] ${MUTED} mt-1`}>ছবি কপি করে এই ঘরে Ctrl+V দিলেও হবে (অপশনের ঘরে থাকলে সেই অপশনের ছবি)।</p>

      {d.kind === "mcq" && (
        <div className="mt-4">
          <div className="flex items-center justify-between"><span className="ed-label mb-0!">অপশন (সঠিকটায় টিক দিন)</span>{d.options.length < 6 && <button type="button" className={BTN_GHOST + SM} onClick={() => setOpt(1)}>+ অপশন</button>}</div>
          <div id="q-opts" className={`mt-2 grid gap-2 rounded-2xl ${bad("opts") ? "ring-2 ring-error/40" : ""}`}>
            {d.options.map((o, k) => (
              <div key={k} className={`ed-opt-row ${d.key === k ? "is-key" : ""}`}>
                <label className="flex shrink-0 cursor-pointer items-center gap-1.5" title="সঠিক উত্তর">
                  <input type="radio" name="q-key" value={k} checked={d.key === k} onChange={() => setD((x) => ({ ...x, key: k }))} className="h-4 w-4 accent-[#006c49]" />
                  <span className="ex-k h-7! w-7! flex-[0_0_1.75rem]! text-xs">{L[k]}</span></label>
                <div className="min-w-0 grow">
                  <input id={`q-opt-${k}`} className="ex-field py-1.5!" value={o} placeholder={`অপশন ${L[k]}`} onChange={(e) => setField(`opt-${k}`, e.target.value)} />
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm">{/\$/.test(o) ? <Tex as="span" src={o} /> : null}</span>
                    {d.optionImages[k] && <><img src={d.optionImages[k]!.url} className="ed-thumb" alt="" /><button type="button" className="text-xs font-bold text-error" onClick={() => setD((x) => ({ ...x, optionImages: x.optionImages.map((i, j) => (j === k ? null : i)) }))}>ছবি সরান</button></>}
                  </div>
                </div>
                <label className={`shrink-0 cursor-pointer ${MUTED} hover:text-primary`} title="অপশনে ছবি"><span className="icon">add_photo_alternate</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { void setImg(k, e.target.files?.[0] ?? null); e.target.value = ""; }} /></label>
                {d.options.length > 2 && <button type="button" className={`shrink-0 ${MUTED} hover:text-error`} title="অপশন সরান" aria-label="অপশন সরান" onClick={() => setOpt(-1, k)}><span className="icon">close</span></button>}
              </div>
            ))}
          </div>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm"><input id="q-lock" type="checkbox" className="h-4 w-4 accent-[#006c49]" checked={d.lock} onChange={(e) => setD((x) => ({ ...x, lock: e.target.checked, lockAuto: false }))} /> অপশনের ক্রম এলোমেলো হবে না (&quot;সবগুলো&quot;, &quot;কোনোটিই নয়&quot; থাকলে দরকার)</label>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div><label className="ed-label" htmlFor="q-marks">নম্বর</label>
          <input id="q-marks" type="number" min="0.5" step="0.5" className={`ex-field ${bad("marks") ? "is-invalid" : ""}`} value={Number.isNaN(d.marks) ? "" : d.marks} onChange={(e) => setD((x) => ({ ...x, marks: toNum(e.target.value) }))} />
          <p id="q-marks-hint" className={`text-[11px] ${MUTED} mt-1`}>
            {parts.length ? <>অংশের নম্বর যোগ: <b>{num(sum)}</b>{sum !== d.marks ? <> · <button type="button" className="font-bold text-primary underline dark:text-primary-fixed" onClick={() => setD((x) => ({ ...x, marks: sum }))}>এটাই বসান</button></> : " ✓"}</> : null}
          </p></div>
        <div><label className="ed-label" htmlFor="q-chapter">অধ্যায় (অধ্যায়ভিত্তিক রিপোর্টের জন্য)</label>
          <select id="q-chapter" className="ex-field" value={d.chapterId ?? ""} onChange={(e) => setD((x) => ({ ...x, chapterId: e.target.value ? Number(e.target.value) : null }))}>
            <option value="">বাছাই নেই</option>{chapters.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></div>
      </div>
      <label className="ed-label mt-4" htmlFor="q-exp">{d.kind === "mcq" ? "ব্যাখ্যা (পরীক্ষা শেষে শিক্ষার্থী দেখবে)" : "সমাধান (মূল্যায়নকারী আর ফল প্রকাশের পর শিক্ষার্থী দেখবে)"}</label>
      <textarea id="q-exp" rows={d.kind === "mcq" ? 2 : 4} className="ex-field font-mono text-sm!" value={d.exp} onChange={(e) => setField("exp", e.target.value)} />
      {d.exp.trim() && <div id="q-exp-pv" className="ed-pv"><Tex src={d.exp} /></div>}
      {d.kind === "written" && (
        <>
          <label className="ed-label mt-4" htmlFor="q-scheme">নম্বর বিভাজন (কোনটা লিখলে কত, মূল্যায়নকারী দেখে কাটেন)</label>
          <textarea id="q-scheme" rows={3} className="ex-field text-sm!" value={d.scheme} onChange={(e) => setField("scheme", e.target.value)} placeholder={"ক (২): সূত্র ১ + মান ১\nখ (৪): ..."} />
        </>
      )}
      {err && <p id="q-err" role="alert" className="mt-3 text-sm font-bold text-error dark:text-red-300">{err.error}</p>}
    </div>
  );
}

// ---------- একসাথে অনেক MCQ ----------
export function BulkForm({ examId, chapters, saveRef, onDone, toast }: { examId: number; chapters: Chapter[]; saveRef: Saver; onDone: () => void; toast: (m: string, t?: "success" | "error" | "info") => void }) {
  const [text, setText] = useState("");
  const [checked, setChecked] = useState(false);
  const items = parseBulk(text, chapters), badCount = items.filter((x) => x.errs.length).length;
  const textRef = useRef(text);
  useEffect(() => { textRef.current = text; }, [text]);
  const chaptersRef = useRef(chapters);
  const busy = useRef(false);
  // "যাচাই" বোতাম: ফল দেখানো চালু; "যোগ করুন": সব ঠিক থাকলে একসাথে database এ
  useEffect(() => {
    saveRef.current = async (add) => {
      if (!add) { setChecked(true); return false; }
      setChecked(true);
      const list = parseBulk(textRef.current, chaptersRef.current);
      const bad = list.filter((x) => x.errs.length);
      if (!list.length || bad.length) { toast(bad.length ? "সমস্যাগুলো ঠিক করে আবার যোগ করুন" : "কিছু লেখা হয়নি", "error"); return false; }
      if (busy.current) return false;
      busy.current = true;
      try {
        const r = await saveQuestions(examId, list.map((x) => x.q));
        if (!r.ok) { toast(r.error, "error"); return false; }
        toast(`${r.saved.toLocaleString("bn-BD")}টি প্রশ্ন যোগ হলো`);
        onDone();
        return true;
      } finally { busy.current = false; }
    };
    return () => { saveRef.current = null; };
  }, [saveRef, examId, onDone, toast]);
  return (
    <div>
      <p className={`text-sm ${MUTED}`}>Word, PDF বা নোট থেকে কপি করে বসান। প্রতিটি প্রশ্নের মাঝে একটা ফাঁকা লাইন। ছবি পরে প্রতিটি প্রশ্ন সম্পাদনা করে যোগ করা যায়।</p>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer font-bold text-primary dark:text-primary-fixed">কোন ধাঁচে লিখবেন</summary>
        <pre className="ed-pre mt-2">{SAMPLE}</pre>
        <p className={`text-xs ${MUTED} mt-1`}>অপশন &quot;ক)&quot;, &quot;(ক)&quot;, &quot;ক.&quot; বা &quot;a)&quot; যেকোনোভাবে। চাইলে &quot;অধ্যায়: সরলরেখা&quot; আর &quot;নম্বর: ২&quot; ও দেওয়া যায়।</p>
      </details>
      <textarea id="bulk-text" rows={10} className="ex-field mt-3 font-mono text-sm!" value={text} onChange={(e) => { setText(e.target.value); setChecked(false); }} placeholder={SAMPLE.split("\n\n")[0]} />
      {checked && (
        <div id="bulk-out" className="mt-3">
          {!items.length ? <p className="text-sm text-error">কিছু লেখা হয়নি</p> : (
            <>
              <p className={`text-sm font-bold ${badCount ? "text-error dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>{items.length.toLocaleString("bn-BD")}টি প্রশ্ন পাওয়া গেছে{badCount ? `, ${badCount.toLocaleString("bn-BD")}টিতে সমস্যা` : ", সব ঠিক আছে"}</p>
              <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
                {items.map((x) => (
                  <div key={x.no} data-bulk={x.no} className={`rounded-xl border p-3 text-sm ${x.errs.length ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-300" : "border-outline-variant/30"}`}>
                    <b>{x.no.toLocaleString("bn-BD")}.</b> <Tex as="span" src={x.q.body} />
                    {x.q.options.length > 0 && <div className="mt-1 grid gap-1 sm:grid-cols-2">{x.q.options.map((o, k) => <span key={k} className={k === x.q.key ? "font-bold text-emerald-700 dark:text-emerald-300" : ""}>{L[k] || "?"}) <Tex as="span" src={o} /></span>)}</div>}
                    {x.errs.length > 0 && <p className="mt-1 text-xs font-bold">{x.errs.join(" · ")}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
