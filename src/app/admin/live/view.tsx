"use client";

import { useState } from "react";
import Link from "next/link";
import { setLive } from "@/app/live/[id]/actions";
import { bn } from "@/lib/content-schema";
import { COURSES, courseName } from "../_components/sample";
import { Field, Modal, SampleNote, useConfirm, useToast } from "../_components/kit";
import { Badge, EmptyState, PageHead } from "../_components/ui";

type L = { id: number; title: string; course: number; teacher: string; status: "live" | "scheduled" | "ended"; when: string; viewers?: number; started?: string; duration?: string; attendance?: number; recording?: "ready" | "processing" | "none"; sid?: string; courseTitle?: string };
export type RealLive = L;
const START: L[] = [
  { id: 1, title: "ত্রিকোণমিতি: অনুপাতের সমস্যা সমাধান", course: 2, teacher: "রাফিউল ইসলাম", status: "live", when: "এখন", viewers: 182, started: "৭:০০ পিএম থেকে" },
  { id: 2, title: "পদার্থবিজ্ঞান: নিউটনের গতিসূত্র", course: 4, teacher: "তাসনিম আহমেদ", status: "scheduled", when: "আজ, ৯:০০ পিএম" },
  { id: 3, title: "গণিত মডেল টেস্ট রিভিউ", course: 1, teacher: "ফারহানা ইয়াসমিন", status: "scheduled", when: "আগামীকাল, ৫:০০ পিএম" },
  { id: 4, title: "রসায়ন: জৈব যৌগের নামকরণ", course: 3, teacher: "মাহমুদুল হাসান", status: "ended", when: "গতকাল, ৮:০০ পিএম", duration: "১ ঘণ্টা ২০ মিনিট", attendance: 214, recording: "ready" },
  { id: 5, title: "ইংরেজি গ্রামার ওয়ার্কশপ", course: 1, teacher: "ফারহানা ইয়াসমিন", status: "ended", when: "২ দিন আগে, ৬:০০ পিএম", duration: "৫৫ মিনিট", attendance: 167, recording: "processing" },
];

