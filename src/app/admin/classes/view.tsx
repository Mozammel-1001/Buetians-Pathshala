"use client";

import { useState } from "react";
import { bn, taka } from "@/lib/content-schema";
import { COURSES, TEACHERS, courseName } from "../_components/sample";
import { Field, Modal, SampleNote, Tabs, useToast } from "../_components/kit";
import { Avatar, Badge, EmptyState, PageHead, type Tone } from "../_components/ui";

type C = { id: number; teacher: number; course: number; topic: string; when: string; wd: string; type: "live" | "offline" | "doubt"; rate: number; status: "assigned" | "done" | "cancelled" };
const START: C[] = [
  { id: 1, teacher: 1, course: 2, topic: "ত্রিকোণমিতি: অনুপাতের সমস্যা", when: "২১ নভেম্বর", wd: "শনিবার, ৮:০০ পিএম", type: "live", rate: 800, status: "assigned" },
  { id: 2, teacher: 2, course: 4, topic: "নিউটনের গতিসূত্র", when: "২২ নভেম্বর", wd: "রবিবার, ৯:০০ পিএম", type: "live", rate: 800, status: "assigned" },
  { id: 3, teacher: 3, course: 1, topic: "মডেল টেস্ট রিভিউ", when: "২৩ নভেম্বর", wd: "সোমবার, ৫:০০ পিএম", type: "doubt", rate: 500, status: "assigned" },
  { id: 4, teacher: 4, course: 3, topic: "জৈব যৌগের নামকরণ", when: "১৮ নভেম্বর", wd: "বুধবার, ৮:০০ পিএম", type: "live", rate: 800, status: "done" },
  { id: 5, teacher: 1, course: 2, topic: "বীজগণিত: দ্বিঘাত সমীকরণ", when: "১৬ নভেম্বর", wd: "সোমবার, ৮:০০ পিএম", type: "live", rate: 800, status: "done" },
  { id: 6, teacher: 2, course: 4, topic: "তাপগতিবিদ্যা", when: "১৪ নভেম্বর", wd: "শনিবার, ৯:০০ পিএম", type: "offline", rate: 1000, status: "cancelled" },
];
const TYPE: Record<C["type"], [string, Tone]> = { live: ["লাইভ ক্লাস", "blue"], offline: ["অফলাইন", "purple"], doubt: ["ডাউট সেশন", "amber"] };
const ST: Record<C["status"], [string, Tone, string]> = { assigned: ["সামনে", "amber", "schedule"], done: ["নেওয়া হয়েছে", "green", "check_circle"], cancelled: ["বাতিল", "red", "cancel"] };

