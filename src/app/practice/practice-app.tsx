"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  CORRECTIONS, EXAMS, RECHECK_DAYS, RECHECK_MAX, SCRIPTS, UPLOAD_GRACE, chapterReport, examById, grade, mcqs, practicePaper, result, seedState, shuffle, writtenQs,
  type Attempt, type EndReason, type Exam, type Mcq, type Page, type PracQ, type Windows,
} from "./data";
import {
  BTN, BTN_GHOST, BTN_PRI, Badge, CARD, ExModal, LETTERS, MUTED, TONE, Tex, bn, clock, clockSec, mmss, num, span, useExToast, when, type ModalSpec, type ToneKey,
} from "./ui";
import { CropBody, Khata, WrittenCard, blobToPage, pdfToBlobs } from "./written";
import { SampleNote } from "../admin/_components/kit";

// শিক্ষার্থীর পরীক্ষার পাতা, হুবহু practice.html: তালিকা → শুরুর আগে → পরীক্ষা চলছে (MCQ + লিখিত) → ফল/সমাধান/মেধাক্রম,
// অনুশীলন, কাটা খাতা। নিয়ম: সময় শেষে, পাতা ছাড়লে, back এ (জিজ্ঞেস করে), MCQ তে অন্য ট্যাবে গেলে জমা; নেট গেলেও টাইমার চলে।
// এখন নমুনা তথ্য এই browser এ রাখা (localStorage)। [PRODUCTION] সার্ভারের rpc গুলো data.ts এর মাথায় লেখা

const KEY = "bp_practice_v1";
type View = "list" | "intro" | "run" | "result" | "practice" | "written";
type Store = { windows: Windows; attempts: Record<string, Attempt>; practice: Record<string, { score: number; total: number }[]>; rechecks: { sid: string; qid: string; reason: string }[] };
type Run = {
  examId: string; deadline: number; started: number; order: string[]; opt: Record<string, number[]>;
  answers: Record<string, number>; ack: Record<string, number>; marks: Record<string, boolean>; picked: Record<string, boolean>; pages: Record<string, Page[]>;
  cur: number; part: "mcq" | "written"; status: "saved" | "saving" | "offline"; lastSaved: number | null; timeUp: boolean; ended: boolean; tabs: number; processing: string;
};
const KIND: Record<Exam["kind"], [string, ToneKey]> = { mcq: ["MCQ", "gray"], mixed: ["MCQ + লিখিত", "purple"], written: ["লিখিত", "blue"] };
const WHY: Record<EndReason, [string, string] | undefined> = {
  submit: undefined,
  left: ["logout", "পরীক্ষার পাতা ছেড়ে যাওয়ায় (রিলোড, অন্য পাতা বা ব্রাউজার বন্ধ) নিজে থেকে জমা হয়েছে।"],
  back: ["arrow_back", "back চেপে পরীক্ষা থেকে বের হওয়ায় জমা হয়েছে।"],
  tab_hidden: ["tab", "অন্য ট্যাব, অ্যাপ বা উইন্ডোতে যাওয়ায় নিজে থেকে জমা হয়েছে।"],
  reopened: ["devices", "পরীক্ষা আরেক জায়গা থেকে আবার খোলায় আগেরটা জমা হয়ে গেছে।"],
  other_device: ["devices", "অ্যাকাউন্টে অন্য ডিভাইসে লগইন হওয়ায় জমা হয়েছে।"],
  time_up: ["timer_off", "সময় শেষে নিজে থেকে জমা হয়েছে।"],
  expired: ["timer_off", "সময় পেরিয়ে যাওয়ায় সার্ভার নিজে জমা করেছে।"],
};
const readStore = (): Store | null => { try { const d = JSON.parse(localStorage.getItem(KEY) || "null"); return d?.v === 1 ? d.s : null; } catch { return null; } };
const writeStore = (s: Store) => { try { localStorage.setItem(KEY, JSON.stringify({ v: 1, s })); } catch { /* ignore */ } };

