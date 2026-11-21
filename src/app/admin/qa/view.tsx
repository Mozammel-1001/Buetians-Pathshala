"use client";

import { useState } from "react";
import { bn } from "@/lib/content-schema";
import { COURSES, courseName } from "../_components/sample";
import { Modal, SampleNote, SearchBox, Tabs, useToast } from "../_components/kit";
import { Avatar, Badge, EmptyState, PageHead, ROLE } from "../_components/ui";

// পড়াশোনার প্রশ্ন আর ভর্তির প্রশ্ন, হুবহু admin_dashboard.html এর qaRender/qaCard:
// শিক্ষক/ম্যানেজারভিত্তিক বাকি প্রশ্নের কার্ড, ট্যাব + খোঁজা + কোর্স, প্রতিটা প্রশ্নে উত্তরের ঘর, "উত্তর দিন",
// জানানোর বোতাম (একই প্রশ্নে একই জনকে ৩ ঘণ্টায় একবার), কতবার জানানো হয়েছে তার লাইন, মোছা। ধাপ ১: নমুনা তথ্য
type Person = { id: number; name: string };
type Rem = { to: number; toName: string; by: string; role: string; ago: number; sms?: boolean; note?: string };
type Ans = { by: string; role: string; ago: number; body: string };
type Q = { id: number; user: string; course: number; where: string; body: string; ago: number; to: Person[]; answers: Ans[]; reminders: Rem[] };
type Kind = "study" | "enrollment";
type Panel = "admin" | "manager";

