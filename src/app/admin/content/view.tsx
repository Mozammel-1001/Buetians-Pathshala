"use client";

import { useState } from "react";
import { bn } from "@/lib/content-schema";
import { COURSES, courseName } from "../_components/sample";
import { Field, Modal, SampleNote, SearchBox, Switch, Tabs, useConfirm, useToast } from "../_components/kit";
import { Badge, EmptyState, PageHead, type Tone } from "../_components/ui";

type V = { id: number; title: string; course: number; section: string; duration: string; by: string; time: string; status: "ready" | "processing" | "uploading" | "failed"; progress?: number; preview: boolean };
type M = { id: number; title: string; course: number; type: "sheet" | "bank" | "solution" | "formula"; chapter: string; pages: number; by: string; time: string };
const VIDEOS: V[] = [
  { id: 1, title: "ত্রিকোণমিতি: মৌলিক অনুপাত", course: 2, section: "অধ্যায় ৩", duration: "৪৫:১২", by: "রাফিউল ইসলাম", time: "২ দিন আগে", status: "ready", preview: true },
  { id: 2, title: "নিউটনের গতিসূত্র, প্রথম সূত্র", course: 4, section: "অধ্যায় ২", duration: "৩৮:৪০", by: "তাসনিম আহমেদ", time: "আজ", status: "processing", preview: false },
  { id: 3, title: "জৈব যৌগের নামকরণ", course: 3, section: "অধ্যায় ৫", duration: "—", by: "মাহমুদুল হাসান", time: "এইমাত্র", status: "uploading", progress: 62, preview: false },
  { id: 4, title: "ইংরেজি গ্রামার: Tense", course: 1, section: "অধ্যায় ১", duration: "—", by: "ফারহানা ইয়াসমিন", time: "গতকাল", status: "failed", preview: false },
];
const MATS: M[] = [
  { id: 1, title: "ত্রিকোণমিতি লেকচার শিট", course: 2, type: "sheet", chapter: "অধ্যায় ৩", pages: 14, by: "রাফিউল ইসলাম", time: "৩ দিন আগে" },
  { id: 2, title: "পদার্থবিজ্ঞান প্রশ্নব্যাংক ২০২৫", course: 4, type: "bank", chapter: "সব অধ্যায়", pages: 48, by: "তাসনিম আহমেদ", time: "১ সপ্তাহ আগে" },
  { id: 3, title: "মডেল টেস্ট ০২ এর সমাধান", course: 1, type: "solution", chapter: "—", pages: 9, by: "ফারহানা ইয়াসমিন", time: "গতকাল" },
  { id: 4, title: "রসায়ন সূত্র ও সারসংক্ষেপ", course: 3, type: "formula", chapter: "অধ্যায় ১-৫", pages: 6, by: "মাহমুদুল হাসান", time: "আজ" },
];
const VST: Record<V["status"], [string, Tone, string]> = { ready: ["রেডি", "green", "check_circle"], processing: ["প্রসেসিং", "amber", "hourglass_top"], uploading: ["আপলোড হচ্ছে", "blue", "cloud_upload"], failed: ["ব্যর্থ", "red", "error"] };
const MT: Record<M["type"], { label: string; icon: string; cls: string }> = {
  sheet: { label: "লেকচার শিট", icon: "description", cls: "bg-blue-100 text-blue-600" },
  bank: { label: "প্রশ্নব্যাংক", icon: "quiz", cls: "bg-purple-100 text-purple-600" },
  solution: { label: "সমাধান", icon: "task_alt", cls: "bg-emerald-100 text-emerald-600" },
  formula: { label: "সূত্র ও সারসংক্ষেপ", icon: "functions", cls: "bg-amber-100 text-amber-600" },
};