export function PracticeApp({ me }: { me: string }) {
  const [store, setStore] = useState<Store | null>(null);
  const [now, setNow] = useState(0);
  const [view, setView] = useState<{ v: View; id: string | null; filter: string }>({ v: "list", id: null, filter: "all" });
  const [run, setRun] = useState<Run | null>(null);
  const [prac, setPrac] = useState<{ examId: string; qs: PracQ[]; ans: Record<string, number>; started: number; done: null | { score: number; correct: number; wrong: number; skipped: number; total: number; secs: number } } | null>(null);
  const [modal, setModal] = useState<ModalSpec | null>(null);
  const [online, setOnline] = useState(true);
  const [toast, toastNode] = useExToast();
  const closeModal = useCallback(() => setModal(null), []);
  const runRef = useRef<Run | null>(null), storeRef = useRef<Store | null>(null), viewRef = useRef(view);
  useEffect(() => { runRef.current = run; storeRef.current = store; viewRef.current = view; });

  // ---------- শুরু: তথ্য পড়া, আগের পাতায় চলা পরীক্ষা থাকলে (পাতা ছেড়ে গিয়েছিল) জমা ----------
  useEffect(() => {
    const t = setTimeout(() => {
      const n = new Date().getTime();
      let s = readStore();
      if (!s) s = { ...seedState(n), practice: {}, rechecks: [] };
      let leftover: string | null = null;
      for (const a of Object.values(s.attempts)) if (a.status === "in_progress") { leftover = a.examId; Object.assign(a, { status: a.deadline < n ? "expired" : "submitted", submitted: Math.min(n, a.deadline), endReason: a.deadline < n ? "expired" : "left", uploadUntil: examById(a.examId)!.kind === "mcq" ? null : n + UPLOAD_GRACE }); }
      writeStore(s); setStore(s); setNow(n); setOnline(navigator.onLine);
      const m = location.hash.slice(1).match(/^(list|intro|run|result|written|practice)(?:-(.+))?$/);
      if (leftover) { setView({ v: "result", id: leftover, filter: "all" }); toast(WHY[s.attempts[leftover].endReason!]?.[1] ?? "পরীক্ষা জমা হয়েছে", "info"); }
      else if (m?.[2]) setView({ v: m[1] === "run" ? (s.attempts[m[2]] ? "result" : "intro") : (m[1] as View), id: m[2], filter: "all" });
    }, 0);
    const i = setInterval(() => setNow(new Date().getTime()), 250);
    return () => { clearTimeout(t); clearInterval(i); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (s: Store) => { writeStore(s); setStore({ ...s }); };
  const go = (v: View, id: string | null = null) => {
    if (runRef.current && !runRef.current.ended && v !== "run") return;   // পরীক্ষা চলছে: জমা ছাড়া বের হওয়া নেই
    setView({ v, id, filter: "all" });
    try { history.replaceState(null, "", location.pathname + "#" + v + (id ? "-" + id : "")); } catch { /* ignore */ }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const stateOf = (e: Exam) => { const w = store!.windows[e.id]; return now < w.opens ? "upcoming" : now < w.closes ? "running" : "closed"; };

  // ---------- জমা ----------
  const finish = useCallback((reason: EndReason) => {
    const r = runRef.current, s = storeRef.current;
    if (!r || !s || r.ended) return;
    const e = examById(r.examId)!, n = new Date().getTime();
    // দেখানো ক্রমের উত্তর → আসল অপশন
    const answers: Record<string, number> = {};
    Object.entries(r.answers).forEach(([qid, v]) => { if (v != null) answers[qid] = r.opt[qid][v]; });
    const picked = Object.keys(r.picked).filter((k) => r.picked[k]);
    s.attempts[r.examId] = { examId: r.examId, started: r.started, deadline: r.deadline, submitted: Math.min(n, r.deadline + 30e3), status: n > r.deadline + 30e3 ? "expired" : "submitted",
      answers, picked, pages: Object.fromEntries(picked.map((k) => [k, r.pages[k] ?? []])), endReason: reason, uploadUntil: e.kind === "mcq" ? null : n + UPLOAD_GRACE };
    writeStore(s);
    runRef.current = { ...r, ended: true };
    document.documentElement.classList.remove("ex-running");
    return true;
  }, []);
  const submitAndShow = (reason: EndReason, msg?: string) => {
    const id = runRef.current?.examId;
    if (!id || !finish(reason)) return;
    setRun(null); setModal(null);
    setStore({ ...storeRef.current! });
    setView({ v: "result", id, filter: "all" });
    try { history.replaceState(null, "", location.pathname + "#result-" + id); } catch { /* ignore */ }
    window.scrollTo({ top: 0 });
    toast(msg ?? (reason === "time_up" ? "সময় শেষ, জমা হয়েছে" : reason === "submit" ? "জমা হয়েছে" : WHY[reason]?.[1] ?? "জমা হয়েছে"), reason === "submit" || reason === "time_up" ? "success" : "info");
  };

  // ---------- শুরু ----------
  const start = (id: string) => {
    const e = examById(id)!, s = store!, n = new Date().getTime();
    if (s.attempts[id]) { go("result", id); return; }
    const w = s.windows[id];
    // প্রত্যেকে প্রশ্ন আর অপশন আলাদা ক্রমে (start_exam)
    const order = shuffle(mcqs(e).map((q) => q.id));
    const opt = Object.fromEntries(mcqs(e).map((q) => [q.id, q.lock ? q.options.map((_, i) => i) : shuffle(q.options.map((_, i) => i))]));
    const r: Run = { examId: id, started: n, deadline: Math.min(n + e.minutes * 60e3, w.closes), order, opt, answers: {}, ack: {}, marks: {}, picked: {}, pages: {}, cur: 0, part: "mcq",
      status: "saved", lastSaved: null, timeUp: false, ended: false, tabs: 0, processing: "" };
    s.attempts[id] = { examId: id, started: n, deadline: r.deadline, submitted: null, status: "in_progress", answers: {}, picked: [], pages: {}, endReason: null, uploadUntil: null };
    writeStore(s); setStore({ ...s });
    runRef.current = r; setRun(r);
    document.documentElement.classList.add("ex-running");
    setView({ v: "run", id, filter: "all" });
    // back চাপলে এই পাতা ছেড়ে না গিয়ে popstate আসে, তখন জিজ্ঞেস
    try { history.replaceState(null, "", location.pathname + "#run-" + id); history.pushState({ exRun: id }, "", location.pathname + "#run-" + id); } catch { /* ignore */ }
    window.scrollTo({ top: 0 });
  };

  // ---------- উত্তর ও সেভ (নমুনা: একটু পরে "সার্ভারে" যায়; নেট না থাকলে ফোনে জমে থাকে) ----------
  const patchRun = (f: (r: Run) => Run) => setRun((r) => { if (!r) return r; const x = f(r); runRef.current = x; return x; });
  const sync = useCallback(() => {
    setTimeout(() => {
      if (!navigator.onLine) { patchRun((r) => ({ ...r, status: "offline" })); return; }
      patchRun((r) => ({ ...r, ack: { ...r.answers }, status: "saved", lastSaved: new Date().getTime(), pages: Object.fromEntries(Object.entries(r.pages).map(([k, l]) => [k, l.map((p) => ({ ...p, status: "up" as const }))])) }));
    }, 600);
  }, []);
  const pick = (k: number | null) => {
    const r = runRef.current; if (!r || r.ended || r.timeUp) return;
    const id = r.order[r.cur];
    patchRun((x) => { const answers = { ...x.answers }; if (k === null) delete answers[id]; else answers[id] = k; return { ...x, answers, status: navigator.onLine ? "saving" : "offline" }; });
    sync();
  };
  const nav = (d: number) => patchRun((x) => ({ ...x, cur: Math.max(0, Math.min(x.order.length - 1, x.cur + d)) }));
  const mark = () => patchRun((x) => { const id = x.order[x.cur]; return { ...x, marks: { ...x.marks, [id]: !x.marks[id] } }; });

  // ---------- পাতা ছাড়া, back, অন্য ট্যাব, কীবোর্ড, নেট ----------
  useEffect(() => {
    if (!run || run.ended) return;
    const e = examById(run.examId)!, hideRule = e.kind === "mcq";
    let hiddenAt: number | null = null;
    const vis = () => {
      const r = runRef.current; if (!r || r.ended) return;
      if (hideRule) { if (document.hidden) submitAndShow("tab_hidden"); return; }
      if (document.hidden) hiddenAt = performance.now();
      else if (hiddenAt !== null) { hiddenAt = null; patchRun((x) => ({ ...x, tabs: x.tabs + 1 })); toast("অন্য অ্যাপে যাওয়া রেকর্ড হয়েছে, শিক্ষক দেখবেন", "info"); }
    };
    const pop = () => { if (runRef.current && !runRef.current.ended) confirmBack(); };
    const before = (ev: BeforeUnloadEvent) => { ev.preventDefault(); ev.returnValue = ""; };
    const hide = () => { finish("left"); };
    const key = (ev: KeyboardEvent) => {
      const r = runRef.current;
      if (!r || r.ended || r.part !== "mcq" || document.querySelector("[role=dialog]")) return;
      if (["INPUT", "TEXTAREA"].includes((ev.target as HTMLElement).tagName)) return;
      const k = ev.key.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
      if (["1", "2", "3", "4"].includes(k)) pick(+k - 1);
      else if (ev.key === "ArrowRight") nav(1);
      else if (ev.key === "ArrowLeft") nav(-1);
      else if (ev.key === "m" || ev.key === "M") mark();
    };
    const on = () => { setOnline(true); sync(); }, off = () => { setOnline(false); patchRun((x) => ({ ...x, status: "offline" })); };
    document.addEventListener("visibilitychange", vis); window.addEventListener("popstate", pop); window.addEventListener("beforeunload", before);
    window.addEventListener("pagehide", hide); document.addEventListener("keydown", key); window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => {
      document.removeEventListener("visibilitychange", vis); window.removeEventListener("popstate", pop); window.removeEventListener("beforeunload", before);
      window.removeEventListener("pagehide", hide); document.removeEventListener("keydown", key); window.removeEventListener("online", on); window.removeEventListener("offline", off);
    };
  }, [run?.examId, run?.ended]); // eslint-disable-line react-hooks/exhaustive-deps

  // সময় শেষ: আর উত্তর নয়, জমা
  useEffect(() => {
    if (!run || run.ended || run.timeUp || !now || run.deadline - now > 0) return;
    const t = setTimeout(() => {
      patchRun((x) => ({ ...x, timeUp: true }));
      setModal({ icon: "timer_off", title: "সময় শেষ", locked: true, body: <p className="text-sm">তোমার উত্তর জমা হচ্ছে…</p>, actions: [{ label: "ঠিক আছে", kind: "ghost" }] });
      setTimeout(() => submitAndShow("time_up"), 900);
    }, 0);
    return () => clearTimeout(t);
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  function confirmBack() {
    const r = runRef.current!, e = examById(r.examId)!;
    const done = r.order.filter((id) => r.answers[id] != null).length;
    setModal({
      icon: "logout", title: "পরীক্ষা থেকে বের হবেন?",
      body: <><p className="text-sm">বের হলে পরীক্ষা এখনই জমা হয়ে যাবে। জমার পর উত্তর বদলানো বা আবার দেওয়া যাবে না।</p>
        <p className={`mt-2 text-sm ${MUTED}`}>উত্তর দিয়েছ {bn(done)}/{bn(r.order.length)}টি{writtenQs(e).length ? ` · লিখিত বাছাই ${bn(Object.values(r.picked).filter(Boolean).length)}টি` : ""}। সময় চলছে।</p></>,
      // "পরীক্ষায় থাকি": ইতিহাসের ধাপ আবার, যাতে পরের back এও আগে জিজ্ঞেস করে
      onClose: () => { try { history.pushState({ exRun: r.examId }, "", location.pathname + "#run-" + r.examId); } catch { /* ignore */ } },
      actions: [{ label: "পরীক্ষায় থাকি", kind: "ghost", id: "ex-back-stay" }, { label: "জমা দিয়ে বের হই", kind: "danger", id: "ex-back-leave", onClick: () => { submitAndShow("back"); return false; } }],
    });
  }
  const modalRef = useRef<ModalSpec | null>(null);
  useEffect(() => { modalRef.current = modal; }, [modal]);
  const closeAny = useCallback(() => { modalRef.current?.onClose?.(); setModal(null); }, []);

  const confirmSubmit = () => {
    const r = runRef.current!, e = examById(r.examId)!;
    const n = r.order.length, done = r.order.filter((id) => r.answers[id] != null).length;
    const marked = Object.values(r.marks).filter(Boolean).length, pending = r.order.filter((id) => r.answers[id] !== r.ack[id]).length;
    const picked = Object.keys(r.picked).filter((k) => r.picked[k]);
    const noPages = picked.filter((k) => !(r.pages[k] ?? []).length).length;
    const box = (v: string, l: string, tone: ToneKey) => <div className={`rounded-xl border p-3 text-center ${TONE[tone]}`}><b className="block text-xl">{v}</b><span className="text-xs">{l}</span></div>;
    setModal({
      icon: "send", title: "পরীক্ষা জমা দেবেন?",
      body: <>
        <div className="mb-4 grid grid-cols-3 gap-2">{box(bn(done), "উত্তর দেওয়া", "green")}{box(bn(n - done), "বাকি", n - done ? "red" : "gray")}{box(bn(marked), "পরে দেখব", marked ? "amber" : "gray")}</div>
        {writtenQs(e).length > 0 && <p className="mb-2 text-sm">লিখিত: <b>{bn(picked.length)}টি</b> প্রশ্ন বাছাই, <b>{bn(picked.reduce((t, k) => t + (r.pages[k] ?? []).length, 0))}টি</b> পাতা{noPages ? <> · <span className="font-bold text-error dark:text-red-300">{bn(noPages)}টি প্রশ্নে পাতা নেই</span></> : null}। জমার পর ১৫ মিনিট আরও পাতা দেওয়া যাবে।</p>}
        {pending > 0 && <p className={`rounded-xl border p-3 text-sm ${TONE.amber}`}>{bn(pending)}টি উত্তর এখনো সার্ভারে যায়নি; জমার সাথে পাঠানো হবে। নেট না থাকলে নেট এলে জমা হবে।</p>}
        <p className={`mt-3 text-sm ${MUTED}`}>জমার পর উত্তর আর বদলানো যাবে না। MCQ এর নম্বর সাথে সাথে দেখবে।</p>
      </>,
      actions: [{ label: "ফিরে যাই", kind: "ghost" }, { label: "জমা দিন", id: "ex-submit-yes", onClick: () => { submitAndShow("submit"); return false; } }],
    });
  };

  // ---------- লিখিত: ছবি → সোজা করা, PDF → পাতা ----------
  const cropOne = (file: File, idx: number, total: number) => new Promise<Blob | null>((resolve) => {
    let api: { done: () => Promise<Blob | null> } | null = null;
    setModal({
      icon: "crop_rotate", title: "খাতার পাতা সোজা করো" + (total > 1 ? ` (${bn(idx + 1)}/${bn(total)})` : ""), wide: true, locked: true,
      body: <CropBody file={file} onReady={(a) => { api = a; }} />,
      actions: [{ label: "বাদ দাও", kind: "ghost", id: "ex-crop-skip", onClick: () => { resolve(null); } },
        { label: "সোজা করে যোগ করো", id: "ex-crop-ok", onClick: () => { (api ? api.done() : Promise.resolve(null)).then(resolve); } }],
    });
  });
  const addFiles = async (qid: string, files: FileList, target: "run" | "attempt") => {
    const list = Array.from(files);
    let bad = 0;
    const put = (p: Page) => {
      if (target === "run") patchRun((x) => ({ ...x, pages: { ...x.pages, [qid]: [...(x.pages[qid] ?? []), p] } }));
      else { const s = storeRef.current!, a = s.attempts[view.id!]; a.pages[qid] = [...(a.pages[qid] ?? []), p]; save(s); }
    };
    for (let i = 0; i < list.length; i++) {
      if (target === "run") patchRun((x) => ({ ...x, processing: `খাতা প্রস্তুত হচ্ছে… (${bn(i + 1)}/${bn(list.length)})` }));
      try {
        const blobs = list[i].type === "application/pdf" ? await pdfToBlobs(list[i]) : [await cropOne(list[i], i, list.length)];
        for (const b of blobs) if (b) put(await blobToPage(b, navigator.onLine));
      } catch { bad++; }
    }
    if (target === "run") patchRun((x) => ({ ...x, processing: "" }));
    if (bad) toast(`${bn(bad)}টি ফাইল পড়া যায়নি, অন্য ছবি বা PDF দাও`, "error");
  };
  const zoom = (src: string, title = "খাতার পাতা") => setModal({ icon: title === "ছবি" ? "zoom_in" : "image", title, wide: true,
    // eslint-disable-next-line @next/next/no-img-element
    body: <img src={src} className="w-full rounded-xl bg-white" alt="" /> });

  if (!store || !now) return <div className={`${CARD} mt-6 h-72 animate-pulse`} />;
  const e = examById(view.id);
  // যে view দেখানো যায় না (চলা পরীক্ষা নেই, জমা হয়নি, এখনো শেষ হয়নি) সেখানে তালিকা
  const doneAttempt = !!e && !!store.attempts[e.id] && store.attempts[e.id].status !== "in_progress";
  const v: View = (view.v === "written") ? "written"
    : !e || view.v === "list" || (view.v === "run" && !run) || (view.v === "result" && !doneAttempt) || (view.v === "practice" && now < store.windows[e.id].closes) || (view.v === "intro" && !!store.attempts[e.id]) ? "list" : view.v;

  const BackBtn = () => <button type="button" className={`${BTN_GHOST} mt-3 mb-2 px-3! py-1.5! md:mt-6 md:mb-4`} onClick={() => go("list")}><span className="icon text-[18px]">arrow_back</span>সব পরীক্ষা</button>;
  let body: ReactNode = null;

  // ================= তালিকা =================
  if (v === "list" || (!e && v !== "written")) {
    const cards = EXAMS.map((ex, i) => {
      const st = stateOf(ex), w = store.windows[ex.id], a = store.attempts[ex.id];
      const nq = mcqs(ex).length, nw = writtenQs(ex).length;
      return (
        <div key={ex.id} className={`row-in ${CARD} flex flex-col gap-3 rounded-2xl! p-4 md:p-5`} style={{ "--i": i } as React.CSSProperties}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><h3 className="text-lg font-bold text-on-background dark:text-background">{ex.title}</h3><p className={`mt-1 text-xs ${MUTED}`}>{ex.courseName}</p></div>
            <div className="flex shrink-0 flex-col items-end gap-1"><Badge tone={KIND[ex.kind][1]}>{KIND[ex.kind][0]}</Badge>
              {!a ? (st === "closed" ? <Badge tone="gray">দাওনি</Badge> : null) : a.status === "in_progress" ? <Badge tone="amber" icon="timer">চলছে</Badge> : <Badge tone="green" icon="task_alt">{a.status === "expired" ? "সময় শেষে জমা হয়েছে" : "জমা দিয়েছ"}</Badge>}</div>
          </div>
          <div className={`grid grid-cols-3 gap-2 text-center text-xs ${MUTED}`}>
            <div className="rounded-xl bg-surface-container-low p-2 dark:bg-white/5"><b className="block text-base text-on-background dark:text-background">{bn(nq)}{nw ? "+" + bn(nw) : ""}</b>{nw ? "MCQ+লিখিত" : "প্রশ্ন"}</div>
            <div className="rounded-xl bg-surface-container-low p-2 dark:bg-white/5"><b className="block text-base text-on-background dark:text-background">{bn(ex.minutes)}</b>মিনিট</div>
            <div className="rounded-xl bg-surface-container-low p-2 dark:bg-white/5"><b className="block text-base text-on-background dark:text-background">{ex.neg ? "−" + num(ex.neg) : "নেই"}</b>ভুলে কাটা</div>
          </div>
          <p className={`flex items-center gap-1 text-xs ${MUTED}`}><span className="icon text-[14px]">schedule</span>{st === "running" ? `চলছে · শেষ হবে ${when(w.closes, now)}` : st === "upcoming" ? `শুরু ${when(w.opens, now)}` : `শেষ হয়েছে ${when(w.closes, now)}`}</p>
          <div className="flex gap-2">
            {a && a.status !== "in_progress" ? <button type="button" className={`${BTN_PRI} flex-1`} onClick={() => go("result", ex.id)}><span className="icon text-[18px]">insights</span>ফল {st === "closed" ? "ও সমাধান" : ""}</button>
              : a ? <button type="button" className={`${BTN_GHOST} flex-1`} disabled>জমা হচ্ছে…</button>
              : st === "running" ? <button type="button" className={`${BTN_PRI} flex-1`} onClick={() => go("intro", ex.id)}><span className="icon text-[18px]">edit_note</span>পরীক্ষা দিন</button>
              : <button type="button" className={`${BTN_GHOST} flex-1`} disabled>{st === "upcoming" ? "এখনো শুরু হয়নি" : "সময় শেষ"}</button>}
            {st === "closed" && <button type="button" className={BTN_GHOST} onClick={() => { setPrac(null); go("practice", ex.id); }} title="মেধাক্রম বদলায় না"><span className="icon text-[18px]">replay</span>অনুশীলন</button>}
          </div>
        </div>
      );
    });
    const scripts = SCRIPTS.map((s, i) => {
      const pub = s.publishedAgo !== null, total = s.questions.reduce((t, q) => t + (q.got ?? 0), 0), marked = s.questions.filter((q) => q.got !== null).length;
      return (
        <div key={s.id} className={`row-in ${CARD} flex flex-col gap-3 rounded-2xl! p-4 md:p-5`} style={{ "--i": cards.length + i } as React.CSSProperties}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><h3 className="text-lg font-bold text-on-background dark:text-background">{s.title}</h3><p className={`mt-1 text-xs ${MUTED}`}>{s.courseName} · খাতা #{s.code}</p></div>
            <div className="flex shrink-0 flex-col items-end gap-1"><Badge tone={KIND[s.kind][1]}>{KIND[s.kind][0]}</Badge>{pub ? <Badge tone="green" icon="verified">ফল প্রকাশিত</Badge> : <Badge tone="amber" icon="hourglass_top">খাতা কাটা চলছে</Badge>}</div>
          </div>
          {pub ? <p className="text-sm">মোট <b className="text-xl">{num(total)}</b> / {bn(s.questions.reduce((t, q) => t + q.marks, 0))}</p>
            : <p className={`text-sm ${MUTED}`}>তোমার {bn(s.questions.length)}টি প্রশ্নের মধ্যে {bn(marked)}টি কাটা হয়েছে। সব খাতা কাটা আর দ্বিতীয় যাচাই শেষে ফল প্রকাশ হবে।</p>}
          <div className="flex gap-2">{pub ? <button type="button" className={`${BTN_PRI} flex-1`} onClick={() => go("written", s.id)}><span className="icon text-[18px]">description</span>কাটা খাতা দেখুন</button> : <button type="button" className={`${BTN_GHOST} flex-1`} disabled>ফলের অপেক্ষায়</button>}</div>
        </div>
      );
    });
    const li = (icon: string, t: string) => <li className="flex gap-3"><span className="icon shrink-0 text-[20px] text-primary dark:text-primary-fixed">{icon}</span><span>{t}</span></li>;
    const rows = chapterReport("math1st", store.windows, store.attempts, now).filter((r) => r.my !== null) as { chapter: string; my: number; cls: number }[];
    const weakest = rows.slice().sort((a, b) => (a.my - a.cls) - (b.my - b.cls))[0];
    body = (
      <>
        <div className="reveal mt-3 mb-4 md:mt-6 md:mb-8"><h1 className="text-[32px] font-bold text-on-background md:text-[44px] dark:text-background">আমার <span className="text-primary dark:text-primary-fixed">পরীক্ষা</span></h1>
          <p className={`mt-1 ${MUTED}`}>চলমান পরীক্ষা, জমা দেওয়া পরীক্ষার ফল আর কাটা খাতা</p></div>
        <SampleNote />
        <div className="grid grid-cols-1 items-start gap-4 md:gap-8 xl:grid-cols-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-4 xl:col-span-2">{cards}{scripts}</div>
          <div className="space-y-3 md:space-y-6">
            <div className={`reveal ${CARD} p-4 md:p-6`}><h3 className="mb-4 text-lg font-bold text-on-background dark:text-background">পরীক্ষার নিয়ম</h3>
              <ul className={`space-y-3 text-sm ${MUTED}`}>
                {li("timer", "সময় গোনে সার্ভার। নেট চলে গেলেও টাইমার থামে না, তাই নেট বন্ধ করে বাড়তি সময় পাওয়া যায় না।")}
                {li("cloud_sync", "প্রতিটি উত্তর সাথে সাথে ফোনে থাকে, নেট থাকলে কয়েক সেকেন্ডের মধ্যে সার্ভারে যায়। নেট ফিরলে জমে থাকা উত্তর নিজে থেকে যায়।")}
                {li("block", "একবার শুরু করলে বাতিল বা আবার খোলা যায় না। পাতা রিলোড, অন্য পাতায় যাওয়া, ব্রাউজার বন্ধ বা সময় শেষ হলে সাথে সাথে জমা। back চাপলে আগে জিজ্ঞেস করে, বের হলে জমা।")}
                {li("tab", "পরীক্ষা চলার সময় সাইট একটাই ট্যাবে খোলা থাকে। MCQ পরীক্ষায় অন্য ট্যাব বা অ্যাপে গেলেও জমা হয়ে যায়।")}
                {li("devices", "একসাথে একটাই ডিভাইসে লগইন। অন্য ডিভাইসে লগইন করলে এখানে লগআউট হয়, চলা পরীক্ষা জমা হয়।")}
                {li("shuffle", "প্রত্যেকে প্রশ্ন আর অপশন আলাদা ক্রমে পায়।")}
                {li("fact_check", "MCQ এর নম্বর জমার সাথে সাথে। কোনটা ভুল, সমাধান আর মেধাক্রম পরীক্ষার সময় শেষে। তারপর চাইলে আবার অনুশীলন, মেধাক্রম বদলায় না।")}
                {li("rate_review", `লিখিত খাতার ফল প্রকাশের ${bn(RECHECK_DAYS)} দিনের মধ্যে প্রশ্নভিত্তিক পুনর্মূল্যায়নের আবেদন করা যায়।`)}
              </ul></div>
            {rows.length > 0 && (
              <div className={`reveal ${CARD} p-4 md:p-6`}><h3 className="text-lg font-bold text-on-background dark:text-background">অধ্যায়ভিত্তিক অবস্থা</h3>
                <p className={`mt-1 mb-4 text-xs ${MUTED}`}>উচ্চতর গণিত ১ম পত্র · শেষ হওয়া পরীক্ষাগুলো থেকে</p>
                <div className="space-y-4">{rows.map((r) => (
                  <div key={r.chapter}><div className="mb-1 flex justify-between text-sm"><b>{r.chapter}</b><span className={MUTED}>তুমি <b className={r.my < r.cls ? "text-error dark:text-red-300" : "text-primary dark:text-primary-fixed"}>{bn(r.my)}%</b> · ক্লাস {bn(r.cls)}%</span></div>
                    <div className="relative h-2.5 overflow-hidden rounded-full bg-surface-container-highest dark:bg-on-surface-variant"><i className={`absolute inset-y-0 left-0 rounded-full ${r.my < r.cls ? "bg-error" : "bg-primary dark:bg-primary-fixed"}`} style={{ width: `${r.my}%` }} /><i className="absolute inset-y-0 w-0.5 bg-on-background dark:bg-background" style={{ left: `${r.cls}%` }} title="ক্লাসের গড়" /></div></div>
                ))}</div>
                {weakest && weakest.my < weakest.cls && <p className={`mt-4 rounded-xl border p-3 text-xs ${TONE.amber}`}><b>{weakest.chapter}</b> অধ্যায়ে তুমি ক্লাসের গড়ের চেয়ে পিছিয়ে। এই অধ্যায়ের লেকচার আর অনুশীলন আবার দেখো।</p>}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ================= শুরুর আগে =================
  else if (v === "intro" && e) {
    const w = store.windows[e.id], nq = mcqs(e).length, nw = writtenQs(e).length;
    const li = (t: string) => <li className="flex gap-2"><span className="icon text-[18px] text-primary dark:text-primary-fixed">check_circle</span><span>{t}</span></li>;
    body = (
      <>
        <BackBtn />
        <Intro key={e.id} onStart={() => setModal({
          icon: "timer", title: "এখনই শুরু করবেন?",
          body: <p className={`text-sm ${MUTED}`}><b>{e.title}</b> · {bn(e.minutes)} মিনিট। শুরু করলে বাতিল বা আবার খোলা যাবে না; পাতা ছাড়লে বা রিলোড করলে{e.kind === "mcq" ? ", অন্য ট্যাব বা অ্যাপে গেলে" : ""} সাথে সাথে জমা হবে। back চাপলে আগে জিজ্ঞেস করবে।</p>,
          actions: [{ label: "এখন না", kind: "ghost" }, { label: "শুরু করুন", id: "ex-start-yes", onClick: () => { start(e.id); } }],
        })}>
          <div className="mb-3 flex flex-wrap gap-2"><Badge tone={KIND[e.kind][1]}>{KIND[e.kind][0]}</Badge><Badge tone="gray">{e.courseName}</Badge></div>
          <h1 className="text-2xl font-bold text-on-background md:text-3xl dark:text-background">{e.title}</h1>
          <p className={`mt-2 ${MUTED}`}>{bn(nq)}টি MCQ{nw ? ` + ${bn(nw)}টি লিখিত (${Object.entries(e.pick).map(([k, v]) => `${k} থেকে যেকোনো ${bn(v)}টি`).join(", ")})` : ""} · {bn(e.minutes)} মিনিট · প্রতি ভুলে −{num(e.neg)} · পরীক্ষা খোলা {when(w.closes, now)} পর্যন্ত</p>
          <ul className={`mt-3 space-y-2 text-sm md:mt-6 ${MUTED}`}>
            {li("শুরু চাপলেই সার্ভারে সময় গোনা শুরু। নেট চলে গেলে বা ফোনের ঘড়ি বদলালেও টাইমার থামবে না।")}
            {li("উত্তর দিলেই ফোনে থাকে, আর কয়েক সেকেন্ডের মধ্যে সার্ভারে যায়। নেট না থাকলে জমে থাকে, নেট এলে নিজে যায়। সময় শেষের আগে নেট না এলে শেষ যে উত্তর সার্ভারে পৌঁছেছিল সেটাই গণ্য হবে।")}
            {nw ? li("লিখিত অংশ: খাতায় লিখে প্রতিটি বাছাই করা প্রশ্নের নিচে ছবি তোলো (কোণা নিজে থেকে ধরে সোজা হবে) বা PDF দাও। জমার পরও ১৫ মিনিট ছবি দেওয়া যাবে।") : null}
            {li("জমা দিলেই MCQ এর নম্বর দেখবে। কোনটা ভুল, সমাধান আর মেধাক্রম পরীক্ষার সময় শেষে।")}
          </ul>
          <div className={`mt-3 rounded-2xl border p-4 md:mt-6 md:p-5 ${TONE.red}`}>
            <b className="flex items-center gap-1.5"><span className="icon text-[20px]">gpp_maybe</span>শুরু করলে আর বাতিল নেই</b>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
              <li>পাতা রিলোড করলে, সাইটের অন্য পাতায় বা অন্য সাইটে গেলে, বা ব্রাউজার বন্ধ করলে সাথে সাথে জমা হয়ে যাবে। আবার খোলা যাবে না।</li>
              <li>back চাপলে আগে জিজ্ঞেস করবে; &quot;জমা দিয়ে বের হই&quot; চাপলে জমা হয়ে যাবে।</li>
              {e.kind === "mcq" ? <li>অন্য ট্যাব, অ্যাপ বা উইন্ডোতে গেলেও জমা হয়ে যাবে। শুরু করার আগে অন্য অ্যাপ বন্ধ করো, নোটিফিকেশন বন্ধ রাখো।</li> : <li>খাতার ছবি তুলতে ক্যামেরা খোলা যাবে; অন্য অ্যাপে যাওয়া শুধু রেকর্ড হয়, শিক্ষক দেখেন।</li>}
              <li>পরীক্ষা চলার সময় সাইট একটাই ট্যাবে খোলা থাকবে, অন্য ট্যাবে সাইট খুললে সেটা বন্ধ থাকবে।</li>
              <li>অ্যাকাউন্টে অন্য ডিভাইসে লগইন করলে এখানকার পরীক্ষা জমা হয়ে যাবে।</li>
              <li>সময় শেষ হলে নিজে থেকে জমা হবে।</li>
            </ul>
          </div>
        </Intro>
      </>
    );
  }

  // ================= পরীক্ষা চলছে =================
  else if (v === "run" && run && e) {
    const qs = new Map(mcqs(e).map((q) => [q.id, q]));
    const wq = writtenQs(e), mixed = wq.length > 0;
    const answered = (id: string) => run.answers[id] != null;
    const nAns = run.order.filter(answered).length;
    const left = run.deadline - now;
    const pending = run.order.filter((id) => run.answers[id] !== run.ack[id]).length;
    const status = run.status === "offline" || !online ? "offline" : run.status;
    const S = { saved: [TONE.green, "cloud_done", run.lastSaved ? "সেভ হয়েছে · " + clockSec(run.lastSaved) : "সব উত্তর সার্ভারে আছে"], saving: [TONE.blue, "cloud_sync", "সেভ হচ্ছে…"], offline: [TONE.amber, "cloud_off", `নেট নেই · ${bn(pending)}টি উত্তর ফোনে`] }[status];
    const pickTotal = Object.values(e.pick).reduce((t, v) => t + v, 0);
    const count = (sec: string) => wq.filter((q) => q.section === sec && run.picked[q.id]).length;
    const q = qs.get(run.order[run.cur]) as Mcq, sel = run.answers[q.id], opts = run.opt[q.id];
    body = (
      <>
        <div className={`sticky top-[72px] z-30 mt-2 mb-2 md:top-[84px] md:mt-4 md:mb-4 ${CARD} flex flex-wrap items-center gap-3 rounded-2xl! px-4 py-3`}>
          <div className="min-w-0 grow"><div className="truncate font-bold text-on-background dark:text-background">{e.title}</div>
            <div className={`text-xs ${MUTED}`}>উত্তর {bn(nAns)}/{bn(run.order.length)}{mixed ? ` · লিখিত বাছাই ${bn(Object.values(run.picked).filter(Boolean).length)}/${bn(pickTotal)}` : ""}{run.tabs ? ` · ট্যাব বদল ${bn(run.tabs)} বার (রেকর্ড হয়েছে)` : ""}</div></div>
          <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold ${S[0]}`}><span className="icon text-[16px]">{S[1]}</span><span>{S[2]}</span></span>
          <div className={`flex items-center gap-1.5 rounded-full border border-transparent bg-primary/10 px-4 py-1.5 font-bold text-primary transition-colors dark:bg-primary-fixed/10 dark:text-primary-fixed ${left <= 60e3 ? "timer-danger" : left <= 5 * 60e3 ? "timer-warn" : ""}`} title="সময় গোনে সার্ভার">
            <span className="icon text-[20px]">timer</span><span className="text-xl tabular-nums">{mmss(left)}</span></div>
          <button type="button" className={BTN_PRI} onClick={confirmSubmit}><span className="icon text-[18px]">send</span>জমা দিন</button>
        </div>
        {status === "offline" && <div className={`mb-2 rounded-2xl border p-4 text-sm md:mb-4 ${TONE.amber}`}><b className="flex items-center gap-1"><span className="icon text-[18px]">cloud_off</span>নেট নেই, পরীক্ষা চলছে</b>
          <p className="mt-1">টাইমার থামেনি। তোমার <b>{bn(pending)}</b>টি উত্তর ফোনে জমা আছে, নেট এলেই নিজে থেকে সার্ভারে যাবে। সময় শেষের আগে নেট না এলে শেষ যে উত্তর সার্ভারে পৌঁছেছিল সেটাই গণ্য হবে।</p></div>}
        {mixed && <div className="mb-2 flex gap-2 md:mb-4">{([["mcq", `MCQ অংশ (${bn(run.order.length)})`], ["written", `লিখিত অংশ (${Object.values(e.pick).map((v) => `যেকোনো ${bn(v)}টি`).join(", ")})`]] as const).map(([k, t]) => (
          <button key={k} type="button" className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${run.part === k ? "border-primary bg-primary text-on-primary" : `border-outline-variant/40 ${MUTED} hover:border-primary`}`} onClick={() => { patchRun((x) => ({ ...x, part: k })); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{t}</button>
        ))}</div>}
        {run.part === "mcq" ? (
          <div className="grid grid-cols-1 items-start gap-3 md:gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className={`${CARD} p-4 md:p-8`}>
              <div className={`mb-4 flex items-center justify-between text-xs ${MUTED}`}><span>প্রশ্ন {bn(run.cur + 1)} / {bn(run.order.length)} · {bn(q.marks)} নম্বর</span>{run.marks[q.id] && <Badge tone="amber" icon="bookmark">পরে দেখব</Badge>}</div>
              <Tex src={q.body} className="mb-6 text-lg leading-relaxed font-bold text-on-background md:text-xl dark:text-background" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {q.image && <img className="ex-qimg" src={q.image} alt="প্রশ্নের চিত্র" onClick={() => zoom(q.image!, "ছবি")} />}
              <div className="grid gap-3">{opts.map((orig, k) => (
                <button key={k} type="button" data-opt={k} className={`ex-opt ${sel === k ? "is-on" : ""}`} disabled={run.ended || run.timeUp} onClick={() => pick(k)}>
                  <span className="ex-k">{LETTERS[k]}</span><Tex as="span" src={q.options[orig]} className="min-w-0 text-left" /></button>
              ))}</div>
              <div className="mt-6 flex flex-wrap gap-2">
                <button type="button" className={BTN_GHOST} disabled={!run.cur} onClick={() => nav(-1)}><span className="icon text-[18px]">arrow_back</span>আগের</button>
                <button type="button" className={`${BTN_GHOST} ${run.marks[q.id] ? "border-amber-500! text-amber-600!" : ""}`} onClick={mark}><span className="icon text-[18px]">bookmark</span>পরে দেখব</button>
                {answered(q.id) && <button type="button" className={BTN_GHOST} onClick={() => pick(null)}><span className="icon text-[18px]">backspace</span>উত্তর মুছুন</button>}
                {run.cur < run.order.length - 1
                  ? <button type="button" className={`${BTN_PRI} ml-auto`} onClick={() => nav(1)}>পরের<span className="icon text-[18px]">arrow_forward</span></button>
                  : <button type="button" className={`${BTN_PRI} ml-auto`} onClick={() => (mixed ? patchRun((x) => ({ ...x, part: "written" })) : confirmSubmit())}>{mixed ? "লিখিত অংশে যাও" : "জমা দিন"}<span className="icon text-[18px]">{mixed ? "arrow_forward" : "send"}</span></button>}
              </div>
              <p className={`mt-4 text-[11px] ${MUTED}`}>কীবোর্ড: ১-৪ বা 1-4 দিয়ে উত্তর, ← → দিয়ে প্রশ্ন বদল, M দিয়ে পরে দেখব</p>
            </div>
            <div className={`${CARD} p-4 md:p-5 lg:sticky lg:top-[170px]`}>
              <div className="mb-3 font-bold text-on-background dark:text-background">প্রশ্ন তালিকা</div>
              <div className="grid grid-cols-5 gap-2">{run.order.map((id, i) => (
                <button key={id} type="button" className={`ex-cell ${run.marks[id] ? "is-mark" : answered(id) ? "is-done" : ""} ${i === run.cur ? "is-cur" : ""} ${run.answers[id] !== run.ack[id] ? "is-pending" : ""}`}
                  title={run.answers[id] !== run.ack[id] ? "সার্ভারে যাওয়ার অপেক্ষায়" : ""} onClick={() => patchRun((x) => ({ ...x, cur: i }))}>{bn(i + 1)}</button>
              ))}</div>
              <div className={`mt-4 grid gap-1.5 text-xs ${MUTED}`}>
                <span className="flex items-center gap-2"><i className="h-3 w-3 rounded bg-emerald-500" />উত্তর দেওয়া ({bn(nAns)})</span>
                <span className="flex items-center gap-2"><i className="h-3 w-3 rounded bg-amber-500" />পরে দেখব ({bn(Object.values(run.marks).filter(Boolean).length)})</span>
                <span className="flex items-center gap-2"><i className="h-3 w-3 rounded border-2 border-dashed border-blue-500" />সার্ভারে যাওয়ার অপেক্ষায়</span>
              </div>
              <button type="button" className={`${BTN_GHOST} mt-4 w-full py-2!`} onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}><span className="icon text-[18px]">fullscreen</span>পুরো পর্দায়</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 md:space-y-4">
            <div className={`rounded-2xl border p-4 text-sm ${TONE.blue}`}>{Object.entries(e.pick).map(([k, v]) => <span key={k}>{k} থেকে যেকোনো <b>{bn(v)}টি</b> বাছাই করো (বাছাই করেছ {bn(count(k))}টি)। </span>)}খাতায় লিখে প্রতিটি বাছাই করা প্রশ্নের নিচে ছবি দাও। ছবি দিলে খাতার চার কোণা নিজে থেকে ধরে ছবি সোজা আর স্পষ্ট হবে। খাতাটা পুরো ফ্রেমে, আলোতে আর ডেস্কের চেয়ে আলাদা রঙের জায়গায় রেখে তোলো। জমার পরও ১৫ মিনিট ছবি দেওয়া যাবে।</div>
            {wq.map((wqq, i) => {
              const on = !!run.picked[wqq.id], full = !on && count(wqq.section) >= (e.pick[wqq.section] ?? 0);
              return <WrittenCard key={wqq.id} q={wqq} index={i} on={on} full={full} locked={run.ended} finished={false} pages={run.pages[wqq.id] ?? []}
                onToggle={(v) => {
                  if (!v && (run.pages[wqq.id] ?? []).length && !confirm("এই প্রশ্নের পাতাগুলোও বাদ যাবে। বাদ দেবে?")) return;
                  patchRun((x) => ({ ...x, picked: { ...x.picked, [wqq.id]: v }, pages: v ? x.pages : { ...x.pages, [wqq.id]: [] } }));
                }}
                onFiles={(f) => addFiles(wqq.id, f, "run")} onZoom={(src) => zoom(src)}
                onDelete={(pid) => patchRun((x) => ({ ...x, pages: { ...x.pages, [wqq.id]: (x.pages[wqq.id] ?? []).filter((p) => p.id !== pid) } }))}
                onMove={(from, to) => patchRun((x) => { const l = [...(x.pages[wqq.id] ?? [])]; const i1 = l.findIndex((p) => p.id === from), j = l.findIndex((p) => p.id === to); const [it] = l.splice(i1, 1); l.splice(j, 0, it); return { ...x, pages: { ...x.pages, [wqq.id]: l } }; })} />;
            })}
            {run.processing && <p className="flex items-center gap-2 text-sm font-bold text-primary dark:text-primary-fixed"><span className="icon animate-spin">progress_activity</span>{run.processing}</p>}
            <div className="flex justify-between gap-3"><button type="button" className={BTN_GHOST} onClick={() => patchRun((x) => ({ ...x, part: "mcq" }))}><span className="icon text-[18px]">arrow_back</span>MCQ অংশ</button>
              <button type="button" className={BTN_PRI} onClick={confirmSubmit}><span className="icon text-[18px]">send</span>জমা দিন</button></div>
          </div>
        )}
      </>
    );
  }

  // ================= ফল =================
  else if (v === "result" && e) {
    const a = store.attempts[e.id], w = store.windows[e.id], closed = now >= w.closes;
    const r = result(e, a, closed, me), pct = r.total ? Math.round((1000 * r.score) / r.total) / 10 : 0;
    const sol = r.solutions, stOf = (s: (typeof sol)[number]) => (s.cancelled ? "c" : s.mine === null ? "s" : s.mine === s.key ? "r" : "w");
    const shown = sol.filter((s) => view.filter === "all" || stOf(s) === view.filter);
    const corr = closed ? CORRECTIONS[e.id] ?? [] : [];
    const upOpen = e.kind !== "mcq" && !!a.uploadUntil && now < a.uploadUntil;
    const tile = (v: string, l: string) => <div className="rounded-2xl border border-white/20 bg-surface-container-lowest/10 p-4 text-center"><b className="block text-2xl">{v}</b><span className="text-xs opacity-90">{l}</span></div>;
    const why = a.endReason && a.endReason !== "submit" ? WHY[a.endReason] : undefined;
    const wqs = writtenQs(e).filter((q) => a.picked.includes(q.id));
    body = (
      <>
        <BackBtn />
        <div className="reveal mb-3 rounded-3xl bg-linear-to-br from-primary to-on-primary-fixed-variant p-6 text-on-primary shadow-lg md:mb-6 md:p-8">
          <div className="text-sm opacity-90">{e.title} · {a.status === "expired" ? "সময় শেষে নিজে জমা হয়েছে" : "জমা " + when(a.submitted ?? a.deadline, now)}</div>
          <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2"><div className="text-5xl font-bold">{num(r.score)} <span className="text-2xl opacity-80">/ {num(r.total)}</span></div><div className="pb-1 text-lg opacity-90">{e.kind === "mixed" ? "MCQ অংশ · " : ""}{bn(pct)}%</div>
            {closed && e.kind === "mcq" && <div className="pb-1 text-lg font-bold">মেধাক্রম {bn(r.rank)} / {bn(r.attendees)}</div>}</div>
          <div className="mt-5 grid max-w-lg grid-cols-3 gap-3">{tile(bn(r.correct), "সঠিক")}{tile(bn(r.wrong), "ভুল")}{tile(bn(r.skipped), "উত্তর দাওনি")}</div>
          {r.wrong > 0 && e.neg > 0 && <p className="mt-3 text-xs opacity-90">প্রতি ভুলে −{num(e.neg)} কাটা হয়েছে</p>}
          {closed && <><button type="button" className={`${BTN} mt-5 border border-white/30 bg-white/15 hover:bg-white/25`} onClick={() => { setPrac(null); go("practice", e.id); }}><span className="icon text-[18px]">replay</span>আবার অনুশীলন করো</button><span className="ml-3 text-xs opacity-80">মেধাক্রম বদলায় না</span></>}
        </div>
        {why && <div className={`reveal mb-3 rounded-2xl border p-4 text-sm md:mb-6 md:p-5 ${["time_up", "expired"].includes(a.endReason!) ? TONE.blue : TONE.amber}`}>
          <b className="flex items-center gap-1.5"><span className="icon text-[18px]">{why[0]}</span>{why[1]}</b>
          {!["time_up", "expired"].includes(a.endReason!) && <p className="mt-1">তখন পর্যন্ত দেওয়া উত্তরগুলো দিয়ে নম্বর হয়েছে। নিয়ম অনুযায়ী আবার দেওয়া যাবে না; পরীক্ষার সময় শেষে চাইলে অনুশীলন করতে পারবে, মেধাক্রম বদলাবে না।</p>}</div>}
        {!closed && <div className={`reveal ${CARD} mb-3 p-4 md:mb-6 md:p-6`}><h3 className="flex items-center gap-2 text-lg font-bold text-on-background dark:text-background"><span className="icon text-primary dark:text-primary-fixed">lock_clock</span>সমাধান আর মেধাক্রম পরীক্ষা শেষে</h3>
          <p className={`mt-2 text-sm ${MUTED}`}>কোন প্রশ্ন ভুল হয়েছে, সঠিক উত্তর, ব্যাখ্যা আর মেধাক্রম দেখা যাবে <b>{when(w.closes, now)}</b> এর পর (আর {span(w.closes - now)}), যখন সবার পরীক্ষা শেষ হবে। এতে যারা এখনো দিচ্ছে তাদের কাছে উত্তর যায় না।</p>
          <button type="button" className={`${BTN_GHOST} mt-4`} onClick={() => { const s = store; s.windows[e.id] = { ...s.windows[e.id], closes: new Date().getTime() - 1000 }; save(s); toast("নমুনা: পরীক্ষার সময় শেষ, এখন সমাধান আর মেধাক্রম দেখা যাচ্ছে", "info"); }}><span className="icon text-[18px]">fast_forward</span>নমুনা: এখনই পরীক্ষার সময় শেষ করুন</button></div>}
        {e.kind !== "mcq" && (
          <div className={`reveal ${CARD} mb-3 p-4 md:mb-6 md:p-6`}><h3 className="flex items-center gap-2 text-lg font-bold text-on-background dark:text-background"><span className="icon text-primary dark:text-primary-fixed">draw</span>লিখিত অংশ: খাতা জমা হয়েছে</h3>
            <p className={`mt-2 text-sm ${MUTED}`}>{bn(wqs.length)}টি প্রশ্ন, {bn(wqs.reduce((t, q) => t + (a.pages[q.id] ?? []).length, 0))}টি পাতা। পরীক্ষার সময় শেষে মূল্যায়নকারী তোমার নাম না দেখে, শুধু খাতার কোড দেখে প্রশ্নভিত্তিক কাটবেন; কিছু খাতা আরেকজন আবার যাচাই করবেন। সব শেষে ফল প্রকাশ হবে, তখন লাল দাগসহ খাতা দেখবে।</p>
            {upOpen && <>
              <p className={`mt-3 rounded-xl border p-3 text-xs ${TONE.blue}`}>আরও পাতা দিতে পারবে {clock(a.uploadUntil!)} পর্যন্ত (আর {span(a.uploadUntil! - now)})।</p>
              <div className="mt-4 space-y-4">{wqs.map((wqq, i) => (
                <WrittenCard key={wqq.id} q={wqq} index={i} on full={false} locked={false} finished pages={a.pages[wqq.id] ?? []} onToggle={() => {}} onZoom={(src) => zoom(src)}
                  onFiles={(f) => addFiles(wqq.id, f, "attempt")}
                  onDelete={(pid) => { const s = store; s.attempts[e.id].pages[wqq.id] = (a.pages[wqq.id] ?? []).filter((p) => p.id !== pid); save(s); }}
                  onMove={(from, to) => { const s = store, l = [...(a.pages[wqq.id] ?? [])]; const i1 = l.findIndex((p) => p.id === from), j = l.findIndex((p) => p.id === to); const [it] = l.splice(i1, 1); l.splice(j, 0, it); s.attempts[e.id].pages[wqq.id] = l; save(s); }} />
              ))}</div>
            </>}
          </div>
        )}
        {corr.length > 0 && <div className={`reveal mb-3 rounded-3xl border p-5 md:mb-6 ${TONE.amber}`}><b className="flex items-center gap-2"><span className="icon">rule</span>পরীক্ষার পর সংশোধন, তোমার নম্বর আবার হিসাব হয়েছে</b>
          <ul className="mt-2 space-y-1 text-sm">{corr.map((c) => { const s = sol.find((x) => x.q.id === c.qid); return <li key={c.qid}>প্রশ্ন {bn(s ? s.no : "?")}: {c.action === "key" ? `সঠিক উত্তর (${LETTERS[c.from!]}) থেকে (${LETTERS[c.to!]})` : c.action === "award" ? "বাতিল, সবাই পূর্ণ নম্বর" : "বাতিল, মোট থেকে বাদ"} · {c.reason} <span className="opacity-75">({c.by})</span></li>; })}</ul></div>}
        {closed && (
          <div className="grid grid-cols-1 items-start gap-3 md:gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <div className="mb-4 flex flex-wrap gap-2">{([["all", "সব", sol.length], ["w", "ভুল", sol.filter((s) => stOf(s) === "w").length], ["s", "উত্তর দাওনি", sol.filter((s) => stOf(s) === "s").length], ["r", "সঠিক", sol.filter((s) => stOf(s) === "r").length]] as const).map(([k, t, n]) => (
                <button key={k} type="button" className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${view.filter === k ? "border-primary bg-primary text-on-primary" : `border-outline-variant/40 ${MUTED}`}`} onClick={() => setView((v) => ({ ...v, filter: k }))}>{t} {bn(n)}</button>
              ))}</div>
              <div className="space-y-3 md:space-y-4">{shown.length ? shown.map((s) => {
                const t = stOf(s);
                return (
                  <div key={s.q.id} className={`${CARD} rounded-2xl! p-4 md:p-5`}>
                    <div className={`mb-3 flex items-center justify-between text-xs ${MUTED}`}><span>প্রশ্ন {bn(s.no)} · {s.q.chapter}</span>
                      {{ r: <Badge tone="green" icon="check">সঠিক</Badge>, w: <Badge tone="red" icon="close">ভুল</Badge>, s: <Badge tone="amber">উত্তর দাওনি</Badge>, c: <Badge tone="gray">{s.cancelled === "award" ? "বাতিল: সবাই নম্বর পেয়েছে" : "বাতিল"}</Badge> }[t]}</div>
                    <Tex src={s.q.body} className="mb-4 leading-relaxed font-bold text-on-background dark:text-background" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {s.q.image && <img className="ex-qimg" src={s.q.image} alt="প্রশ্নের চিত্র" onClick={() => zoom(s.q.image!, "ছবি")} />}
                    <div className="grid gap-2">{s.q.options.map((o, k) => (
                      <div key={k} className={`ex-ro ${k === s.key ? "is-right" : k === s.mine ? "is-wrong" : ""}`}>
                        <span className="ex-k">{LETTERS[k]}</span><Tex as="span" src={o} className="min-w-0 grow" />
                        <span className={`text-xs whitespace-nowrap ${MUTED}`}>{bn(s.pct[k])}%</span>{k === s.key ? <span className="icon text-emerald-600">check</span> : k === s.mine ? <span className="text-xs font-bold text-error">তোমার উত্তর</span> : null}
                        <i className="ex-bar" style={{ width: `${s.pct[k]}%` }} />
                      </div>
                    ))}</div>
                    <p className={`mt-2 text-xs ${MUTED}`}>ক্লাসের {bn(s.skip)}% উত্তর দেয়নি</p>
                    {s.q.exp && <div className="mt-3 rounded-xl border-l-4 border-primary bg-primary/5 p-3 text-sm dark:bg-primary-fixed/5"><b>ব্যাখ্যা:</b> <Tex as="span" src={s.q.exp} /></div>}
                  </div>
                );
              }) : <div className={`${CARD} p-8 text-center ${MUTED}`}>এই তালিকায় কিছু নেই</div>}</div>
            </div>
            <div className="space-y-3 md:space-y-6">{e.kind === "mcq" ? (
              <div className={`${CARD} p-4 md:p-6`}><h3 className="text-lg font-bold text-on-background dark:text-background">মেধাতালিকা</h3>
                <p className={`mt-1 mb-4 text-xs ${MUTED}`}>{bn(r.attendees)} জন · সমান নম্বরে যে কম সময়ে জমা দিয়েছে সে আগে</p>
                <div className="space-y-1.5">{r.top.map((x) => (
                  <div key={x.name + x.rank} className={`flex items-center gap-3 rounded-xl p-2.5 ${x.me ? "bg-primary/10 font-bold dark:bg-primary-fixed/10" : ""}`}>
                    <span className={`w-7 text-center font-bold ${x.rank <= 3 ? "text-amber-500" : MUTED}`}>{bn(x.rank)}</span><span className="grow truncate">{x.name}</span>
                    <span className={`text-xs ${MUTED}`}>{mmss(x.secs * 1000)}</span><b>{num(x.score)}</b></div>
                ))}
                {r.rank > 10 && <div className="flex items-center gap-3 rounded-xl bg-primary/10 p-2.5 font-bold dark:bg-primary-fixed/10"><span className="w-7 text-center">{bn(r.rank)}</span><span className="grow">{me} (তুমি)</span><b>{num(r.score)}</b></div>}</div></div>
            ) : <div className={`${CARD} p-6 text-sm ${MUTED}`}>মোট নম্বর আর মেধাক্রম লিখিত অংশের ফল প্রকাশের পর।</div>}</div>
          </div>
        )}
      </>
    );
  }

  // ================= অনুশীলন =================
  else if (v === "practice" && e) {
    // অনুশীলনের প্রশ্নপত্র একবার এলোমেলো করে রাখা (প্রতি আঁকায় নতুন নয়)
    if (!prac || prac.examId !== e.id) { setTimeout(() => setPrac((x) => (x && x.examId === e.id ? x : { examId: e.id, qs: practicePaper(e), ans: {}, started: new Date().getTime(), done: null })), 0); return <div className={`${CARD} mt-6 h-72 animate-pulse`} />; }
    const p = prac;
    const a = store.attempts[e.id], first = a && a.status !== "in_progress" ? { ...grade(e, a.answers), ...(e.kind === "mcq" ? result(e, a, true, me) : {}) } : null;
    const runs = store.practice[e.id] ?? [], d = p.done, n = Object.keys(p.ans).length;
    body = (
      <>
        <BackBtn />
        <div className={`reveal ${CARD} mb-3 max-w-3xl p-6 md:mb-6 md:p-8`}>
          <div className="mb-3 flex flex-wrap gap-2"><Badge tone="blue" icon="replay">অনুশীলন</Badge><Badge tone="gray">{e.courseName}</Badge></div>
          <h1 className="text-2xl font-bold text-on-background md:text-3xl dark:text-background">{e.title}</h1>
          <p className={`mt-2 text-sm ${MUTED}`}>এটা অনুশীলন: সময়ের চাপ নেই, পাতা ছাড়লেও কিছু হয় না, প্রশ্ন আর অপশন নতুন ক্রমে। ফল আর মেধাক্রমে {first ? "তোমার প্রথমবারের নম্বরই থাকবে" : "এটা গোনা হবে না, কারণ পরীক্ষার সময় দাওনি"}।</p>
          {first && <p className="mt-3 text-sm"><b>প্রথমবার:</b> {num(first.score)}/{num(first.total)}{e.kind === "mcq" && "rank" in first && first.rank ? ` · মেধাক্রম ${bn(first.rank)}/${bn(first.attendees ?? 0)}` : ""}</p>}
          {runs.length > 0 && <p className={`mt-2 text-xs ${MUTED}`}>আগের অনুশীলন: {runs.slice(-5).map((x, i) => `${bn(runs.length - Math.min(5, runs.length) + i + 1)}. ${num(x.score)}/${num(x.total)}`).join(" · ")}</p>}
          {d && <>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">{([[num(d.score) + "/" + num(d.total), "এবার", "green"], [bn(d.correct), "সঠিক", "green"], [bn(d.wrong), "ভুল", d.wrong ? "red" : "gray"], [bn(d.skipped), "উত্তর দাওনি", d.skipped ? "amber" : "gray"]] as const).map(([v, l, t]) => <div key={l} className={`rounded-xl border p-3 text-center ${TONE[t]}`}><b className="block text-xl">{v}</b><span className="text-xs">{l}</span></div>)}</div>
            <p className={`mt-2 text-xs ${MUTED}`}>সময় লেগেছে {mmss(d.secs * 1000)}{first ? ` · প্রথমবারের চেয়ে ${d.score > first.score ? bn(+(d.score - first.score).toFixed(2)) + " বেশি" : d.score < first.score ? bn(+(first.score - d.score).toFixed(2)) + " কম" : "সমান"}` : ""}</p>
          </>}
        </div>
        <div className="max-w-3xl space-y-3 md:space-y-4">{p.qs.map((q, i) => {
          const mine = p.ans[q.id];
          return (
            <div key={q.id} className={`${CARD} rounded-2xl! p-4 md:p-5`}>
              <div className={`mb-3 flex items-center justify-between text-xs ${MUTED}`}><span>প্রশ্ন {bn(i + 1)} · {q.chapter}</span>{d && (q.award ? <Badge tone="gray">বাতিল: সবাই নম্বর পায়</Badge> : mine === undefined ? <Badge tone="amber">উত্তর দাওনি</Badge> : mine === q.key ? <Badge tone="green" icon="check">সঠিক</Badge> : <Badge tone="red" icon="close">ভুল</Badge>)}</div>
              <Tex src={q.body} className="mb-4 leading-relaxed font-bold text-on-background dark:text-background" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {q.image && <img className="ex-qimg" src={q.image} alt="প্রশ্নের চিত্র" onClick={() => zoom(q.image!, "ছবি")} />}
              <div className="grid gap-2">{q.options.map((o, k) => d
                ? <div key={k} className={`ex-ro ${k === q.key ? "is-right" : k === mine ? "is-wrong" : ""}`}><span className="ex-k">{LETTERS[k]}</span><Tex as="span" src={o} className="min-w-0 grow" />{k === q.key ? <span className="icon text-emerald-600">check</span> : k === mine ? <span className="text-xs font-bold text-error">তোমার উত্তর</span> : null}</div>
                : <button key={k} type="button" className={`ex-opt ${mine === k ? "is-on" : ""}`} onClick={() => setPrac((x) => { if (!x || x.done) return x; const ans = { ...x.ans }; if (ans[q.id] === k) delete ans[q.id]; else ans[q.id] = k; return { ...x, ans }; })}><span className="ex-k">{LETTERS[k]}</span><Tex as="span" src={o} className="min-w-0 text-left" /></button>)}</div>
              {d && q.exp && <div className="mt-3 rounded-xl border-l-4 border-primary bg-primary/5 p-3 text-sm dark:bg-primary-fixed/5"><b>ব্যাখ্যা:</b> <Tex as="span" src={q.exp} /></div>}
            </div>
          );
        })}</div>
        <div className={`sticky bottom-4 mt-3 max-w-3xl md:mt-6 ${CARD} flex flex-wrap items-center gap-3 rounded-2xl! p-3`}>
          {d ? <>
            <button type="button" className={BTN_PRI} onClick={() => { setPrac(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}><span className="icon text-[18px]">replay</span>আবার নতুন করে</button>
            {first && <button type="button" className={BTN_GHOST} onClick={() => go("result", e.id)}>ফল ও মেধাক্রম</button>}
          </> : <>
            <span className={`px-2 text-sm ${MUTED}`}>উত্তর {bn(n)}/{bn(p.qs.length)}</span>
            <button type="button" className={`${BTN_PRI} ml-auto`} onClick={() => {
              let score = 0, correct = 0, wrong = 0, skipped = 0, total = 0;
              p.qs.forEach((q) => { total += q.marks; const m = p.ans[q.id]; if (q.award) { score += q.marks; correct++; } else if (m === undefined) skipped++; else if (m === q.key) { score += q.marks; correct++; } else { score -= e.neg; wrong++; } });
              const done = { score: Math.round(score * 100) / 100, correct, wrong, skipped, total, secs: Math.round((new Date().getTime() - p.started) / 1000) };
              setPrac({ ...p, done });
              const s = store; s.practice[e.id] = [...(s.practice[e.id] ?? []), { score: done.score, total }].slice(-20); save(s);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}><span className="icon text-[18px]">fact_check</span>শেষ করে মিলিয়ে দেখুন</button>
          </>}
        </div>
      </>
    );
  }

  // ================= কাটা খাতা =================
  else if (v === "written") {
    const s = SCRIPTS.find((x) => x.id === view.id && x.publishedAgo !== null);
    if (!s) { setTimeout(() => go("list"), 0); return <div className={`${CARD} mt-6 h-72 animate-pulse`} />; }
    const pub = now - s.publishedAgo!, closesAt = pub + RECHECK_DAYS * 864e5, open = now < closesAt;
    const total = s.questions.reduce((t, q) => t + (q.got ?? 0), 0), fullM = s.questions.reduce((t, q) => t + q.marks, 0);
    const mine = store.rechecks.filter((r) => r.sid === s.id);
    body = (
      <>
        <BackBtn />
        <div className="reveal mb-3 rounded-3xl bg-linear-to-br from-primary to-on-primary-fixed-variant p-6 text-on-primary shadow-lg md:mb-6 md:p-8">
          <div className="text-sm opacity-90">{s.title} · খাতা #{s.code} · ফল প্রকাশ {when(pub, now)}</div>
          <div className="mt-2 text-5xl font-bold">{num(total)} <span className="text-2xl opacity-80">/ {bn(fullM)}</span></div>
          <p className="mt-3 text-sm opacity-90">{open ? `কোনো প্রশ্নের নম্বর নিয়ে প্রশ্ন থাকলে ${when(closesAt, now)} পর্যন্ত (আর ${span(closesAt - now)}) পুনর্মূল্যায়নের আবেদন করতে পারো, এক পরীক্ষায় সর্বোচ্চ ${bn(RECHECK_MAX)}টি প্রশ্নে।` : "পুনর্মূল্যায়নের আবেদনের সময় শেষ।"}</p>
        </div>
        <div className="space-y-3 md:space-y-6">{s.questions.map((q) => {
          const rc = mine.find((r) => r.qid === q.id);
          return (
            <div key={q.id} className={`reveal ${CARD} p-4 md:p-6`}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><b className="text-lg text-on-background dark:text-background">{q.label}</b><p className={`mt-1 text-sm whitespace-pre-line ${MUTED}`}>{q.body}</p></div>
                <div className="shrink-0 text-3xl font-bold text-primary dark:text-primary-fixed">{num(q.got ?? 0)}<span className={`text-base ${MUTED}`}>/{bn(q.marks)}</span></div></div>
              <div className="grid grid-cols-1 items-start gap-3 md:gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <Khata code={s.code} label={q.label} lines={q.lines} ann={q.ann} />
                <div className="space-y-3">
                  {q.note && <div className={`rounded-xl border p-3 text-sm ${TONE.red}`}><b>মূল্যায়নকারীর মন্তব্য:</b> {q.note}</div>}
                  <details className="rounded-xl bg-surface-container-low p-3 dark:bg-white/5"><summary className="cursor-pointer text-sm font-bold">সমাধান আর নম্বর বিভাজন</summary><p className={`mt-2 text-sm whitespace-pre-line ${MUTED}`}>{q.solution}</p><p className={`mt-2 text-xs whitespace-pre-line ${MUTED}`}>{q.scheme}</p></details>
                  {rc ? <div className={`rounded-xl border p-3 text-sm ${TONE.amber}`}><b className="flex items-center gap-1"><span className="icon text-[16px]">hourglass_top</span>পুনর্মূল্যায়ন: শিক্ষক দেখছেন</b><div className="mt-1 text-xs">তোমার কারণ: {rc.reason}</div></div>
                    : open && mine.length < RECHECK_MAX ? <RecheckForm qid={q.id} onSend={(reason) => {
                      if (reason.trim().length < 10) { toast("কারণটা একটু বিস্তারিত লেখো (অন্তত ১০ অক্ষর)", "error"); return false; }
                      const st = store; st.rechecks.push({ sid: s.id, qid: q.id, reason: reason.trim() }); save(st); toast("আবেদন জমা হয়েছে, শিক্ষক দেখে জানাবেন"); return true;
                    }} /> : null}
                </div>
              </div>
            </div>
          );
        })}</div>
      </>
    );
  }

  return (
    <div className="ex-root">
      {body}
      <ExModal spec={modal} close={modal?.onClose ? closeAny : closeModal} />
      {toastNode}
    </div>
  );
}

// শুরুর আগের কার্ড: নিয়ম পড়েছি টিক না দিলে শুরু বোতাম বন্ধ
function Intro({ children, onStart }: { children: ReactNode; onStart: () => void }) {
  const [agree, setAgree] = useState(false);
  return (
    <div className={`reveal ${CARD} max-w-3xl p-6 md:p-10`}>
      {children}
      <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm font-bold text-on-background select-none dark:text-background"><input id="ex-agree" type="checkbox" className="mt-0.5 h-5 w-5 accent-[#006c49]" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> নিয়মগুলো পড়েছি। নেট, চার্জ আর সময় ঠিক আছে কিনা দেখে নিয়েছি।</label>
      <div className="mt-5 flex flex-wrap gap-3"><button id="ex-start" type="button" className={`${BTN_PRI} px-8! py-3!`} disabled={!agree} onClick={onStart}><span className="icon">timer</span>পরীক্ষা শুরু করুন</button></div>
    </div>
  );
}

function RecheckForm({ qid, onSend }: { qid: string; onSend: (reason: string) => boolean }) {
  const [v, setV] = useState(""), [bad, setBad] = useState(false);
  return (
    <div className="rounded-xl border border-outline-variant/30 p-3">
      <label className={`mb-1.5 block text-xs font-bold ${MUTED}`} htmlFor={`rc-${qid}`}>পুনর্মূল্যায়নের আবেদন</label>
      <textarea id={`rc-${qid}`} rows={3} className={`ex-field ${bad ? "is-invalid" : ""}`} value={v} onChange={(e) => { setV(e.target.value); setBad(false); }} placeholder="কোন অংশে কেন নম্বর কম মনে হচ্ছে, সংক্ষেপে লেখো" />
      <button type="button" className={`${BTN_GHOST} mt-2 w-full`} onClick={() => { if (!onSend(v)) setBad(true); }}><span className="icon text-[18px]">send</span>আবেদন করো</button>
      <p className={`mt-2 text-[11px] ${MUTED}`}>যিনি কেটেছিলেন তিনি নন, অন্য শিক্ষক দেখবেন। নম্বর বাড়তেও পারে, একই থাকতেও পারে।</p>
    </div>
  );
}