const T = { rafi: { id: 1, name: "রাফিউল ইসলাম" }, tasnim: { id: 2, name: "তাসনিম আহমেদ" }, farhana: { id: 3, name: "ফারহানা ইয়াসমিন" }, mahmud: { id: 4, name: "মাহমুদুল হাসান" } };
const MGR = [{ id: 13, name: "রুবিনা আক্তার" }, { id: 22, name: "রিয়াদ হাসান" }];
const H = 60, D = 1440;   // মিনিট
const STUDY: Q[] = [
  { id: 1, user: "ইমরান কবির", course: 2, where: "নিউটনের গতিসূত্র: সলভ ক্লাস", body: "লিফটের অঙ্কে টান কখন mg এর চেয়ে বেশি হয়?", ago: 2 * D, to: [T.rafi], answers: [], reminders: [{ to: 1, toName: T.rafi.name, by: "রুবিনা আক্তার", role: "manager", ago: 20 * H }, { to: 1, toName: T.rafi.name, by: "রুবিনা আক্তার", role: "manager", ago: 26 * H }, { to: 1, toName: T.rafi.name, by: "তানভীর আহমেদ", role: "admin", ago: 30 * H }] },
  { id: 2, user: "ইমরান কবির", course: 4, where: "সীমা ও অন্তরীকরণ", body: "lim(x→0) sin x / x = 1 এর প্রমাণটা কি ভর্তি পরীক্ষায় লিখতে হয়, নাকি শুধু ব্যবহার করলেই হবে?", ago: 9 * H, to: [T.rafi], answers: [], reminders: [{ to: 1, toName: T.rafi.name, by: "তানভীর আহমেদ", role: "admin", ago: 4 * H, sms: true }] },
  { id: 3, user: "তাহমিদ রহমান", course: 2, where: "সরলরেখা", body: "দুটি রেখা লম্ব হওয়ার শর্ত m₁m₂ = −1 কি একটা রেখা উল্লম্ব (x = 3) হলেও খাটে?", ago: 5 * H, to: [T.rafi], answers: [], reminders: [{ to: 1, toName: T.rafi.name, by: "রুবিনা আক্তার", role: "manager", ago: 2 * H }] },
  { id: 4, user: "ফারহানা ইয়াসমিন", course: 4, where: "যোগজীকরণ", body: "∫ eˣ{f(x) + f′(x)} dx = eˣf(x) + c সূত্রটা কখন ব্যবহার করবো বুঝতে পারছি না। কোনো লক্ষণ আছে?", ago: 2 * H, to: [T.rafi], answers: [], reminders: [] },
  { id: 5, user: "সাদিয়া আক্তার", course: 1, where: "ভগ্নাংশ ও শতকরা: পর্ব ১", body: "শতকরা লাভ-ক্ষতির শর্টকাট নিয়মটা কি সব অঙ্কে কাজ করবে?", ago: 1 * H, to: [T.rafi, T.mahmud], answers: [], reminders: [] },
  { id: 6, user: "আরিফ হোসেন", course: 3, where: "জৈব রসায়ন: হাইড্রোকার্বন", body: "অ্যালকিন আর অ্যালকাইনের মধ্যে কোনটা বেশি সক্রিয়, আর কেন? ভিডিওর ৩২ মিনিটে বিষয়টা পরিষ্কার হয়নি।", ago: 15, to: [T.mahmud, T.farhana], answers: [], reminders: [] },
  { id: 7, user: "নাফিসা ইসলাম", course: 2, where: "ভেক্টর", body: "ক্রস গুণফলের দিক ডান হাতের নিয়মে কীভাবে বের করবো? আঙুলগুলো কোন দিকে ঘোরাবো?", ago: 3 * D, to: [T.rafi], answers: [{ by: "রাফিউল ইসলাম", role: "teacher", ago: 2 * D, body: "ডান হাতের আঙুলগুলো প্রথম ভেক্টর A এর দিকে রেখে B এর দিকে ভাঁজ করো। বুড়ো আঙুল যেদিকে থাকবে, A × B সেদিকে।" }], reminders: [] },
  { id: 8, user: "তানভীর হোসেন", course: 4, where: "নিউটনের গতিসূত্র", body: "নিউটনের তৃতীয় সূত্রে ক্রিয়া-প্রতিক্রিয়া একই বস্তুর ওপর কেন কাজ করে না?", ago: 4 * D, to: [T.tasnim], answers: [{ by: "তাসনিম আহমেদ", role: "teacher", ago: 3 * D, body: "কারণ বল দুটো দুই আলাদা বস্তুর ওপর কাজ করে, তাই একে অপরকে বাতিল করে না।" }], reminders: [] },
];
const ENROLL: Q[] = [
  { id: 11, user: "রুবিনা আক্তার", course: 1, where: "কোর্সের বিস্তারিত পেজ থেকে", body: "অফলাইন ব্রাঞ্চে গিয়ে ক্যাশে টাকা দিয়ে কি ভর্তি হওয়া যাবে? বিকাশ নেই।", ago: 26 * H, to: MGR, answers: [], reminders: [{ to: 13, toName: "রুবিনা আক্তার", by: "তানভীর আহমেদ", role: "admin", ago: 3 * H, note: "অভিভাবক অপেক্ষায় আছেন, আজকের মধ্যে উত্তর দিন।" }] },
  { id: 12, user: "সুমাইয়া আক্তার", course: 2, where: "কোর্সের বিস্তারিত পেজ থেকে", body: "দুই ভাইবোন একসাথে ভর্তি হলে কি কোনো ছাড় পাওয়া যাবে?", ago: 6 * H, to: MGR, answers: [], reminders: [] },
  { id: 13, user: "রাকিব হোসেন", course: 3, where: "কোর্সের বিস্তারিত পেজ থেকে", body: "লাইভ ক্লাস কি শুধু সন্ধ্যায় হয়? স্কুল থেকে ফিরতে ৫টা বেজে যায়।", ago: 40, to: MGR, answers: [], reminders: [] },
  { id: 14, user: "তানভীর হাসান", course: 1, where: "কোর্সের বিস্তারিত পেজ থেকে", body: "কোর্সের মেয়াদ কতদিন? পরীক্ষা শেষ হওয়ার পরেও কি রেকর্ডেড ক্লাস দেখা যাবে?", ago: 3 * D, to: MGR, answers: [{ by: "রুবিনা আক্তার", role: "manager", ago: 2 * D, body: "ভর্তির দিন থেকে ১ বছর। এর মধ্যে সব ক্লাসের রেকর্ডিং, নোট আর মডেল টেস্ট দেখতে পারবে।" }], reminders: [] },
  { id: 15, user: "নাদিয়া ইসলাম", course: 4, where: "কোর্সের বিস্তারিত পেজ থেকে", body: "বিকাশে টাকা পাঠানোর পর কতক্ষণে কোর্স চালু হয়?", ago: 5 * D, to: MGR, answers: [{ by: "তানভীর আহমেদ", role: "admin", ago: 4 * D, body: "সাধারণত ২ থেকে ৬ ঘণ্টার মধ্যে। চালু হলে SMS পাবে। ৬ ঘণ্টার বেশি লাগলে হেল্পলাইনে ফোন করো।" }], reminders: [] },
];

