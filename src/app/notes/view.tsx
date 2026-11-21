"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { DeleteModal, useDemoToast } from "@/components/demo-feedback";
import { Modal } from "../admin/_components/kit";
import { deleteNote, renameNote } from "./actions";

export type Note = { id: number; title: string; date: string };

// সকল নোটসমূহ, হুবহু notes.html: মাথার ব্যানার (দুপাশে হেলানো আইকন), খোঁজা, নোটের কার্ড (উপরে ওঠার hover), খালি থাকলে ছবি আর বার্তা,
// মোছার নিশ্চিতকরণ আর টোস্ট। নোট লেখা হয় লেকচার দেখার সময়; এখানে খোঁজা, নাম বদল আর মোছা
export function NotesView({ name, notes }: { name: string; notes: Note[] }) {
  const [list, setList] = useState(notes);
  const [q, setQ] = useState("");
  const [del, setDel] = useState<Note | null>(null);
  const [edit, setEdit] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const [toast, toastNode] = useDemoToast();
  const rows = list.filter((n) => n.title.toLowerCase().includes(q.toLowerCase()));

  const doDelete = () => start(async () => {
    if (!del) return;
    const r = await deleteNote(del.id);
    if (r.ok) { setList((l) => l.filter((n) => n.id !== del.id)); toast("নোট সফলভাবে মুছে ফেলা হয়েছে"); }
    setDel(null);
  });
  const doRename = () => start(async () => {
    if (!edit) return;
    const r = await renameNote(edit.id, title);
    if (!r.ok) { setErr(r.error ?? ""); return; }
    setList((l) => l.map((n) => (n.id === edit.id ? { ...n, title: title.trim() } : n)));
    setEdit(null); toast("নোট সফলভাবে সেভ হয়েছে");
  });

  return (
    <main className="relative z-10 flex grow flex-col">
      {toastNode}
      <div className="relative w-full overflow-hidden border-b border-outline-variant/20 bg-surface pt-4 pb-6 md:pt-8 md:pb-12 dark:border-outline-variant/10 dark:bg-on-background">
        <div className="absolute top-4 left-4 -rotate-12 opacity-10 md:left-12 dark:opacity-20"><span className="icon text-[120px]">edit_document</span></div>
        <div className="absolute top-4 right-4 scale-x-[-1] rotate-12 opacity-10 md:right-12 dark:opacity-20"><span className="icon text-[120px]">edit_document</span></div>
        <div className="relative z-10 mx-auto max-w-[800px] px-4 text-center">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-primary md:mb-4 md:text-4xl dark:text-primary-fixed">সকল নোটসমূহ</h1>
          <p className="text-sm leading-relaxed tracking-wide uppercase muted md:text-base">হ্যালো! {name}, ট্যাগ ব্যবহার করে আপনার কনটেন্ট সহজেই গুছিয়ে রাখুন এবং সংরক্ষিত সকল নোটে দ্রুত অ্যাক্সেস পেতে সার্চ করুন।</p>
        </div>
      </div>

      <div className="w-full grow bg-surface-container-lowest p-3 transition-colors md:p-12 dark:bg-[#06101c]">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="mb-5 w-full md:mb-10">
            <div className="relative mx-auto max-w-[800px]">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4"><span className="icon text-primary dark:text-primary-fixed">search</span></div>
              <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="এখানে সবকিছু খুঁজুন..." aria-label="নোট খুঁজুন"
                className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-low py-4 pr-12 pl-12 text-sm text-on-surface shadow-sm transition-colors placeholder:text-on-surface-variant/70 focus:border-[#b259ff]/50 focus:outline-none dark:border-outline-variant/10 dark:bg-[#0b1626] dark:text-background dark:placeholder:text-surface-variant/50" />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4"><span className="icon text-lg text-on-surface-variant/50 dark:text-surface-variant/30">arrow_drop_down</span></div>
            </div>
          </div>

          {rows.length ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
              {rows.map((n, i) => (
                <div key={n.id} className="reveal h-full" style={{ transitionDelay: `${i * 100}ms` }}>
                  <div className="note-card relative flex h-full min-h-[160px] flex-col rounded-xl border border-outline-variant/30 bg-surface p-5 shadow-sm dark:border-outline-variant/10 dark:bg-[#0d1b2a]">
                    <div className="mb-6 flex items-start justify-between">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-surface-container-high dark:bg-inverse-surface"><span className="icon text-sm muted">description</span></div>
                      <div className="flex items-center gap-2">
                        <button type="button" title="নোট সম্পাদনা" aria-label="নোট সম্পাদনা" onClick={() => { setEdit(n); setTitle(n.title); setErr(""); }} className="p-1 transition-colors muted hover:text-primary dark:hover:text-[#b259ff]"><span className="icon text-[18px]">edit_square</span></button>
                        <button type="button" title="নোট মুছুন" aria-label="নোট মুছুন" onClick={() => setDel(n)} className="p-1 transition-colors muted hover:text-error dark:hover:text-red-400"><span className="icon text-[18px]">delete</span></button>
                      </div>
                    </div>
                    <h3 className="line-clamp-2 grow text-base font-bold text-on-surface dark:text-background">{n.title}</h3>
                    <div className="mt-4 text-[11px] font-bold tracking-wide muted">সর্বশেষ আপডেট: {n.date}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="relative mb-8 h-48 w-48 text-[#b259ff]">
                <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <rect x="50" y="40" width="100" height="120" rx="8" fill="#1e293b" />
                  <rect x="65" y="60" width="70" height="6" rx="3" fill="#334155" />
                  <rect x="65" y="80" width="70" height="6" rx="3" fill="#334155" />
                  <rect x="65" y="100" width="50" height="6" rx="3" fill="#334155" />
                  <rect x="30" y="110" width="60" height="70" rx="6" fill="#0f172a" stroke="#334155" strokeWidth="2" />
                  <rect x="40" y="130" width="40" height="4" rx="2" fill="#334155" />
                  <rect x="40" y="145" width="40" height="4" rx="2" fill="#334155" />
                  <circle cx="120" cy="140" r="20" fill="#ef4444" stroke="#7f1d1d" strokeWidth="4" />
                  <path d="M112 132L128 148M128 132L112 148" stroke="white" strokeWidth="4" strokeLinecap="round" />
                  <path d="M40 80 L35 70 L25 65 L35 60 L40 50 L45 60 L55 65 L45 70 Z" fill="#22d3ee" />
                  <path d="M150 170 L147 163 L140 160 L147 157 L150 150 L153 157 L160 160 L153 163 Z" fill="#b259ff" />
                </svg>
              </div>
              <h2 className="mb-3 text-xl font-bold text-on-surface md:text-2xl dark:text-background">এই মুহূর্তে কোনো নোট উপলব্ধ নেই।</h2>
              <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed muted">এটি একটি সুপ্রতিষ্ঠিত সত্য যে, একটি পৃষ্ঠার লেআউটের দিকে তাকালে পাঠক তার পঠনযোগ্য কনটেন্ট দ্বারা বিভ্রান্ত হতে পারেন।</p>
              <Link href="/dashboard#courses" className="rounded-full bg-primary px-8 py-3 text-sm font-bold text-white transition-shadow duration-300 hover:shadow-[0_0_15px_rgba(178,89,255,0.4)]">শেখা চালিয়ে যান</Link>
            </div>
          )}
        </div>
      </div>

      <DeleteModal open={!!del} title="নোট মুছে ফেলবেন?" text="আপনি কি নিশ্চিত যে আপনি এই নোটটি মুছে ফেলতে চান? এই কাজটি আর পূর্বাবস্থায় ফেরানো যাবে না।"
        cancel="বাতিল করুন" ok="মুছে ফেলুন" pending={pending} onCancel={() => setDel(null)} onOk={doDelete} />
      <Modal open={!!edit} onClose={() => setEdit(null)} icon="edit_square" title="নোট সম্পাদনা" sub="নোটের শিরোনাম বদলান"
        actions={[{ label: "বাতিল", kind: "ghost" }, { label: pending ? "সেভ হচ্ছে…" : "সেভ করুন", onClick: doRename, disabled: pending }]}>
        <label className="label" htmlFor="nt-title">শিরোনাম</label>
        <input id="nt-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} aria-invalid={!!err} />
        {err && <p className="mt-2 text-xs font-bold text-error" role="alert">{err}</p>}
      </Modal>
    </main>
  );
}
