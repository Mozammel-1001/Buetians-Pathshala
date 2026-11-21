"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useExToast } from "@/app/practice/ui";
import { answerQuestion, markRemindersRead } from "./actions";
import { ago, bn } from "./lib";
import { span } from "@/app/evaluator/lib";
import { CARD, MUTED, TONE } from "@/app/evaluator/ui";
import type { QaItem, Reminder } from "./data";

// শিক্ষার্থীদের প্রশ্ন (teacher_dashboard.html এর qa-view): নিজের কোর্সের প্রশ্নের উত্তর দেন। অ্যাডমিন বা ম্যানেজার
// উত্তর দিতে মনে করালে প্রশ্নের উপর হলুদ রিমাইন্ডার দেখায়। খোলার সময় যেগুলো পড়া হয়নি সেগুলো "নতুন", তারপর পড়া ধরা হয়
const ROLE: Record<string, [string, string]> = { teacher: ["শিক্ষক", TONE.green], admin: ["অ্যাডমিন", TONE.purple], manager: ["ম্যানেজার", TONE.amber] };
const DAY = 864e5;
const FIELD = "w-full bg-surface-container-lowest dark:bg-inverse-surface border border-outline-variant/40 dark:border-outline-variant/20 rounded-xl px-4 py-2.5 text-sm text-on-background dark:text-background focus:outline-none focus:border-primary dark:focus:border-primary-fixed transition-colors";
const norm = (t: string) => t.normalize("NFC").toLowerCase();