// ক্লাস অ্যাসাইন (admin_dashboard.html এর classes): শিক্ষকের কার্ড, ক্লাসের তালিকা, অ্যাসাইন modal। ধাপ ১: শুধু UI
export function ClassesView() {
  const [list, setList] = useState(START);
  const [tab, setTab] = useState<"upcoming" | "done" | "cancelled" | "all">("upcoming");
  const [teacher, setTeacher] = useState(0);
  const [course, setCourse] = useState(0);
  const [open, setOpen] = useState(false);
  const [toast, node] = useToast();
  const [cancel, setCancel] = useState<C | null>(null);
  const [move, setMove] = useState<C | null>(null);
  const base = list.filter((c) => (!teacher || c.teacher === teacher) && (!course || c.course === course));
  const want = { upcoming: "assigned", done: "done", cancelled: "cancelled", all: "" }[tab];
  const rows = base.filter((c) => !want || c.status === want);
  const n = (s: string) => bn(base.filter((c) => !s || c.status === s).length);
  return (
    <>
      {node}
      <PageHead title="ক্লাস অ্যাসাইন" sub="কোন শিক্ষক কবে কোন ক্লাস নেবেন ঠিক করুন। নেওয়া ক্লাসের হিসাবেই শিক্ষকের সম্মানী হয়।">
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}><span className="icon text-[18px]">assignment_ind</span> ক্লাস অ্যাসাইন করুন</button>
      </PageHead>
      <SampleNote />
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:mb-6 md:gap-4 2xl:grid-cols-4">
        {TEACHERS.map((t, i) => {
          const mine = list.filter((c) => c.teacher === t.id);
          return (
            <div key={t.id} className="reveal h-full" style={{ transitionDelay: `${i * 80}ms` }}>
              <div className={`tilt-card card h-full cursor-pointer rounded-2xl! p-5 ${teacher === t.id ? "border-primary!" : ""}`} onClick={() => setTeacher(teacher === t.id ? 0 : t.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setTeacher(teacher === t.id ? 0 : t.id)}>
                <div className="mb-4 flex items-center gap-3"><Avatar name={t.name} /><div className="min-w-0"><div className="truncate font-bold">{t.name}</div><div className="truncate text-xs muted">{t.dept}</div></div></div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl bg-surface-container-low p-2 dark:bg-white/5"><div className="font-bold text-primary dark:text-primary-fixed">{bn(mine.filter((c) => c.status === "done").length)}</div><div className="text-[11px] muted">এই মাসে নিয়েছেন</div></div>
                  <div className="rounded-xl bg-surface-container-low p-2 dark:bg-white/5"><div className="font-bold">{bn(mine.filter((c) => c.status === "assigned").length)}</div><div className="text-[11px] muted">সামনে আছে</div></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="reveal card p-4 md:p-6">
        <div className="mb-3 flex flex-col justify-between gap-3 md:mb-5 xl:flex-row xl:items-center">
          <Tabs value={tab} onChange={setTab} items={[{ key: "upcoming", label: "সামনের ক্লাস", count: n("assigned") }, { key: "done", label: "নেওয়া হয়েছে", count: n("done") }, { key: "cancelled", label: "বাতিল", count: n("cancelled") }, { key: "all", label: "সব", count: n("") }]} />
          <div className="flex flex-col gap-3 sm:flex-row">
            <select className="field sm:w-52" aria-label="শিক্ষক" value={teacher} onChange={(e) => setTeacher(Number(e.target.value))}><option value={0}>সব শিক্ষক</option>{TEACHERS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <select className="field sm:w-56" aria-label="কোর্স" value={course} onChange={(e) => setCourse(Number(e.target.value))}><option value={0}>সব কোর্স</option>{COURSES.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
          </div>
        </div>
        {rows.length ? (
          <div className="custom-scrollbar -mx-2 overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead><tr className="border-b border-outline-variant/20"><th className="th">সময়</th><th className="th">শিক্ষক</th><th className="th">কোর্স ও বিষয়</th><th className="th">ধরন</th><th className="th">সম্মানী</th><th className="th">স্ট্যাটাস</th><th className="th text-right">অ্যাকশন</th></tr></thead>
              <tbody className="divide-y divide-outline-variant/10">
                {rows.map((c, i) => (
                  <tr key={c.id} className="row-in hover:bg-surface-container-low/60 dark:hover:bg-white/5" style={{ "--i": i } as React.CSSProperties}>
                    <td className="td whitespace-nowrap"><div className="font-bold">{c.when}</div><div className="text-xs muted">{c.wd}</div></td>
                    <td className="td"><div className="flex items-center gap-2"><Avatar name={TEACHERS.find((t) => t.id === c.teacher)!.name} size="h-8 w-8 text-sm" /><span className="font-bold whitespace-nowrap">{TEACHERS.find((t) => t.id === c.teacher)!.name}</span></div></td>
                    <td className="td max-w-[240px]"><div className="font-bold">{c.topic}</div><div className="truncate text-xs muted">{courseName(c.course)}</div></td>
                    <td className="td"><Badge tone={TYPE[c.type][1]}>{TYPE[c.type][0]}</Badge></td>
                    <td className="td font-bold whitespace-nowrap">{taka(c.rate)}</td>
                    <td className="td"><Badge tone={ST[c.status][1]} icon={ST[c.status][2]}>{ST[c.status][0]}</Badge></td>
                    <td className="td"><div className="flex justify-end gap-1">{c.status === "assigned" && (<>
                      <button type="button" className="icon-btn" title="অন্য শিক্ষককে দিন" aria-label="অন্য শিক্ষককে দিন" onClick={() => setMove(c)}><span className="icon text-[20px]">swap_horiz</span></button>
                      <button type="button" className="icon-btn hover:text-error!" title="বাতিল" aria-label="বাতিল" onClick={() => setCancel(c)}><span className="icon text-[20px]">event_busy</span></button></>)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon="event_available" text="এখানে কোনো ক্লাস নেই" />}
      </div>
      <Modal open={!!cancel} onClose={() => setCancel(null)} icon="event_busy" tone="danger" title="ক্লাস বাতিল করবেন?" sub={cancel ? `${cancel.topic} · ${cancel.when}` : ""}
        actions={[{ label: "ফিরে যান", kind: "ghost" }, { label: "ক্লাস বাতিল", kind: "danger", onClick: () => { const id = cancel?.id; setList((s) => s.map((x) => (x.id === id ? { ...x, status: "cancelled" } : x))); setCancel(null); toast("ক্লাস বাতিল হয়েছে (নমুনা)"); } }]}>
        <div className="space-y-3">
          <Field id="cl-why" label="কারণ"><input id="cl-why" className="field" placeholder="যেমন: শিক্ষক অসুস্থ" /></Field>
          <p className="text-xs muted">বাতিল ক্লাসের জন্য শিক্ষক সম্মানী পাবেন না। শিক্ষক SMS এ জানবেন।</p>
        </div>
      </Modal>
      <Modal open={!!move} onClose={() => setMove(null)} icon="swap_horiz" title="অন্য শিক্ষককে দিন" sub={move ? `${move.topic} · ${move.when}` : ""}
        actions={[{ label: "বাতিল", kind: "ghost" }, { label: "বদলে দিন", onClick: () => { setMove(null); toast("অন্য শিক্ষককে দেওয়া হয়েছে (নমুনা)"); } }]}>
        <div className="space-y-3">
          <p className="text-sm muted">এখন আছেন: <b className="text-on-background dark:text-background">{move ? TEACHERS.find((t) => t.id === move.teacher)?.name : ""}</b></p>
          <Field id="cl-to" label="নতুন শিক্ষক"><select id="cl-to" className="field">{TEACHERS.filter((t) => t.id !== move?.teacher).map((t) => <option key={t.id}>{t.name}</option>)}</select></Field>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" defaultChecked className="accent-[var(--color-primary)]" /> দুই শিক্ষককেই SMS এ জানান</label>
        </div>
      </Modal>
      <Modal open={open} onClose={() => setOpen(false)} icon="assignment_ind" title="ক্লাস অ্যাসাইন" sub="শিক্ষক SMS আর নিজের ড্যাশবোর্ডে ক্লাসটি দেখবেন"
        actions={[{ label: "বাতিল", kind: "ghost" }, { label: "অ্যাসাইন করুন", onClick: () => { setOpen(false); toast("ক্লাস অ্যাসাইন হয়েছে (নমুনা)"); } }]}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="as-teacher" label="শিক্ষক"><select id="as-teacher" className="field">{TEACHERS.map((t) => <option key={t.id}>{t.name}</option>)}</select></Field>
            <Field id="as-course" label="কোর্স"><select id="as-course" className="field">{COURSES.map((c) => <option key={c.id}>{c.title}</option>)}</select></Field>
          </div>
          <Field id="as-topic" label="ক্লাসের বিষয়"><input id="as-topic" className="field" placeholder="যেমন: ত্রিকোণমিতি, অধ্যায় ৩" /></Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field id="as-type" label="ধরন"><select id="as-type" className="field">{Object.values(TYPE).map((t) => <option key={t[0]}>{t[0]}</option>)}</select></Field>
            <div className="sm:col-span-2"><Field id="as-when" label="তারিখ ও সময়"><input id="as-when" type="datetime-local" className="field" /></Field></div>
          </div>
          <Field id="as-rate" label="এই ক্লাসের সম্মানী (৳)"><input id="as-rate" type="number" min={0} step={50} className="field" defaultValue={800} /></Field>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" defaultChecked className="accent-[var(--color-primary)]" /> শিক্ষককে SMS এ জানান</label>
        </div>
      </Modal>
    </>
  );
}