const span = (m: number) => m < H ? `${bn(Math.max(1, Math.round(m)))} মিনিট` : m < D ? `${bn(Math.round(m / H))} ঘণ্টা` : `${bn(Math.round(m / D))} দিন`;
const ago = (m: number) => m < 1 ? "এইমাত্র" : `${span(m)} আগে`;
const GAP = 3 * H;   // একই প্রশ্নে একই জনকে আবার জানানোর ফাঁক
const lastTo = (x: Q, pid: number) => Math.min(Infinity, ...x.reminders.filter((r) => r.to === pid).map((r) => r.ago));
const canRemind = (x: Q, pid: number) => lastTo(x, pid) >= GAP;
const nextIn = (x: Q, pid: number) => Math.max(0, GAP - lastTo(x, pid));
const WHO = { study: "শিক্ষক", enrollment: "ম্যানেজার" } as const;
const SUB = {
  study: { admin: "শিক্ষার্থীদের পড়াশোনার প্রশ্নের উত্তর দিন, দেরি হলে শিক্ষককে জানান, অনুচিত প্রশ্ন সরিয়ে দিন", manager: "শিক্ষার্থীদের পড়াশোনার প্রশ্ন। উত্তর দেন শিক্ষক বা অ্যাডমিন; দেরি হলে শিক্ষককে জানান।" },
  enrollment: { admin: "কোর্সের বিস্তারিত পেজে ভর্তি নিয়ে করা প্রশ্ন। উত্তর দিন, বা দেরি হলে ম্যানেজারকে জানান।", manager: "কোর্সের বিস্তারিত পেজে ভর্তি নিয়ে করা প্রশ্ন। উত্তর আপনি বা অ্যাডমিন দেবেন; উত্তর পাওয়া প্রশ্ন সবাই দেখতে পায়।" },
};
const ME = { admin: { id: 1, name: "তানভীর আহমেদ", role: "admin" }, manager: { id: 13, name: "রুবিনা আক্তার", role: "manager" } };