// ভিডিও ও ম্যাটেরিয়াল (admin_dashboard.html এর content): ভিডিও লেসন আর PDF ম্যাটেরিয়াল। ধাপ ১: শুধু UI
export function ContentView() {
  const [tab, setTab] = useState<"videos" | "materials">("videos");
  const [videos, setVideos] = useState(VIDEOS);
  const [mats, setMats] = useState(MATS);
  const [q, setQ] = useState("");
  const [course, setCourse] = useState(0);
  const [status, setStatus] = useState("all");
  const [kind, setKind] = useState("all");
  const [modal, setModal] = useState<"video" | "material" | null>(null);
  const [toast, node] = useToast();
  const [ask, askNode] = useConfirm();
  const [play, setPlay] = useState<V | null>(null);
  const [editM, setEditM] = useState<M | null>(null);
  const ok = (x: { title: string; course: number }) => (!course || x.course === course) && (!q || x.title.includes(q));
  const vrows = videos.filter((v) => ok(v) && (status === "all" || v.status === status));
  const mrows = mats.filter((m) => ok(m) && (kind === "all" || m.type === kind));
  return (
    <>
      {node}{askNode}
      <PageHead title="ভিডিও ও ম্যাটেরিয়াল" sub="সব কোর্সের রেকর্ডেড ভিডিও (Bunny Stream) আর PDF ম্যাটেরিয়াল এক জায়গায়">
        <button type="button" className="btn-soft" onClick={() => setModal("material")}><span className="icon text-[18px]">upload_file</span> ম্যাটেরিয়াল</button>
        <button type="button" className="btn-primary" onClick={() => setModal("video")}><span className="icon text-[18px]">video_file</span> ভিডিও আপলোড</button>
      </PageHead>
      <SampleNote />
      <div className="reveal card p-4 md:p-6">
        <div className="mb-3 flex flex-col justify-between gap-3 md:mb-5 xl:flex-row xl:items-center">
          <Tabs value={tab} onChange={setTab} items={[{ key: "videos", label: "ভিডিও লেসন", count: bn(videos.length) }, { key: "materials", label: "স্টাডি ম্যাটেরিয়াল", count: bn(mats.length) }]} />
          <div className="flex flex-col gap-3 sm:flex-row">
            <SearchBox value={q} onChange={setQ} placeholder="শিরোনাম খুঁজুন" width="sm:w-56" />
            <select className="field sm:w-52" aria-label="কোর্স" value={course} onChange={(e) => setCourse(Number(e.target.value))}><option value={0}>সব কোর্স</option>{COURSES.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
            {tab === "videos" ? (
              <select className="field sm:w-40" aria-label="স্ট্যাটাস" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">সব স্ট্যাটাস</option><option value="ready">রেডি</option><option value="processing">প্রসেসিং</option><option value="uploading">আপলোড হচ্ছে</option><option value="failed">ব্যর্থ</option></select>
            ) : (
              <select className="field sm:w-48" aria-label="ধরন" value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">সব ধরন</option>{Object.entries(MT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
            )}
          </div>
        </div>
        {tab === "videos" ? (vrows.length ? (
          <div className="space-y-3">
            {vrows.map((l, i) => (
              <div key={l.id} className="row-in flex flex-col justify-between gap-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4 sm:flex-row sm:items-center dark:bg-white/5" style={{ "--i": i } as React.CSSProperties}>
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><span className="icon">smart_display</span></div>
                  <div className="min-w-0">
                    <h4 className="truncate font-bold text-on-background dark:text-background">{l.title}</h4>
                    <p className="mt-1 text-xs muted">{courseName(l.course)} · {l.section} · {l.duration} · {l.by}, {l.time}</p>
                    {l.status === "uploading" && <div className="mt-2 h-1.5 w-48 rounded-full bg-surface-container-highest dark:bg-on-surface-variant"><div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${l.progress}%` }} /></div>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  <Badge tone={VST[l.status][1]} icon={VST[l.status][2]}>{VST[l.status][0]}</Badge>
                  <Switch checked={l.preview} disabled={l.status !== "ready"} onChange={(v) => setVideos((s) => s.map((x) => (x.id === l.id ? { ...x, preview: v } : x)))} label="ফ্রি প্রিভিউ" />
                  {l.status === "ready" && <button type="button" className="icon-btn" title="চালিয়ে দেখুন" aria-label="চালিয়ে দেখুন" onClick={() => setPlay(l)}><span className="icon text-[20px]">play_circle</span></button>}
                  {l.status === "failed" && <button type="button" className="icon-btn" title="আবার প্রসেস করুন" aria-label="আবার প্রসেস করুন" onClick={() => toast("আবার প্রসেস শুরু হয়েছে (নমুনা)", "info")}><span className="icon text-[20px]">refresh</span></button>}
                  <button type="button" className="icon-btn hover:text-error!" title="মুছুন" aria-label="মুছুন" onClick={async () => { if (await ask({ title: "ভিডিও মুছে ফেলা", sub: l.title, tone: "danger", icon: "delete", ok: "হ্যাঁ, মুছুন", body: "Bunny Stream থেকেও মুছে যাবে, শিক্ষার্থীরা আর দেখতে পারবে না।" })) setVideos((s) => s.filter((x) => x.id !== l.id)); }}><span className="icon text-[20px]">delete</span></button>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState icon="video_library" text="কোনো ভিডিও পাওয়া যায়নি" />) : (mrows.length ? (
          <div className="space-y-3">
            {mrows.map((m, i) => (
              <div key={m.id} className="row-in flex flex-col justify-between gap-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4 sm:flex-row sm:items-center dark:bg-white/5" style={{ "--i": i } as React.CSSProperties}>
                <div className="flex min-w-0 items-center gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${MT[m.type].cls}`}><span className="icon">{MT[m.type].icon}</span></div>
                  <div className="min-w-0">
                    <h4 className="truncate font-bold text-on-background dark:text-background">{m.title}</h4>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs muted"><Badge tone="gray">{MT[m.type].label}</Badge>{courseName(m.course)} · {m.chapter} · {bn(m.pages)} পৃষ্ঠা · {m.by}, {m.time}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" className="icon-btn" title="ধরন বা অধ্যায় বদলান" aria-label="সম্পাদনা" onClick={() => setEditM(m)}><span className="icon text-[20px]">edit</span></button>
                  <button type="button" className="icon-btn" title="ডাউনলোড" aria-label="ডাউনলোড" onClick={() => toast("ডাউনলোড লিংক তৈরি হচ্ছে...", "info")}><span className="icon text-[20px]">download</span></button>
                  <button type="button" className="icon-btn hover:text-error!" title="মুছুন" aria-label="মুছুন" onClick={async () => { if (await ask({ title: "ম্যাটেরিয়াল মুছে ফেলা", sub: m.title, tone: "danger", icon: "delete", ok: "হ্যাঁ, মুছুন" })) setMats((s) => s.filter((x) => x.id !== m.id)); }}><span className="icon text-[20px]">delete</span></button>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState icon="folder_off" text="কোনো ম্যাটেরিয়াল পাওয়া যায়নি" />)}
      </div>

      <Modal open={!!play} onClose={() => setPlay(null)} icon="play_circle" title={play?.title ?? ""} sub={play ? `${courseName(play.course)} · ${play.duration}` : ""} size="max-w-2xl" actions={[{ label: "বন্ধ করুন", kind: "ghost" }]}>
        <div className="grid aspect-video place-items-center rounded-2xl bg-black text-center text-sm text-white/70"><div><span className="icon text-5xl">play_circle</span><p className="mt-2">এখানে Bunny Stream প্লেয়ার (token সহ) চলবে</p></div></div>
      </Modal>
      <Modal open={!!editM} onClose={() => setEditM(null)} icon="edit" title="ধরন বা অধ্যায় বদলান" sub={editM?.title}
        actions={[{ label: "বাতিল", kind: "ghost" }, { label: "সেভ করুন", onClick: () => { setEditM(null); toast("ম্যাটেরিয়ালের ধরন/অধ্যায় বদল হয়েছে (নমুনা)"); } }]}>
        <div className="space-y-4" key={editM?.id}>
          <div className="grid grid-cols-2 gap-2">{Object.entries(MT).map(([k, v]) => <label key={k} className="flex cursor-pointer items-center gap-2 rounded-xl border border-outline-variant/30 p-3 text-sm font-bold has-[:checked]:border-primary has-[:checked]:bg-primary/5"><input type="radio" name="em-type" defaultChecked={editM?.type === k} className="accent-[var(--color-primary)]" /><span className="icon text-[18px]">{v.icon}</span>{v.label}</label>)}</div>
          <Field id="em-ch" label="অধ্যায়/সেকশন"><input id="em-ch" className="field" defaultValue={editM?.chapter} /></Field>
          <p className="text-xs muted">ধরন আর অধ্যায় বেছে দিন, শিক্ষার্থীরা সেভাবেই সাজানো দেখবে।</p>
        </div>
      </Modal>
      <Modal open={modal === "video"} onClose={() => setModal(null)} icon="video_file" title="ভিডিও আপলোড" sub="Bunny Stream এ আপলোড হবে, তারপর নিজে প্রসেস হবে"
        actions={[{ label: "বাতিল", kind: "ghost" }, { label: "আপলোড শুরু করুন", onClick: () => { setModal(null); toast("আপলোড শুরু হয়েছে (নমুনা)"); } }]}>
        <div className="space-y-4">
          <Field id="vu-title" label="শিরোনাম"><input id="vu-title" className="field" placeholder="যেমন: ত্রিকোণমিতি, অধ্যায় ৩" /></Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="vu-course" label="কোর্স"><select id="vu-course" className="field">{COURSES.map((c) => <option key={c.id}>{c.title}</option>)}</select></Field>
            <Field id="vu-sec" label="অধ্যায়"><input id="vu-sec" className="field" placeholder="অধ্যায় ৩" /></Field>
          </div>
          <label htmlFor="vu-file" className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-outline-variant/50 p-6 text-center hover:border-primary"><span className="icon text-3xl text-primary dark:text-primary-fixed">cloud_upload</span><span className="text-sm font-bold">ভিডিও ফাইল বাছুন</span><input id="vu-file" type="file" accept="video/*" className="sr-only" /></label>
        </div>
      </Modal>
      <Modal open={modal === "material"} onClose={() => setModal(null)} icon="upload_file" title="ম্যাটেরিয়াল আপলোড" sub="শুধু PDF"
        actions={[{ label: "বাতিল", kind: "ghost" }, { label: "আপলোড করুন", onClick: () => { setModal(null); toast("আপলোড হয়েছে (নমুনা)"); } }]}>
        <div className="space-y-4">
          <Field id="mu-title" label="শিরোনাম"><input id="mu-title" className="field" placeholder="যেমন: ত্রিকোণমিতি লেকচার শিট" /></Field>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(MT).map(([k, v], i) => <label key={k} className="flex cursor-pointer items-center gap-2 rounded-xl border border-outline-variant/30 p-3 text-sm font-bold has-[:checked]:border-primary has-[:checked]:bg-primary/5"><input type="radio" name="mu-type" defaultChecked={i === 0} className="accent-[var(--color-primary)]" /><span className="icon text-[18px]">{v.icon}</span>{v.label}</label>)}
          </div>
          <Field id="mu-course" label="কোর্স"><select id="mu-course" className="field">{COURSES.map((c) => <option key={c.id}>{c.title}</option>)}</select></Field>
          <label htmlFor="mu-file" className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-outline-variant/50 p-6 text-center hover:border-primary"><span className="icon text-3xl text-primary dark:text-primary-fixed">picture_as_pdf</span><span className="text-sm font-bold">PDF ফাইল বাছুন</span><input id="mu-file" type="file" accept="application/pdf" className="sr-only" /></label>
        </div>
      </Modal>
    </>
  );
}