// লাইভ ক্লাস (admin_dashboard.html এর live): এখন লাইভ, আসন্ন, শেষ হওয়া ক্লাস।
// আসল সেশন থাকলে সেগুলো (যোগ দিন → /live/id, শেষ করুন → end_live); না থাকলে নমুনা। শিডিউল আর উপস্থিতির তালিকা এখনো নমুনা
export function LiveView({ real }: { real: L[] }) {
  const [list, setList] = useState(real.length ? real : START);
  const cname = (l: L) => l.courseTitle ?? courseName(l.course);
  const [open, setOpen] = useState(false);
  const [att, setAtt] = useState<L | null>(null);
  const [toast, node] = useToast();
  const [ask, askNode] = useConfirm();
  const now = list.filter((l) => l.status === "live");
  const up = list.filter((l) => l.status === "scheduled");
  const past = list.filter((l) => l.status === "ended");
  const rec = (l: L) => l.recording === "ready" ? <Badge tone="green" icon="video_library">রেকর্ডিং লেসনে যুক্ত</Badge> : l.recording === "processing" ? <Badge tone="amber" icon="hourglass_top">রেকর্ডিং প্রসেস হচ্ছে</Badge> : <Badge tone="gray">রেকর্ডিং নেই</Badge>;
  return (
    <>
      {node}{askNode}
      <PageHead title="লাইভ ক্লাস" sub="চলমান ক্লাসে মডারেটর হিসেবে যোগ দিন, শিডিউল করুন আর উপস্থিতি দেখুন">
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}><span className="icon text-[18px]">calendar_add_on</span> নতুন ক্লাস শিডিউল</button>
      </PageHead>
      {!real.length && <SampleNote />}
      <div className="reveal mb-4 md:mb-8">
        <h3 className="section-title mb-3 flex items-center gap-2 md:mb-4">
          <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-error" /></span>
          এখন লাইভ
        </h3>
        <div className="grid grid-cols-1 gap-3 md:gap-6 xl:grid-cols-2">
          {now.length ? now.map((l) => (
            <div key={l.id} className="tilt-card card relative overflow-hidden rounded-2xl! border-error/30! p-6">
              <div className="pointer-events-none absolute top-0 right-0 h-40 w-40 -translate-y-1/2 translate-x-1/4 rounded-full bg-error/10 blur-3xl" />
              <div className="relative mb-4 flex items-start justify-between gap-4">
                <div>
                  <span className="mb-3"><Badge tone="red"><span className="h-2 w-2 animate-pulse rounded-full bg-error" />লাইভ</Badge></span>
                  <h4 className="mt-3 text-lg font-bold text-on-background dark:text-background">{l.title}</h4>
                  <p className="mt-1 text-xs muted">{cname(l)} · {l.teacher}</p>
                  <p className="mt-1 text-[11px] muted">ধরন: Broadcast (Facebook Live এর মতো)</p>
                </div>
                <div className="shrink-0 rounded-xl bg-surface-container-low p-3 text-center dark:bg-white/5"><div className="text-2xl font-bold text-error">{bn(l.viewers ?? 0)}</div><div className="text-[11px] muted">জন আছে</div></div>
              </div>
              <p className="relative mb-5 flex items-center gap-1 text-xs muted"><span className="icon text-[14px]">schedule</span>{l.started}</p>
              <div className="relative flex gap-2">
                {l.sid ? <Link href={`/live/${l.sid}`} className="btn-primary flex-1"><span className="icon text-[18px]">login</span> মডারেটর হিসেবে যোগ দিন</Link>
                  : <button type="button" className="btn-primary flex-1" onClick={() => toast("মডারেটর হিসেবে যুক্ত হচ্ছেন…", "info")}><span className="icon text-[18px]">login</span> মডারেটর হিসেবে যোগ দিন</button>}
                <button type="button" className="btn-outline text-error!" onClick={async () => { if (await ask({ title: "ক্লাস শেষ করবেন?", sub: l.title, tone: "danger", icon: "stop_circle", ok: "ক্লাস শেষ করুন", body: "সবার জন্য ক্লাস বন্ধ হবে। রেকর্ডিং প্রসেস হয়ে লেসনে যুক্ত হবে।" })) { if (l.sid) { const r = await setLive(l.sid, false); if (r.error) { toast(r.error, "info"); return; } toast("ক্লাস শেষ করা হয়েছে"); } setList((s) => s.map((x) => (x.id === l.id ? { ...x, status: "ended", duration: "এইমাত্র শেষ", attendance: l.viewers, recording: "processing" } : x))); } }}><span className="icon text-[18px]">stop_circle</span> শেষ করুন</button>
              </div>
            </div>
          )) : <div className="card p-6 xl:col-span-2"><EmptyState icon="videocam_off" text="এই মুহূর্তে কোনো লাইভ ক্লাস নেই" /></div>}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:gap-6 2xl:grid-cols-2">
        <div className="reveal card p-4 md:p-6">
          <h3 className="section-title mb-4">আসন্ন ক্লাস</h3>
          {up.length ? (
            <div className="space-y-3">
              {up.map((l, i) => (
                <div key={l.id} className="row-in flex items-center gap-4 rounded-xl border border-outline-variant/20 p-3 hover:bg-surface-container-low dark:hover:bg-white/5" style={{ "--i": i } as React.CSSProperties}>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-container-highest text-on-surface-variant dark:bg-outline-variant/20"><span className="icon">event</span></div>
                  <div className="min-w-0 grow"><h4 className="truncate text-sm font-bold">{l.title}</h4><p className="mt-0.5 text-xs muted">{l.when} · {l.teacher}</p><p className="truncate text-xs muted">{cname(l)}</p></div>
                  {/* আসল ক্লাস শিক্ষক নিজে ক্যামেরা চালু করে শুরু করেন; অ্যাডমিন পাতাটা খুলে দেখতে পারেন */}
                  {l.sid ? <Link href={`/live/${l.sid}`} className="btn-soft shrink-0 px-3! py-1.5!">খুলুন</Link>
                    : <button type="button" className="btn-soft shrink-0 px-3! py-1.5!" onClick={() => setList((s) => s.map((x) => (x.id === l.id ? { ...x, status: "live", viewers: 0, started: "এইমাত্র শুরু" } : x)))}>শুরু</button>}
                  {/* আসল ক্লাস বাতিল হয় "ক্লাস" পাতা থেকে (cancel_class), তাই এখানে শুধু নমুনায় */}
                  {!l.sid && (<button type="button" className="icon-btn hover:text-error!" title="বাতিল" aria-label="বাতিল" onClick={async () => { if (await ask({ title: "ক্লাস বাতিল করবেন?", sub: l.title, tone: "danger", icon: "event_busy", ok: "হ্যাঁ, বাতিল", body: "শিক্ষার্থী আর শিক্ষককে জানানো হবে। বাতিল ক্লাসের জন্য শিক্ষক সম্মানী পাবেন না।" })) setList((s) => s.filter((x) => x.id !== l.id)); }}><span className="icon text-[20px]">event_busy</span></button>)}
                </div>
              ))}
            </div>
          ) : <EmptyState icon="event_available" text="কোনো ক্লাস শিডিউল করা নেই" />}
        </div>
        <div className="reveal card p-4 md:p-6">
          <h3 className="section-title mb-4">শেষ হওয়া ক্লাস</h3>
          {past.length ? (
            <div className="space-y-3">
              {past.map((l, i) => (
                <div key={l.id} className="row-in rounded-xl border border-outline-variant/20 p-3" style={{ "--i": i } as React.CSSProperties}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><h4 className="text-sm font-bold">{l.title}</h4><p className="mt-0.5 text-xs muted">{l.when} · {l.duration} · {l.teacher}</p></div>
                    <button type="button" className="btn-outline shrink-0 px-3! py-1.5!" onClick={() => setAtt(l)}><span className="icon text-[16px]">groups</span>{bn(l.attendance ?? 0)}</button>
                  </div>
                  <div className="mt-2">{rec(l)}</div>
                </div>
              ))}
            </div>
          ) : <EmptyState icon="history" text="এখনো কোনো ক্লাস হয়নি" />}
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} icon="calendar_add_on" title="নতুন ক্লাস শিডিউল" sub="শিক্ষার্থীরা কোর্সের পাতায় সময় দেখবে"
        actions={[{ label: "বাতিল", kind: "ghost" }, { label: "শিডিউল করুন", onClick: () => { setOpen(false); toast("ক্লাস শিডিউল হয়েছে (নমুনা)"); } }]}>
        <div className="space-y-4">
          <Field id="lv-title" label="ক্লাসের শিরোনাম"><input id="lv-title" className="field" placeholder="যেমন: ত্রিকোণমিতি, অধ্যায় ৩" /></Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="lv-course" label="কোর্স"><select id="lv-course" className="field">{COURSES.map((c) => <option key={c.id}>{c.title}</option>)}</select></Field>
            <Field id="lv-teacher" label="শিক্ষক"><select id="lv-teacher" className="field"><option>রাফিউল ইসলাম</option><option>তাসনিম আহমেদ</option><option>ফারহানা ইয়াসমিন</option></select></Field>
          </div>
          <Field id="lv-when" label="তারিখ ও সময়"><input id="lv-when" type="datetime-local" className="field" /></Field>
        </div>
      </Modal>
      <Modal open={!!att} onClose={() => setAtt(null)} icon="groups" title="উপস্থিতি" sub={att?.title} actions={[{ label: "বন্ধ করুন", kind: "ghost" }]}>
        <p className="text-sm muted">মোট <b className="text-on-background dark:text-background">{bn(att?.attendance ?? 0)} জন</b> যোগ দিয়েছিলেন। নাম ধরে তালিকা কাজ জোড়ার সময় আসবে।</p>
      </Modal>
    </>
  );
}
