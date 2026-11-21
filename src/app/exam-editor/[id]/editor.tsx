"use client";
/* eslint-disable @next/next/no-img-element -- প্রশ্নের ছবি private Storage এর signed URL, next/image এর উপযোগী নয় */

import { useCallback, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, BTN_GHOST, BTN_PRI, CARD, ExModal, MUTED, TONE, Tex, useExToast, type ModalSpec } from "@/app/practice/ui";
import { deleteQuestion, moveQuestion, saveExam, setPublished } from "../actions";
import { KIND, STATE, useNow } from "../list";
import { L, bn, clock, fromInput, num, publishIssues, stateOf, stats, toInput, toNum, when, type Chapter, type Course, type ExamRow, type Kind, type QKind, type QRow } from "../lib";
import { BulkForm, QuestionForm, blankDraft, copyDraft, draftOf, type Saver } from "./question-form";

const SM = " px-3! py-1.5! text-xs!";
const FIELD: Record<string, string> = { title: "f-title", minutes: "f-min", closes: "f-closes", neg: "f-neg", kind: "f-kind", course: "f-course" };

type Props = { exam: ExamRow | null; questions: QRow[]; chapters: Chapter[]; courses: Course[]; locked: boolean; nowMs: number; admin: boolean };

export function Editor({ exam: e, questions, chapters, courses, locked, nowMs }: Props) {
  const router = useRouter();
  const now = useNow(nowMs);
  const [toast, toastNode] = useExToast();
  const [view, setView] = useState<"exam" | "preview">("exam");
  const [modal, setModal] = useState<ModalSpec | null>(null);
  const closeModal = useCallback(() => setModal(null), []);
  const saver: Saver = useRef(null);

  // ---------- তথ্য ও সময়ের ফর্ম ----------
  const [title, setTitle] = useState(e?.title ?? "");
  const [course, setCourse] = useState(e?.courseId ?? courses[0]?.id ?? 0);
  const [kind, setKind] = useState<Kind>(e?.kind ?? "mcq");
  const [minutes, setMinutes] = useState(String(e?.minutes ?? 30));
  const [neg, setNeg] = useState(String(e?.neg ?? 0.25));
  // নতুন পরীক্ষা: আগামীকাল রাত ৯টা থেকে ৪৫ মিনিট (বাংলাদেশের সময়ে, ঠিক ঘণ্টায়)
  const [opens, setOpens] = useState(() => toInput(e ? e.opens : Math.floor((nowMs + 6 * 3600e3) / 864e5 + 1) * 864e5 - 6 * 3600e3 + 21 * 3600e3));
  const [closes, setCloses] = useState(() => toInput(e ? e.closes : Math.floor((nowMs + 6 * 3600e3) / 864e5 + 1) * 864e5 - 6 * 3600e3 + 21 * 3600e3 + 45 * 60e3));
  const [shuffle, setShuffle] = useState(e?.shuffle !== false);
  const [hide, setHide] = useState(e?.submitOnHide !== false);
  const [mod, setMod] = useState(String(e?.moderation ?? 10));
  const [recheck, setRecheck] = useState(String(e?.recheckDays ?? 3));
  const [pick, setPick] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(e?.pick ?? {}).map(([k, v]) => [k, String(v)])));
  const [err, setErr] = useState<{ error: string; field?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const st = e ? stateOf(e, now) : "draft";
  const s = stats(questions, e?.pick ?? {});
  const sections = Object.keys(s.secs);
  const issues = e ? publishIssues(e, questions, now) : [];
  const dis = locked;
  const chapterName = (id: number | null) => chapters.find((c) => c.id === id)?.title;

  // সময়ের ব্যাখ্যা: কখন পর্যন্ত শুরু করলে পুরো সময় পাবে
  const o = fromInput(opens), c = fromInput(closes), m = toNum(minutes);
  let hint: ReactNode;
  if (!o || !c || !(m > 0)) hint = "শুরু আর শেষের সময় দিলে এখানে দেখাবে কে কতটুকু সময় পাবে।";
  else if (c <= o) hint = "শেষের সময় শুরুর পরে হতে হবে।";
  else {
    const last = c - m * 60e3;
    hint = last < o ? `শেষের সময় খুব আগে: শুরু থেকে শেষ মাত্র ${bn(Math.round((c - o) / 60e3))} মিনিট, কেউ পুরো ${bn(m)} মিনিট পাবে না।`
      : <>শিক্ষার্থী <b>{when(o, now)}</b> থেকে শুরু করতে পারবে। <b>{when(last, now)}</b> এর মধ্যে শুরু করলে পুরো {bn(m)} মিনিট পাবে; এর পরে শুরু করলে <b>{clock(c)}</b> এ শেষ হবে। {when(c, now)} এর পর কেউ শুরু করতে পারবে না, তখন সমাধান আর মেধাক্রম দেখা যাবে।</>;
  }
  const setEnd = (extra: number) => {
    if (!o || !(m > 0)) { toast("আগে শুরুর সময় আর মিনিট দিন", "error"); return; }
    setCloses(toInput(o + (m + extra) * 60e3));
  };

  async function save() {
    setErr(null);
    setSaving(true);
    const picks: Record<string, number> = {};
    Object.entries(pick).forEach(([k, val]) => { if (val.trim() !== "" && sections.includes(k)) picks[k] = toNum(val); });
    const r = await saveExam({ id: e?.id, title, course, kind, minutes: m, opens: o, closes: c, neg: toNum(neg || "0"), shuffle, submitOnHide: hide, moderation: toNum(mod), recheckDays: toNum(recheck), pick: picks });
    setSaving(false);
    if (!r.ok) {
      setErr(r);
      const id = r.field && FIELD[r.field];
      if (id) { const el = document.getElementById(id); el?.classList.add("is-invalid"); el?.focus(); }
      return;
    }
    toast(e ? "সংরক্ষিত" : "পরীক্ষা তৈরি হলো, এখন প্রশ্ন বসান");
    if (e) router.refresh(); else router.replace(`/exam-editor/${r.id}`);
  }
  const clearInvalid = () => document.querySelectorAll("#ed-settings .is-invalid").forEach((x) => x.classList.remove("is-invalid"));

  // ---------- প্রকাশ ----------
  const publish = (on: boolean) => {
    if (!e) return;
    setModal({
      icon: on ? "publish" : "unpublished", title: on ? "প্রকাশ করবেন?" : "প্রকাশ বন্ধ করবেন?",
      body: on ? <><p className="text-sm">&quot;{e.title}&quot; শিক্ষার্থীরা তালিকায় দেখবে। <b>{when(e.opens, now)}</b> এ খুলবে, <b>{when(e.closes, now)}</b> এ বন্ধ হবে।</p>
        <p className={`text-sm ${MUTED} mt-2`}>শুরু হয়ে গেলে প্রশ্নপত্র, সময় আর নিয়ম আর বদলানো যাবে না। তার আগে প্রকাশ বন্ধ করে বদলানো যায়।</p></>
        : <p className="text-sm">শিক্ষার্থীদের তালিকা থেকে সরে যাবে, আবার ড্রাফট হবে।</p>,
      actions: [{ label: "না", kind: "ghost" }, { label: on ? "প্রকাশ করুন" : "প্রকাশ বন্ধ", id: "ed-publish-yes", onClick: () => { void (async () => {
        const r = await setPublished(e.id, on);
        if (r.ok) { toast(on ? "প্রকাশ হয়েছে" : "ড্রাফট করা হলো"); router.refresh(); } else toast(r.error, "error");
      })(); } }],
    });
  };

  // ---------- প্রশ্ন ----------
  const afterSave = useCallback((again: QKind | null) => {
    setModal(null);
    router.refresh();
    if (again) setTimeout(() => openQ(blankDraft(again, ""), true), 260);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);
  function openQ(draft: ReturnType<typeof blankDraft>, fresh = false) {
    if (!e) return;
    const examId = e.id, examKind = e.kind;
    const secs = Object.keys(stats(questions, e.pick).secs);
    const init = fresh && draft.kind === "written" && !draft.id ? { ...draft, section: secs[0] || "সৃজনশীল" } : draft;
    setModal({
      icon: draft.kind === "mcq" ? "quiz" : "draw", title: (draft.id ? "প্রশ্ন সম্পাদনা" : "নতুন প্রশ্ন") + (draft.kind === "mcq" ? " (MCQ)" : " (লিখিত)"), wide: true,
      body: <QuestionForm examId={examId} examKind={examKind} init={init} chapters={chapters} sections={secs} saveRef={saver} onDone={afterSave} toast={toast} />,
      actions: [{ label: "বাতিল", kind: "ghost" }, ...(draft.id ? [] : [{ label: "সংরক্ষণ ও আরেকটা", kind: "ghost" as const, id: "q-save-next", onClick: () => { void saver.current?.(true); return false; } }]),
        { label: "সংরক্ষণ", id: "q-save", onClick: () => { void saver.current?.(false); return false; } }],
    });
  }
  const editQ = (q: QRow) => openQ(draftOf(q));
  const copyQ = async (q: QRow) => openQ(await copyDraft(q));
  const act = async (fn: () => Promise<{ ok?: boolean; error?: string }>, ok?: string) => { const r = await fn(); if (r.ok) { if (ok) toast(ok); router.refresh(); } else toast(r.error ?? "হয়নি", "error"); };
  const delQ = (q: QRow) => setModal({ icon: "delete", title: "প্রশ্নটা মুছবেন?", body: <p className="text-sm">এটা ফেরানো যাবে না।</p>,
    actions: [{ label: "না", kind: "ghost" }, { label: "মুছুন", kind: "danger", id: "ed-del-yes", onClick: () => { void act(() => deleteQuestion(e!.id, q.id), "প্রশ্ন মুছে ফেলা হলো"); } }] });
  const bulk = () => {
    if (!e) return;
    setModal({
      icon: "content_paste", title: "একসাথে অনেক MCQ", wide: true,
      body: <BulkForm examId={e.id} chapters={chapters} saveRef={saver} onDone={() => { setModal(null); router.refresh(); }} toast={toast} />,
      actions: [{ label: "বাতিল", kind: "ghost" }, { label: "যাচাই", kind: "ghost", id: "bulk-check", onClick: () => { void saver.current?.(false); return false; } }, { label: "যোগ করুন", id: "bulk-add", onClick: () => { void saver.current?.(true); return false; } }],
    });
  };

  // ---------- শিক্ষার্থীর মতো করে দেখা ----------
  if (view === "preview" && e) {
    const mq = questions.filter((q) => q.kind === "mcq"), wq = questions.filter((q) => q.kind === "written");
    return (
      <main className="mx-auto w-full max-w-[1440px] grow px-4 pt-2.5 pb-24 md:px-8 md:pt-5">
        <button type="button" className={`${BTN_GHOST} mt-3 mb-2.5 px-3! py-1.5! md:mt-6 md:mb-4`} onClick={() => { setView("exam"); window.scrollTo({ top: 0 }); }}><span className="icon text-[18px]">arrow_back</span>প্রশ্নপত্রে ফিরুন</button>
        <div className={`mb-2.5 rounded-2xl border p-3 text-sm md:mb-4 ${TONE.blue}`}>শিক্ষার্থী এভাবে দেখবে।{e.shuffle ? " প্রত্যেকে প্রশ্ন আর অপশন আলাদা ক্রমে পাবে (এখানে আপনার ক্রমে)।" : ""} সঠিক উত্তর আর ব্যাখ্যা শিক্ষার্থী পরীক্ষা শেষে দেখবে, এখানে দেখানো হচ্ছে না।</div>
        <div className={`${CARD} mb-2.5 flex flex-wrap items-center gap-3 rounded-2xl! px-5 py-4 md:mb-5`}>
          <div className="min-w-0 grow"><div className="font-bold text-on-background dark:text-background">{e.title}</div>
            <div className={`text-xs ${MUTED}`}>{e.courseName} · মোট {num(s.mcqMarks + s.wTotal)} নম্বর{e.neg && mq.length ? ` · প্রতি ভুলে −${num(e.neg)}` : ""} · {e.opens != null ? `${when(e.opens, now)} থেকে ${when(e.closes, now)}` : "সময় ঠিক হয়নি"}</div></div>
          <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-1.5 font-bold text-primary dark:bg-primary-fixed/10 dark:text-primary-fixed"><span className="icon text-[20px]">timer</span>{bn(e.minutes)}:০০</div>
        </div>
        <div className="max-w-3xl space-y-2 md:space-y-4" id="ed-preview-paper">
          {mq.map((q, i) => (
            <div key={q.id} className={`${CARD} p-5 md:p-6`}>
              <div className={`text-xs ${MUTED} mb-3`}>প্রশ্ন {bn(i + 1)} / {bn(mq.length)} · {num(q.marks)} নম্বর</div>
              <Tex className="ex-q mb-4 text-lg leading-relaxed font-bold text-on-background dark:text-background" src={q.body} />{q.image && <img className="ex-qimg" src={q.image.url} alt="" />}
              <div className="grid gap-3">{q.options.map((op, k) => <div key={k} className="ex-opt"><span className="ex-k">{L[k]}</span><span className="min-w-0 text-left"><Tex as="span" src={op} />{q.optionImages[k] && <img className="ex-oimg" src={q.optionImages[k]!.url} alt="" />}</span></div>)}</div>
            </div>
          ))}
          {wq.length > 0 && (
            <>
              <div className={`rounded-2xl border p-4 text-sm ${TONE.blue}`}>লিখিত অংশ: {Object.entries(s.secs).map(([sec, ms]) => `${sec} থেকে ${e.pick[sec] ? `যেকোনো ${bn(e.pick[sec])}টি` : `সবগুলো (${bn(ms.length)}টি)`}`).join(", ")}। খাতায় লিখে ছবি দেবে।</div>
              {wq.map((q) => (
                <div key={q.id} className={`${CARD} p-5 md:p-6`}>
                  <div className={`text-xs ${MUTED} mb-2`}>{q.section} · {num(q.marks)} নম্বর</div>
                  <Tex className="ex-q mb-2 leading-relaxed text-on-background dark:text-background" src={q.body} />{q.image && <img className="ex-qimg" src={q.image.url} alt="" />}
                </div>
              ))}
            </>
          )}
          {!questions.length && <div className={`${CARD} ${MUTED} p-8 text-center`}>এখনো প্রশ্ন নেই</div>}
        </div>
        {toastNode}
      </main>
    );
  }

  // ---------- প্রশ্নপত্র ----------
  const label = "ed-label";
  return (
    <main className="mx-auto w-full max-w-[1440px] grow px-4 pt-2.5 pb-24 md:px-8 md:pt-5">
      <Link href="/exam-editor" className={`${BTN_GHOST} mt-3 mb-2.5 px-3! py-1.5! md:mt-6 md:mb-4`}><span className="icon text-[18px]">arrow_back</span>সব পরীক্ষা</Link>
      <div className="reveal mb-2.5 flex flex-wrap items-center gap-3 md:mb-5">
        <h1 className="text-2xl font-bold text-on-background md:text-3xl dark:text-background">{e ? e.title : "নতুন পরীক্ষা"}</h1>
        {e && <Badge tone={STATE[st][1]} icon={STATE[st][2]}>{STATE[st][0]}</Badge>}
      </div>
      {locked && (
        <div id="ed-locked" className={`mb-2.5 rounded-2xl border p-4 text-sm md:mb-5 ${TONE.amber}`}>
          <b className="flex items-center gap-1.5"><span className="icon text-[18px]">lock</span>পরীক্ষা শুরু হয়ে গেছে, প্রশ্নপত্র, সময় আর নিয়ম আর বদলানো যায় না</b>
          <p className="mt-1">উত্তরে ভুল ধরা পড়লে অ্যাডমিন প্যানেলের পরীক্ষা পাতায় &quot;সংশোধন&quot; দিয়ে কারণসহ ঠিক করুন, সবার নম্বর নিজে থেকে আবার হিসাব হবে।</p>
        </div>
      )}
      <div className="grid grid-cols-1 items-start gap-2.5 md:gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-2.5 md:space-y-6">
          <div className={`${CARD} p-5 md:p-6`} id="ed-settings" onChange={clearInvalid}>
            <h3 className="flex items-center gap-2 text-lg font-bold text-on-background dark:text-background"><span className="icon text-primary dark:text-primary-fixed">tune</span>পরীক্ষার তথ্য ও সময়</h3>
            <div className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-4">
              <div className="md:col-span-2"><label className={label} htmlFor="f-title">পরীক্ষার নাম</label><input id="f-title" className="ex-field" value={title} onChange={(x) => setTitle(x.target.value)} placeholder="যেমন: সাপ্তাহিক MCQ ০৭: ভেক্টর" maxLength={120} /></div>
              <div><label className={label} htmlFor="f-course">কোর্স</label>
                <select id="f-course" className="ex-field" value={course} onChange={(x) => setCourse(Number(x.target.value))} disabled={dis || (!!e && questions.length > 0)} title={e && questions.length ? "প্রশ্ন বসানোর পর কোর্স বদলানো যায় না" : undefined}>
                  {courses.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
              <div><label className={label} htmlFor="f-kind">ধরন</label>
                <select id="f-kind" className="ex-field" value={kind} onChange={(x) => setKind(x.target.value as Kind)} disabled={dis}>{Object.entries(KIND).map(([k, [t]]) => <option key={k} value={k}>{t}</option>)}</select></div>
              <div><label className={label} htmlFor="f-min">পরীক্ষার সময় (মিনিট)</label><input id="f-min" type="number" min="1" max="600" className="ex-field" value={minutes} onChange={(x) => setMinutes(x.target.value)} disabled={dis} /></div>
              <div id="f-neg-wrap" className={kind === "written" ? "opacity-40" : ""}><label className={label} htmlFor="f-neg">MCQ এ প্রতি ভুলে কাটা</label><input id="f-neg" type="number" min="0" max="1" step="0.25" className="ex-field" value={neg} onChange={(x) => setNeg(x.target.value)} disabled={dis || kind === "written"} /></div>
              <div><label className={label} htmlFor="f-opens">কখন খুলবে (শুরু)</label><input id="f-opens" type="datetime-local" className="ex-field" value={opens} onChange={(x) => setOpens(x.target.value)} disabled={dis} /></div>
              <div><label className={label} htmlFor="f-closes">কখন বন্ধ হবে (শেষ)</label><input id="f-closes" type="datetime-local" className="ex-field" value={closes} onChange={(x) => setCloses(x.target.value)} disabled={dis} /></div>
              <div className="md:col-span-2">
                <p id="f-time-hint" className={`rounded-xl border p-3 text-xs ${TONE.blue}`}>{hint}</p>
                {!locked && <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={BTN_GHOST + SM} onClick={() => setEnd(0)}>শেষ = শুরু + সময়</button>
                  <button type="button" className={BTN_GHOST + SM} onClick={() => setEnd(15)}>+১৫ মিনিট দেরিতে শুরুর সুযোগ</button>
                  <button type="button" className={BTN_GHOST + SM} onClick={() => setEnd(60)}>+১ ঘণ্টা</button></div>}
              </div>
              {kind !== "mcq" && (
                <div className="md:col-span-2"><span className={label}>লিখিত: কয়টির উত্তর দিতে হবে</span>
                  {sections.length ? (
                    <>
                      <div className="grid gap-2">{sections.map((sec) => (
                        <label key={sec} className="flex flex-wrap items-center gap-2 text-sm"><b>{sec}</b>: মোট {bn(s.secs[sec].length)}টি প্রশ্ন, উত্তর দিতে হবে
                          <input type="number" min="1" max={s.secs[sec].length} className="ex-field w-20! py-1! text-center" data-pick={sec} value={pick[sec] ?? ""} placeholder="সব" disabled={dis} onChange={(x) => setPick((p) => ({ ...p, [sec]: x.target.value }))} />টির</label>
                      ))}</div>
                      <p className={`text-[11px] ${MUTED} mt-1`}>খালি রাখলে সবগুলোর উত্তর দিতে হবে। শিক্ষার্থী যেকোনো N টি বেছে নেবে।</p>
                    </>
                  ) : <p className={`text-xs ${MUTED}`}>লিখিত প্রশ্ন বসালে এখানে &quot;যেকোনো N টি&quot; ঠিক করা যাবে।</p>}
                </div>
              )}
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-variant/30 p-3 select-none"><input type="checkbox" id="f-shuffle" className="mt-0.5 h-5 w-5 accent-[#006c49]" checked={shuffle} onChange={(x) => setShuffle(x.target.checked)} disabled={dis} />
                <span><b className="text-sm">প্রশ্ন আর অপশন প্রতিজনের আলাদা ক্রমে</b><span className={`block text-[11px] ${MUTED}`}>&quot;সবগুলো&quot; ধরনের অপশন থাকলে সেই প্রশ্নের অপশন নড়ে না</span></span></label>
              <label id="f-hide-wrap" className={`${kind === "mcq" ? "flex" : "hidden"} cursor-pointer items-start gap-3 rounded-xl border border-outline-variant/30 p-3 select-none`}><input type="checkbox" id="f-hide" className="mt-0.5 h-5 w-5 accent-[#006c49]" checked={hide} onChange={(x) => setHide(x.target.checked)} disabled={dis} />
                <span><b className="text-sm">অন্য ট্যাব বা অ্যাপে গেলে জমা</b><span className={`block text-[11px] ${MUTED}`}>শুধু MCQ পরীক্ষায়</span></span></label>
              <div id="f-written-rules" className={`${kind === "mcq" ? "hidden" : "grid"} grid-cols-2 gap-2.5 md:col-span-2 md:gap-4`}>
                <div><label className={label} htmlFor="f-mod">দ্বিতীয় যাচাই (%)</label><input id="f-mod" type="number" min="0" max="100" className="ex-field" value={mod} onChange={(x) => setMod(x.target.value)} disabled={dis} /></div>
                <div><label className={label} htmlFor="f-recheck">পুনর্মূল্যায়নের সময় (দিন)</label><input id="f-recheck" type="number" min="0" max="14" className="ex-field" value={recheck} onChange={(x) => setRecheck(x.target.value)} disabled={dis} /></div>
              </div>
            </div>
            {err && <p id="f-err" role="alert" className="mt-3 text-sm font-bold text-error dark:text-red-300">{err.error}</p>}
            {!locked && <div className="mt-4 flex gap-2"><button id="f-save" type="button" disabled={saving} className={BTN_PRI} onClick={() => void save()}><span className="icon text-[18px]">save</span>{e ? "সংরক্ষণ" : "পরীক্ষা তৈরি করুন"}</button></div>}
          </div>

          {e && (
            <div className={`${CARD} p-5 md:p-6`} id="ed-questions">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-lg font-bold text-on-background dark:text-background"><span className="icon text-primary dark:text-primary-fixed">quiz</span>প্রশ্ন ({bn(questions.length)})</h3>
                {!locked && (
                  <div className="flex flex-wrap gap-2">
                    {e.kind !== "written" && <>
                      <button id="ed-add-mcq" type="button" className={BTN_PRI + SM} onClick={() => openQ(blankDraft("mcq", ""))}><span className="icon text-[16px]">add</span>MCQ</button>
                      <button id="ed-bulk" type="button" className={BTN_GHOST + SM} onClick={bulk}><span className="icon text-[16px]">content_paste</span>একসাথে অনেক MCQ</button></>}
                    {e.kind !== "mcq" && <button id="ed-add-written" type="button" className={BTN_PRI + SM} onClick={() => openQ(blankDraft("written", sections[0] ?? ""), true)}><span className="icon text-[16px]">add</span>লিখিত</button>}
                  </div>
                )}
              </div>
              <div className="mt-4 space-y-2 md:space-y-3">
                {questions.map((q, i) => (
                  <div key={q.id} data-q={q.id} className="rounded-2xl border border-outline-variant/30 p-4">
                    <div className={`flex flex-wrap items-center gap-2 text-xs ${MUTED}`}>
                      <b className="text-sm text-on-background dark:text-background">প্রশ্ন {bn(i + 1)}</b>{q.kind === "mcq" ? <Badge tone="gray">MCQ</Badge> : <Badge tone="blue">{q.section}</Badge>}
                      <span>{num(q.marks)} নম্বর</span>{chapterName(q.chapterId) && <span>· {chapterName(q.chapterId)}</span>}{q.lock && <Badge tone="gray" icon="lock">অপশনের ক্রম ঠিক থাকবে</Badge>}
                    </div>
                    <Tex className="ed-q mt-2 leading-relaxed text-on-background dark:text-background" src={q.body} />{q.image && <img className="ed-qimg" src={q.image.url} alt="" />}
                    {q.kind === "mcq" && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">{q.options.map((op, k) => (
                        <div key={k} className={`flex items-start gap-2 rounded-xl border p-2 text-sm ${k === q.key ? TONE.green + " font-bold" : "border-outline-variant/30"}`}>
                          <span className="ex-k h-7! w-7! flex-[0_0_1.75rem]! text-xs">{L[k]}</span><span className="min-w-0"><Tex as="span" src={op} />{q.optionImages[k] && <img className="ed-oimg" src={q.optionImages[k]!.url} alt="" />}</span>
                          {k === q.key && <span className="icon ml-auto text-[18px]">check</span>}
                        </div>))}</div>
                    )}
                    {(q.exp || q.scheme) && (
                      <details className="mt-2 text-sm"><summary className={`cursor-pointer font-bold ${MUTED}`}>{q.kind === "mcq" ? "ব্যাখ্যা" : "সমাধান আর নম্বর বিভাজন"}</summary>
                        <Tex className={`mt-1 ${MUTED}`} src={q.exp} />{q.scheme && <p className={`mt-1 text-xs ${MUTED} whitespace-pre-line`}>{q.scheme}</p>}</details>
                    )}
                    {!locked && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <button type="button" data-edit={q.id} className={BTN_GHOST + SM} onClick={() => editQ(q)}><span className="icon text-[16px]">edit</span>সম্পাদনা</button>
                        <button type="button" className={BTN_GHOST + SM} disabled={i === 0} title="উপরে" aria-label="উপরে" onClick={() => void act(() => moveQuestion(e.id, q.id, -1))}><span className="icon text-[16px]">arrow_upward</span></button>
                        <button type="button" className={BTN_GHOST + SM} disabled={i === questions.length - 1} title="নিচে" aria-label="নিচে" onClick={() => void act(() => moveQuestion(e.id, q.id, 1))}><span className="icon text-[16px]">arrow_downward</span></button>
                        <button type="button" className={BTN_GHOST + SM} title="কপি করে নতুন প্রশ্ন" aria-label="কপি" onClick={() => void copyQ(q)}><span className="icon text-[16px]">content_copy</span></button>
                        <button type="button" className={`${BTN_GHOST + SM} hover:border-error! hover:text-error!`} title="মুছুন" aria-label="মুছুন" onClick={() => delQ(q)}><span className="icon text-[16px]">delete</span></button>
                      </div>
                    )}
                  </div>
                ))}
                {!questions.length && <p className={`text-sm ${MUTED} rounded-2xl border border-dashed border-outline-variant/40 p-6 text-center`}>এখনো প্রশ্ন নেই। উপরের বোতাম দিয়ে যোগ করুন। গণিত লিখুন $...$ এর ভেতরে, যেমন $x^2 + \frac&#123;1&#125;&#123;2&#125;$।</p>}
              </div>
            </div>
          )}
        </div>

        {e && (
          <div className="space-y-2.5 md:space-y-4 xl:sticky xl:top-[120px]">
            <div className={`${CARD} p-5`}>
              <h3 className="font-bold text-on-background dark:text-background">সারাংশ</h3>
              <div className={`mt-3 grid grid-cols-2 gap-2 text-center text-xs ${MUTED}`}>
                <div className="rounded-xl bg-surface-container-low p-2 dark:bg-white/5"><b className="block text-lg text-on-background dark:text-background">{bn(s.mcq)}</b>MCQ ({num(s.mcqMarks)} নম্বর)</div>
                <div className="rounded-xl bg-surface-container-low p-2 dark:bg-white/5"><b className="block text-lg text-on-background dark:text-background">{bn(s.written)}</b>লিখিত ({num(s.wTotal)} নম্বর)</div>
              </div>
              {sections.length > 0 && <p className={`text-xs ${MUTED} mt-2`}>{sections.map((sec) => `${sec}: ${bn(s.secs[sec].length)}টির মধ্যে ${e.pick[sec] ? `যেকোনো ${bn(e.pick[sec])}টি` : "সবগুলো"}`).join(" · ")}</p>}
              <p className="mt-3 text-sm">মোট <b>{num(s.mcqMarks + s.wTotal)}</b> নম্বর · <b>{bn(e.minutes)}</b> মিনিট</p>
              <p className={`text-xs ${MUTED} mt-1`}>{e.opens != null ? `${when(e.opens, now)} থেকে ${when(e.closes, now)}` : "সময় ঠিক হয়নি"}</p>
            </div>
            <div className={`${CARD} p-5`} id="ed-ready">
              <h3 className="font-bold text-on-background dark:text-background">প্রকাশের আগে যাচাই</h3>
              {issues.length ? (
                <ul className="mt-2 space-y-1.5 text-sm">{issues.map((x) => <li key={x} className="flex gap-2 text-error dark:text-red-300"><span className="icon shrink-0 text-[18px]">error</span><span>{x}</span></li>)}</ul>
              ) : <p className="mt-2 flex gap-2 text-sm text-emerald-700 dark:text-emerald-300"><span className="icon text-[18px]">check_circle</span>সব ঠিক আছে</p>}
              <div className="mt-4 flex flex-col gap-2">
                <button id="ed-preview" type="button" className={BTN_GHOST} onClick={() => { setView("preview"); window.scrollTo({ top: 0 }); }}><span className="icon text-[18px]">visibility</span>শিক্ষার্থীর মতো দেখুন</button>
                {st === "draft" ? <button id="ed-publish" type="button" className={BTN_PRI} onClick={() => publish(true)} disabled={issues.length > 0}><span className="icon text-[18px]">publish</span>প্রকাশ করুন</button>
                  : !locked ? <button id="ed-unpublish" type="button" className={BTN_GHOST} onClick={() => publish(false)}><span className="icon text-[18px]">unpublished</span>প্রকাশ বন্ধ করুন</button> : null}
              </div>
            </div>
          </div>
        )}
      </div>
      <ExModal spec={modal} close={closeModal} />
      {toastNode}
    </main>
  );
}