const Tile = ({ icon, cls, value, label }: { icon: string; cls: string; value: number; label: string }) => (
  <div className={`${CARD} flex items-center gap-3 rounded-2xl! p-4`}><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${cls}`}><span className="icon">{icon}</span></div>
      <div><div className="text-xl font-bold text-on-background dark:text-background">{bn(value)}</div><div className={`text-xs ${MUTED}`}>{label}</div></div></div>
  );

export function QaView({ items, reminders, focus, nowMs, me }: { items: QaItem[]; reminders: Reminder[]; focus: number | null; nowMs: number; me: string }) {
  const router = useRouter();
  const [toast, toastNode] = useExToast();
  const target = items.find((q) => q.id === focus);
  const [tab, setTab] = useState<"open" | "done" | "all">(target && target.answers.length ? "all" : "open");
  const [course, setCourse] = useState<number | "all">("all");
  const [term, setTerm] = useState("");
  const [more, setMore] = useState<number[]>([]);        // উত্তর দেওয়া প্রশ্নে "আরও যোগ করুন" খোলা
  const [err, setErr] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const refs = useRef(new Map<number, HTMLTextAreaElement>());
  const [fresh] = useState(() => new Set(reminders.filter((r) => !r.read).map((r) => r.id)));   // এই খোলায় "নতুন" রিমাইন্ডার
  const [ring, setRing] = useState<number | null>(null);

  // খোলার পর পড়া হয়েছে ধরা; দরকারি প্রশ্নে স্ক্রল
  useEffect(() => {
    const t = setTimeout(() => {
      if (reminders.some((r) => !r.read)) void markRemindersRead().then(() => router.refresh());
      if (focus) {
        const el = document.querySelector(`[data-qid="${focus}"]`);
        if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); setRing(focus); setTimeout(() => setRing(null), 2200); }
      }
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- শুধু খোলার সময়
  }, []);

  const courses = [...new Map(items.map((q) => [q.courseId, q.course])).entries()];
  const inCourse = items.filter((q) => course === "all" || q.courseId === course);
  const open = inCourse.filter((q) => !q.answers.length);
  const counts = { open: open.length, done: inCourse.length - open.length, all: inCourse.length };
  const remOf = (q: QaItem) => reminders.filter((r) => r.qid === q.id).sort((a, b) => b.at - a.at);
  const late = open.filter((q) => nowMs - q.at >= DAY).length;
  const reminded = open.filter((q) => remOf(q).length).length;
  const freshRows = reminders.filter((r) => fresh.has(r.id) && !r.answered);
  const t = norm(term.trim());
  const rows = inCourse
    .filter((q) => tab === "all" || (tab === "open" ? !q.answers.length : q.answers.length))
    .filter((q) => !t || norm([q.body, q.asker, q.chapter, ...q.answers.map((a) => a.body)].join(" ")).includes(t))
    .sort((a, b) => tab === "open" ? (Number(remOf(b).length > 0) - Number(remOf(a).length > 0)) || (a.at - b.at) : b.at - a.at);

  const send = async (q: QaItem) => {
    const box = refs.current.get(q.id);
    const body = box?.value.trim() ?? "";
    if (body.length < 2) { setErr((e) => ({ ...e, [q.id]: "উত্তর লিখুন" })); box?.focus(); return; }
    setBusy(q.id);
    const r = await answerQuestion(q.id, body);
    setBusy(null);
    if (!r.ok) { toast(r.error, "error"); router.refresh(); return; }
    if (box) box.value = "";
    setMore((m) => m.filter((x) => x !== q.id));
    toast(`উত্তর পাঠানো হয়েছে, ${q.asker} নোটিফিকেশন পাবে`);
    router.refresh();
  };


  return (
    <>
      <div className="mb-3 flex items-center gap-4 md:mb-8">
        <Link href="/teacher" aria-label="ড্যাশবোর্ডে ফিরুন" className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/20 bg-surface-container-low transition-colors hover:bg-surface-variant dark:bg-white/5"><span className="icon">arrow_back</span></Link>
        <div><h2 className="text-2xl font-bold text-on-background md:text-3xl dark:text-background">শিক্ষার্থীদের প্রশ্ন</h2>
          <p className={`mt-1 text-sm ${MUTED}`}>আপনার কোর্সের শিক্ষার্থীদের প্রশ্নের উত্তর দিন। উত্তর দিলে শিক্ষার্থী নোটিফিকেশন পাবে।</p></div>
      </div>

      {freshRows.length > 0 && (
        <div id="tqa-reminders" className="mb-2.5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 md:mb-4 md:flex-row md:items-center md:p-5 dark:border-amber-800/40 dark:bg-amber-900/20">
          <span className="icon shrink-0 text-3xl text-amber-500">notifications_active</span>
          <div className="grow text-sm text-amber-900 dark:text-amber-100"><div className="font-bold">অ্যাডমিন/ম্যানেজার {bn(new Set(freshRows.map((r) => r.qid)).size)}টি প্রশ্নের উত্তর দিতে মনে করিয়ে দিয়েছেন</div>
            <div className="mt-1 text-xs opacity-80">হলুদ চিহ্ন দেওয়া প্রশ্নগুলো আগে দেখুন। উত্তর দিলে রিমাইন্ডার আর দেখাবে না।</div></div>
        </div>
      )}
      <div id="tqa-stats" className="mb-2.5 grid grid-cols-1 gap-2 md:mb-4 md:grid-cols-3 md:gap-4">
        <Tile icon="hourglass_top" cls="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" value={counts.open} label="উত্তর বাকি" />
        <Tile icon="notifications_active" cls="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" value={reminded} label="রিমাইন্ডার এসেছে" />
        <Tile icon="schedule" cls="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" value={late} label="২৪ ঘণ্টার বেশি অপেক্ষায়" />
      </div>

      <div className={`${CARD} p-4 md:p-6`}>
        <div className="mb-2.5 flex flex-col gap-2 md:mb-5 md:flex-row md:items-center md:justify-between md:gap-4">
          <div id="tqa-tabs" className="flex gap-1 rounded-xl bg-surface-container-low p-1 dark:bg-white/5">
            {([["open", "উত্তর বাকি", "hourglass_top"], ["done", "উত্তর দেওয়া", "check_circle"], ["all", "সব", "forum"]] as const).map(([k, label, icon]) => (
              <button key={k} type="button" data-tab={k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition-colors md:px-4 ${k === tab ? "bg-primary text-white shadow-sm dark:bg-primary-fixed dark:text-on-primary-fixed" : `${MUTED} hover:text-primary dark:hover:text-primary-fixed`}`}><span className="icon text-[18px]">{icon}</span>{label} <span className="opacity-70">({bn(counts[k])})</span></button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select id="tqa-course" aria-label="কোর্স" className={`${FIELD} sm:w-auto`} value={course} onChange={(e) => setCourse(e.target.value === "all" ? "all" : Number(e.target.value))}>
              <option value="all">সব কোর্স</option>{courses.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <div className="relative"><span className={`icon absolute top-1/2 left-3 -translate-y-1/2 text-[20px] ${MUTED}`}>search</span>
              <input id="tqa-q" type="search" aria-label="প্রশ্ন খুঁজুন" placeholder="প্রশ্ন বা নাম খুঁজুন" className={`${FIELD} pl-10`} value={term} onChange={(e) => setTerm(e.target.value)} /></div>
          </div>
        </div>

        <div id="tqa-list" className="space-y-2 md:space-y-4">
          {rows.map((q, i) => {
            const answered = q.answers.length > 0, rems = remOf(q), hot = !answered && rems.some((r) => fresh.has(r.id)), wait = nowMs - q.at;
            return (
              <article key={q.id} data-qid={q.id} style={{ "--i": Math.min(i, 10) } as React.CSSProperties}
                className={`tqa-row rounded-2xl border p-5 transition-shadow ${hot ? "border-amber-300 bg-amber-50/40 dark:border-amber-700/60 dark:bg-amber-900/10" : "border-outline-variant/20 bg-surface-container-low/60 dark:bg-white/5"} ${ring === q.id ? "ring-2 ring-primary dark:ring-primary-fixed" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 font-bold text-primary dark:bg-primary-fixed/10 dark:text-primary-fixed">{[...q.asker][0]}</div>
                  <div className="min-w-0 grow">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="text-sm"><span className="font-bold text-on-background dark:text-background">{q.asker}</span> <span className={`text-xs ${MUTED}`}>· {ago(q.at, nowMs)}</span>
                        <div className={`mt-1 text-xs ${MUTED}`}>{q.course} › {q.chapter}</div></div>
                      {answered
                        ? <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${TONE.green}`}><span className="icon text-[14px]">check_circle</span>উত্তর দেওয়া হয়েছে</span>
                        : <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${wait >= DAY ? TONE.red : TONE.amber}`}><span className="icon text-[14px]">hourglass_top</span>{span(wait)} ধরে অপেক্ষায়</span>}
                    </div>
                    {!answered && rems.length > 0 && (
                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200">
                        <span className="icon text-[18px] text-amber-500">notifications_active</span>
                        <div><div><strong>{rems[0].by}</strong> ({ROLE[rems[0].role][0]}) উত্তর দিতে বলেছেন · {ago(rems[0].at, nowMs)}{rems.length > 1 ? ` · মোট ${bn(rems.length)} বার` : ""}{hot && <span className="ml-1 rounded bg-error px-1.5 py-0.5 font-bold text-white">নতুন</span>}</div>
                          {rems[0].note && <div className="mt-1 italic">&quot;{rems[0].note}&quot;</div>}</div>
                      </div>
                    )}
                    <p className="mt-3 leading-relaxed break-words whitespace-pre-line text-on-background dark:text-background">{q.body}</p>
                    {q.answers.map((a) => (
                      <div key={a.id} className="mt-4 border-l-2 border-primary/40 pl-4 dark:border-primary-fixed/40">
                        <div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-bold text-on-background dark:text-background">{a.by}{a.role === "teacher" && a.by === me ? " (আপনি)" : ""}</span>
                          <span className={`rounded-full border px-2 py-0.5 font-bold ${(ROLE[a.role] ?? ROLE.teacher)[1]}`}>{(ROLE[a.role] ?? ROLE.teacher)[0]}</span><span className={MUTED}>· {ago(a.at, nowMs)}</span></div>
                        <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-on-background dark:text-background">{a.body}</p>
                      </div>
                    ))}
                    {!answered || more.includes(q.id) ? (
                      <div className="mt-4">
                        <textarea ref={(el) => { if (el) refs.current.set(q.id, el); else refs.current.delete(q.id); }} id={`tqa-ans-${q.id}`} rows={3} className={`${FIELD} resize-y ${err[q.id] ? "border-error!" : ""}`}
                          placeholder={answered ? "আরও কিছু যোগ করুন..." : "উত্তর লিখুন... (Ctrl + Enter দিয়েও পাঠানো যায়)"}
                          onChange={() => err[q.id] && setErr((e) => ({ ...e, [q.id]: "" }))} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void send(q); }} />
                        {err[q.id] && <p className="mt-1 text-xs font-bold text-error dark:text-red-300">{err[q.id]}</p>}
                        <div className="mt-2 flex justify-end"><button type="button" data-send={q.id} disabled={busy === q.id} onClick={() => void send(q)} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary transition-colors hover:bg-surface-tint disabled:opacity-50"><span className="icon text-[18px]">send</span>{answered ? "যোগ করুন" : "উত্তর দিন"}</button></div>
                      </div>
                    ) : (
                      <div className="mt-3 flex justify-end"><button type="button" onClick={() => { setMore((m) => [...m, q.id]); setTimeout(() => refs.current.get(q.id)?.focus(), 50); }} className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline dark:text-primary-fixed"><span className="icon text-[16px]">add_comment</span>আরও কিছু যোগ করুন</button></div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
          {!rows.length && <div className="py-14 text-center"><span className="icon text-5xl text-outline-variant">forum</span><p className={`mt-3 font-bold ${MUTED}`}>{t ? "কিছু পাওয়া যায়নি" : tab === "open" ? "সব প্রশ্নের উত্তর দেওয়া হয়েছে 🎉" : "কোনো প্রশ্ন নেই"}</p></div>}
        </div>
      </div>
      {toastNode}
    </>
  );
}