export function QaBoard({ kind, panel = "admin" }: { kind: Kind; panel?: Panel }) {
  const who = WHO[kind];
  const canNotify = kind === "study" || panel === "admin";      // শিক্ষককে: admin ও manager; manager কে: শুধু admin
  const canAnswer = kind === "enrollment" || panel === "admin";  // পড়াশোনা: admin; ভর্তি: admin ও manager
  const [list, setList] = useState<Q[]>(kind === "study" ? STUDY : ENROLL);
  const [tab, setTab] = useState<"open" | "done" | "all">("open");
  const [q, setQ] = useState("");
  const [course, setCourse] = useState(0);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [ansErr, setAnsErr] = useState(0);
  const [remindQ, setRemindQ] = useState<Q | null>(null);
  const [remindP, setRemindP] = useState<Person | null>(null);
  const [del, setDel] = useState<Q | null>(null);
  const [toast, node] = useToast();

  const open = list.filter((x) => !x.answers.length);
  // শিক্ষক/ম্যানেজারভিত্তিক বাকি প্রশ্ন (production এ qa_pending_by_teacher / qa_pending_by_manager)
  const people = (() => {
    const m = new Map<number, { t: Person; list: Q[]; can: number; last: Rem | null; oldest: number }>();
    open.forEach((x) => x.to.forEach((t) => {
      const r = m.get(t.id) ?? { t, list: [], can: 0, last: null, oldest: 0 };
      r.list.push(x); r.oldest = Math.max(r.oldest, x.ago);
      if (canRemind(x, t.id)) r.can++;
      x.reminders.filter((y) => y.to === t.id).forEach((y) => { if (!r.last || y.ago < r.last.ago) r.last = y; });
      m.set(t.id, r);
    }));
    return [...m.values()].sort((a, b) => b.list.length - a.list.length || b.oldest - a.oldest);
  })();
  const inCourse = list.filter((x) => !course || x.course === course);
  const n = (t: string) => inCourse.filter((x) => t === "all" || (t === "open" ? !x.answers.length : x.answers.length)).length;
  const norm = (s: string) => s.normalize("NFC").toLowerCase();
  const rows = inCourse.filter((x) => (tab === "all" || (tab === "open" ? !x.answers.length : x.answers.length))
    && (!q.trim() || norm([x.body, x.user, x.where, ...x.answers.map((a) => a.body)].join(" ")).includes(norm(q.trim()))))
    .sort((a, b) => tab === "open" ? b.ago - a.ago : a.ago - b.ago);

  const remind = (ids: number[], qs: Q[], sms: boolean) => {
    setList((l) => l.map((x) => qs.some((y) => y.id === x.id)
      ? { ...x, reminders: [...x.to.filter((t) => ids.includes(t.id) && canRemind(x, t.id)).map((t) => ({ to: t.id, toName: t.name, by: ME[panel].name, role: panel, ago: 0, sms })), ...x.reminders] } : x));
  };
  const answer = (x: Q) => {
    const body = (draft[x.id] ?? "").trim();
    if (!body) { setAnsErr(x.id); return; }
    setList((l) => l.map((y) => y.id === x.id ? { ...y, answers: [...y.answers, { by: ME[panel].name, role: panel, ago: 0, body }] } : y));
    setDraft((d) => ({ ...d, [x.id]: "" })); setAnsErr(0);
    toast(`উত্তর পাঠানো হয়েছে, ${x.user} নোটিফিকেশন পাবেন (নমুনা)`);
  };

  return (
    <>
      {node}
      <PageHead title={kind === "study" ? "পড়াশোনার প্রশ্ন" : "ভর্তির প্রশ্ন"} sub={SUB[kind][panel]} />
      <SampleNote />
      {/* ম্যানেজার: অ্যাডমিন উত্তর দিতে মনে করিয়ে দিলে উপরে হলুদ ব্যানার (ডেমোর qaReminderBanner) */}
      {kind === "enrollment" && panel === "manager" && (() => {
        const mine = open.flatMap((x) => x.reminders.filter((r) => r.to === ME.manager.id && r.ago < D).map((r) => ({ ...r, q: x.id })));
        if (!mine.length) return null;
        const last = [...mine].sort((a, b) => a.ago - b.ago)[0];
        return (
          <div className="reveal mb-3 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-700 md:mb-6 md:flex-row md:items-center md:p-5 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
            <span className="icon shrink-0 text-3xl text-amber-500">notifications_active</span>
            <div className="grow text-sm"><div className="font-bold">{last.by} ({ROLE[last.role].label}) {bn(new Set(mine.map((r) => r.q)).size)}টি প্রশ্নের উত্তর দিতে মনে করিয়ে দিয়েছেন</div>
              <div className="mt-1 text-xs opacity-80">{last.note ? `"${last.note}" · ` : ""}হলুদ চিহ্ন দেওয়া প্রশ্নগুলো আগে দেখুন।</div></div>
          </div>
        );
      })()}
      {canNotify && people.length > 0 && (
        <div className="reveal card mb-3 p-5 md:mb-6 md:p-6">
          <div className="mb-4"><h3 className="section-title">{who}ভিত্তিক বাকি প্রশ্ন</h3>
            <p className="mt-1 text-xs muted">দেরি হলে {who}কে জানান। তিনি ড্যাশবোর্ডের ঘণ্টা আইকনে দেখবেন, চাইলে SMS ও যাবে। একই প্রশ্নে একই জনকে ৩ ঘণ্টায় একবার জানানো যায়।</p></div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {people.map((r, i) => (
              <div key={r.t.id} className="row-in flex flex-col gap-3 rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4 dark:bg-white/5" style={{ "--i": i } as React.CSSProperties}>
                <div className="flex items-center gap-3"><Avatar name={r.t.name} />
                  <div className="min-w-0 grow"><div className="truncate font-bold">{r.t.name}</div><div className="text-xs muted">সবচেয়ে পুরনোটা {span(r.oldest)} ধরে অপেক্ষায়</div></div>
                  <Badge tone={r.oldest >= D ? "red" : "amber"}>{bn(r.list.length)}টি বাকি</Badge>
                </div>
                <div className="flex items-center gap-1 text-xs muted"><span className="icon text-[16px]">history</span>{r.last ? `শেষ জানানো: ${r.last.by} (${ROLE[r.last.role].label}), ${ago(r.last.ago)}` : "এখনো জানানো হয়নি"}</div>
                <button type="button" className="btn-soft w-full shrink-0 disabled:cursor-not-allowed disabled:opacity-50" disabled={!r.can} onClick={() => setRemindP(r.t)}>
                  <span className="icon text-[18px]">notifications_active</span>{r.can ? `জানান (${bn(r.can)}টি প্রশ্ন)` : "সবগুলো ৩ ঘণ্টার মধ্যে জানানো হয়েছে"}</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="reveal card p-4 md:p-6">
        <div className="mb-3 flex flex-col justify-between gap-3 md:mb-5 xl:flex-row xl:items-center">
          <Tabs value={tab} onChange={setTab} items={[{ key: "open", label: "উত্তর বাকি", count: bn(n("open")) }, { key: "done", label: "উত্তর দেওয়া", count: bn(n("done")) }, { key: "all", label: "সব", count: bn(n("all")) }]} />
          <div className="flex flex-col gap-3 sm:flex-row">
            <SearchBox value={q} onChange={setQ} placeholder="প্রশ্ন বা নাম" />
            <select className="field sm:w-64" aria-label="কোর্স" value={course} onChange={(e) => setCourse(Number(e.target.value))}><option value={0}>সব কোর্স</option>{COURSES.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
          </div>
        </div>
        {rows.length ? (
          <div className="space-y-3 md:space-y-4">
            {rows.map((x, i) => {
              const answered = x.answers.length > 0;
              const canAny = x.to.some((t) => canRemind(x, t.id));
              const wait = x.to.length ? Math.min(...x.to.map((t) => nextIn(x, t.id))) : 0;
              const rems = [...x.reminders].sort((a, b) => a.ago - b.ago);
              // "নতুন": ম্যানেজারকে দেওয়া আজকের রিমাইন্ডার, অ্যাডমিনের কাছে এইমাত্র পাঠানো
              const hot = !answered && (panel === "manager" ? rems.some((r) => r.to === ME.manager.id && r.ago < D) : rems.some((r) => r.ago < 30));
              const notify = canNotify && !answered;
              return (
                <div key={x.id} className={`row-in rounded-2xl border p-4 md:p-5 ${hot ? "border-amber-300 bg-amber-50/50 dark:border-amber-700/60 dark:bg-amber-900/10" : "border-outline-variant/20 bg-surface-container-low dark:bg-white/5"}`} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                  <div className="flex items-start gap-3">
                    <Avatar name={x.user} />
                    <div className="min-w-0 grow">
                      <div className="flex items-start justify-between gap-2">
                        <div><span className="font-bold">{x.user}</span> <span className="text-xs muted">· {ago(x.ago)}</span><div className="text-xs muted">{courseName(x.course)} › {x.where}</div></div>
                        <div className="flex shrink-0 items-center gap-1">
                          {answered ? <Badge tone="green" icon="check_circle">উত্তর দেওয়া</Badge> : <Badge tone={x.ago >= D ? "red" : "amber"} icon="hourglass_top">{span(x.ago)} ধরে অপেক্ষায়</Badge>}
                          {panel === "admin" && <button type="button" className="icon-btn hover:text-error!" title="মুছুন" aria-label="মুছুন" onClick={() => setDel(x)}><span className="icon text-[20px]">delete</span></button>}
                        </div>
                      </div>
                      <p className="mt-2 break-words whitespace-pre-line text-on-background dark:text-background">{x.body}</p>
                      {x.answers.map((a, k) => (
                        <div key={k} className="mt-3 ml-2 border-l-2 border-primary/40 pl-4 dark:border-primary-fixed/40">
                          <div className="text-xs"><span className="font-bold">{a.by}</span> <Badge tone={ROLE[a.role].tone}>{ROLE[a.role].label}</Badge> <span className="muted">· {ago(a.ago)}</span></div>
                          <p className="mt-1 text-sm whitespace-pre-line">{a.body}</p>
                        </div>
                      ))}
                      {!answered && (
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs muted">
                          <span className="inline-flex items-center gap-1"><span className="icon text-[16px]">{kind === "enrollment" ? "support_agent" : "school"}</span>{kind === "enrollment" ? "উত্তর দেবেন: ম্যানেজার বা অ্যাডমিন" : `শিক্ষক: ${x.to.map((t) => t.name).join(", ") || "যুক্ত নেই"}`}</span>
                          {rems.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300"><span className="icon text-[16px]">notifications_active</span>
                              {bn(rems.length)} বার জানানো হয়েছে · শেষ: {rems[0].by} ({ROLE[rems[0].role].label}) → {rems[0].toName}, {ago(rems[0].ago)}{rems[0].sms ? " · SMS সহ" : ""}
                              {hot && <span className="badge border-error bg-error py-0! text-white">নতুন</span>}</span>
                          )}
                        </div>
                      )}
                      {(canAnswer || notify) && (
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          {canAnswer && (
                            <>
                              <input className={`field ${ansErr === x.id ? "border-error!" : ""}`} aria-label="উত্তর" placeholder={answered ? "আরও কিছু যোগ করুন..." : "উত্তর লিখুন..."} value={draft[x.id] ?? ""}
                                onChange={(e) => { setDraft((d) => ({ ...d, [x.id]: e.target.value })); if (ansErr === x.id) setAnsErr(0); }} onKeyDown={(e) => e.key === "Enter" && answer(x)} />
                              <button type="button" className="btn-primary shrink-0" onClick={() => answer(x)}><span className="icon text-[18px]">send</span> উত্তর দিন</button>
                            </>
                          )}
                          {notify && (
                            <button type="button" className="btn-soft shrink-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0" disabled={!canAny} onClick={() => setRemindQ(x)}
                              title={!x.to.length ? "জানানোর মতো কেউ যুক্ত নেই" : canAny ? "উত্তর দিতে মনে করিয়ে দিন" : "একই প্রশ্নে ৩ ঘণ্টায় একবার জানানো যায়"}>
                              <span className="icon text-[18px]">notifications_active</span>{canAny || !x.to.length ? `${who}কে জানান` : `${span(wait)} পরে আবার জানানো যাবে`}</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <EmptyState icon={kind === "enrollment" ? "contact_support" : "forum"} text={tab === "open" && !q ? "সব প্রশ্নের উত্তর দেওয়া হয়েছে 🎉" : "কিছু পাওয়া যায়নি"} />}
      </div>

      {remindQ && <RemindQuestion x={remindQ} who={who} kind={kind} onClose={() => setRemindQ(null)} onSend={(ids, sms) => {
        remind(ids, [remindQ], sms);
        toast(`${remindQ.to.filter((t) => ids.includes(t.id)).map((t) => t.name).join(", ")} কে জানানো হয়েছে${sms ? " (SMS সহ)" : ""}`); setRemindQ(null);
      }} />}
      {remindP && (() => {
        const row = people.find((r) => r.t.id === remindP.id);
        const qs = (row?.list ?? []).filter((x) => canRemind(x, remindP.id)).sort((a, b) => b.ago - a.ago);
        return <RemindPerson p={remindP} qs={qs} skipped={(row?.list.length ?? 0) - qs.length} kind={kind} onClose={() => setRemindP(null)} onSend={(sms) => {
          remind([remindP.id], qs, sms); toast(`${remindP.name} কে ${bn(qs.length)}টি প্রশ্নের কথা জানানো হয়েছে`); setRemindP(null);
        }} />;
      })()}
      <Modal open={!!del} onClose={() => setDel(null)} icon="delete" tone="danger" title="প্রশ্ন মুছবেন?" sub={del?.user}
        actions={[{ label: "বাতিল", kind: "ghost" }, { label: "মুছুন", kind: "danger", onClick: () => { setList((l) => l.filter((y) => y.id !== del?.id)); setDel(null); toast("প্রশ্ন মুছে ফেলা হয়েছে (নমুনা)"); } }]}>
        <p className="rounded-xl bg-surface-container-low p-3 dark:bg-white/5">{del?.body}</p>
      </Modal>
    </>
  );
}

const SmsRow = ({ text, checked, onChange }: { text: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="mt-4 flex cursor-pointer items-start gap-3 select-none"><input type="checkbox" className="chk mt-0.5" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span>SMS ও পাঠান <span className="text-xs muted">({text}, প্রতি SMS প্রায় ৳{bn("0.35")})</span></span></label>
);

// একটা প্রশ্নের জন্য শিক্ষক বা ম্যানেজারকে জানানো
function RemindQuestion({ x, who, kind, onClose, onSend }: { x: Q; who: string; kind: Kind; onClose: () => void; onSend: (ids: number[], sms: boolean) => void }) {
  const [ids, setIds] = useState(x.to.filter((t) => canRemind(x, t.id)).map((t) => t.id));
  const [sms, setSms] = useState(false);
  const [note, setNote] = useState(`${kind === "enrollment" ? "ভর্তি নিয়ে প্রশ্ন" : "শিক্ষার্থী"} ${span(x.ago)} ধরে উত্তরের অপেক্ষায় আছে, দয়া করে দেখে নিন।`);
  return (
    <Modal open onClose={onClose} icon="notifications_active" tone="amber" title={`${who}কে উত্তর দিতে জানান`} sub={courseName(x.course)}
      actions={[{ label: "বাতিল", kind: "ghost" }, { label: "জানান", disabled: !ids.length, onClick: () => onSend(ids, sms) }]}>
      <div className="mb-4 rounded-xl border border-outline-variant/20 bg-surface-container-low p-3 dark:bg-white/5">
        <div className="mb-1 text-xs muted">{x.user} · {span(x.ago)} ধরে অপেক্ষায় · {x.where}</div><p className="text-sm">{x.body}</p></div>
      <div className="label">কাকে জানাবেন</div>
      <div className="mb-4 space-y-2">
        {x.to.map((t) => {
          const ok = canRemind(x, t.id);
          return (
            <label key={t.id} className={`flex items-center gap-3 rounded-xl border border-outline-variant/30 p-3 transition-colors ${ok ? "cursor-pointer hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-primary/5" : "opacity-60"}`}>
              <input type="checkbox" className="chk" disabled={!ok} checked={ids.includes(t.id)} onChange={(e) => setIds((s) => e.target.checked ? [...s, t.id] : s.filter((v) => v !== t.id))} />
              <Avatar name={t.name} size="h-8 w-8" />
              <span className="grow"><span className="block font-bold">{t.name}</span>{!ok && <span className="text-xs muted">{span(nextIn(x, t.id))} পরে আবার জানানো যাবে</span>}</span>
            </label>
          );
        })}
      </div>
      <label className="label" htmlFor="rm-note">বার্তা (ঐচ্ছিক)</label>
      <textarea id="rm-note" className="field min-h-[80px]" value={note} onChange={(e) => setNote(e.target.value)} />
      <SmsRow text={`প্রতি ${who}কে একটা`} checked={sms} onChange={setSms} />
      <p className="mt-3 text-xs muted">{who} তাঁর ড্যাশবোর্ডের ঘণ্টা আইকনে আর প্রশ্নের উপর এই রিমাইন্ডার দেখবেন।</p>
    </Modal>
  );
}

// একজন শিক্ষক বা ম্যানেজারের সব বাকি প্রশ্নের জন্য একবারে (SMS গেলে একটাই)
function RemindPerson({ p, qs, skipped, kind, onClose, onSend }: { p: Person; qs: Q[]; skipped: number; kind: Kind; onClose: () => void; onSend: (sms: boolean) => void }) {
  const [sms, setSms] = useState(false);
  const [note, setNote] = useState(`${bn(qs.length)}টি ${kind === "enrollment" ? "ভর্তির " : ""}প্রশ্নের উত্তর বাকি আছে, দয়া করে দেখে নিন।`);
  return (
    <Modal open onClose={onClose} icon="notifications_active" tone="amber" title={`${p.name} কে জানান`} sub={`${bn(qs.length)}টি ${kind === "enrollment" ? "ভর্তির " : ""}প্রশ্নের উত্তর বাকি`}
      actions={[{ label: "বাতিল", kind: "ghost" }, { label: `জানান (${bn(qs.length)}টি)`, onClick: () => onSend(sms) }]}>
      <div className="custom-scrollbar mb-4 max-h-56 space-y-2 overflow-y-auto">
        {qs.map((x) => (
          <div key={x.id} className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-3 dark:bg-white/5">
            <div className="mb-1 text-xs muted">{x.user} · {span(x.ago)} ধরে অপেক্ষায় · {courseName(x.course)}</div><p className="line-clamp-2 text-sm">{x.body}</p></div>
        ))}
      </div>
      {skipped > 0 && <p className="mb-4 text-xs muted">আরও {bn(skipped)}টি প্রশ্নে গত ৩ ঘণ্টার মধ্যে জানানো হয়েছে, সেগুলো বাদ।</p>}
      <label className="label" htmlFor="rm-note">বার্তা (ঐচ্ছিক)</label>
      <textarea id="rm-note" className="field min-h-[80px]" value={note} onChange={(e) => setNote(e.target.value)} />
      <SmsRow text="সব প্রশ্নের জন্য একটাই" checked={sms} onChange={setSms} />
    </Modal>
  );
}

export function QaView() {
  return <QaBoard kind="study" />;
}
