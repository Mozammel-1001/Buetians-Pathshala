"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { DeleteModal, useDemoToast } from "@/components/demo-feedback";
import { Modal } from "../admin/_components/kit";
import { deleteBookmark, setBookmarkTag } from "./actions";

export type Bm = { lessonId: number; href: string; tag: string; duration: string; title: string; subtitle: string };

// বুকমার্ক, হুবহু bookmarks.html: মাথার ব্যানার, ট্যাগ দিয়ে খোঁজা, সাম্প্রতিক ট্যাগ (চাপলে ছাঁকে), "অব্যবহৃত ট্যাগ মুছে ফেলুন"
// (খোঁজা খালি করে), বুকমার্কের কার্ড (উপরে ওঠার hover, ডানে গোল play বোতাম), খালি থাকলে ছবি, মোছার নিশ্চিতকরণ আর টোস্ট
export function BookmarksView({ name, items }: { name: string; items: Bm[] }) {
  const [list, setList] = useState(items);
  const [q, setQ] = useState("");
  const [del, setDel] = useState<Bm | null>(null);
  const [edit, setEdit] = useState<Bm | null>(null);
  const [tag, setTag] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const [toast, toastNode] = useDemoToast();
  const s = q.toLowerCase();
  const rows = list.filter((b) => b.tag.toLowerCase().includes(s) || b.title.toLowerCase().includes(s) || b.subtitle.toLowerCase().includes(s));
  const tags = [...new Set(list.map((b) => b.tag))];

  const doDelete = () => start(async () => {
    if (!del) return;
    const r = await deleteBookmark(del.lessonId);
    if (r.ok) { setList((l) => l.filter((b) => b.lessonId !== del.lessonId)); toast("বুকমার্ক সফলভাবে মোছা হয়েছে"); }
    setDel(null);
  });
  const doTag = () => start(async () => {
    if (!edit) return;
    const r = await setBookmarkTag(edit.lessonId, tag);
    if (!r.ok) { setErr(r.error ?? ""); return; }
    setList((l) => l.map((b) => (b.lessonId === edit.lessonId ? { ...b, tag: tag.trim() || b.tag } : b)));
    setEdit(null); toast("ট্যাগ সফলভাবে বদলানো হয়েছে");
  });

  return (
    <main className="relative z-10 flex grow flex-col">
      {toastNode}
      <div className="relative w-full overflow-hidden border-b border-outline-variant/20 bg-surface pt-4 pb-6 md:pt-8 md:pb-12 dark:border-outline-variant/10 dark:bg-on-background">
        <div className="absolute top-4 left-4 -rotate-12 opacity-10 md:left-12 dark:opacity-20"><span className="icon text-[120px]">book</span></div>
        <div className="absolute top-4 right-4 scale-x-[-1] rotate-12 opacity-10 md:right-12 dark:opacity-20"><span className="icon text-[120px]">book</span></div>
        <div className="relative z-10 mx-auto max-w-[800px] px-4 text-center">
          <h1 className="mb-2 bg-gradient-to-r from-pink-500 to-[#b259ff] bg-clip-text text-3xl font-bold tracking-tight text-primary md:mb-4 md:text-4xl dark:text-primary-fixed">বুকমার্ক</h1>
          <p className="text-sm leading-relaxed tracking-wide uppercase muted md:text-base">হ্যালো! {name}, আপনি আপনার কন্টেন্টগুলো খুব সহজেই এখানে সাজিয়ে রাখতে পারেন। দ্রুত কোনো বুকমার্ক করা ভিডিও খুঁজে পেতে ট্যাগ এবং সার্চ ফিচার ব্যবহার করুন। আশা করি আপনার এই অভিজ্ঞতা ভালো লাগবে।</p>
        </div>
      </div>

      <div className="w-full grow bg-surface-container-lowest p-3 transition-colors md:p-12 dark:bg-[#06101c]">
        <div className="mx-auto w-full max-w-[1000px]">
          <div className="mb-4 w-full md:mb-8">
            <div className="relative mx-auto flex max-w-[700px] items-center overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-low shadow-sm transition-all duration-300 focus-within:border-[#b259ff] focus-within:ring-4 focus-within:ring-[#b259ff]/20 dark:border-outline-variant/10 dark:bg-[#0b1626]">
              <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ট্যাগ দ্বারা বুকমার্ক খুঁজুন..." aria-label="বুকমার্ক খুঁজুন"
                className="min-w-0 grow border-none bg-transparent py-4 pr-2 pl-4 text-sm text-ellipsis text-on-surface placeholder:text-on-surface-variant/70 focus:ring-0 focus:outline-none md:pr-4 md:pl-6 dark:text-background dark:placeholder:text-surface-variant/50" />
              <div className="h-8 w-px shrink-0 bg-outline-variant/30 dark:bg-outline-variant/20" />
              <button type="button" className="flex shrink-0 items-center gap-1 bg-transparent px-3 py-4 text-sm whitespace-nowrap transition-colors muted hover:text-on-surface focus:outline-none md:gap-2 md:px-6 dark:hover:text-background">
                <span className="hidden sm:inline">ট্যাগ দ্বারা খুঁজুন</span><span className="icon text-lg">expand_more</span>
              </button>
            </div>
          </div>

          <div className="mb-6 flex w-full flex-col items-center md:mb-12">
            <div className="mb-4 flex items-center gap-4">
              <h3 className="text-base font-bold text-on-surface dark:text-background">সাম্প্রতিক ট্যাগ</h3>
              <button type="button" onClick={() => setQ("")} className="rounded-full border border-outline-variant/30 px-3 py-1 text-xs transition-colors muted hover:bg-surface-container-high dark:border-outline-variant/10 dark:hover:bg-inverse-surface">অব্যবহৃত ট্যাগ মুছে ফেলুন</button>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {tags.length ? tags.map((t) => (
                <button key={t} type="button" onClick={() => setQ(t)} className="flex h-8 min-w-8 cursor-pointer items-center justify-center rounded border border-outline-variant/20 bg-surface-container-high px-1.5 transition-colors hover:bg-primary/20 dark:border-outline-variant/10 dark:bg-[#1a2942]">
                  <span className="text-xs font-bold text-primary dark:text-[#4edea3]">{t}</span>
                </button>
              )) : <span className="text-xs text-on-surface-variant/50 italic dark:text-surface-variant/30">কোনো ট্যাগ উপলব্ধ নেই</span>}
            </div>
          </div>

          {rows.length ? (
            <div className="flex flex-col gap-3 md:gap-4">
              {rows.map((b, i) => (
                <div key={b.lessonId} className="reveal w-full" style={{ transitionDelay: `${i * 100}ms` }}>
                  <div className="bookmark-card flex flex-col gap-5 rounded-2xl border border-outline-variant/30 bg-surface p-5 shadow-sm md:flex-row md:items-center dark:border-outline-variant/10 dark:bg-[#0d1b2a]">
                    <div className="flex grow flex-col gap-3">
                      <div className="flex w-full items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-6 min-w-6 items-center justify-center rounded bg-surface-container-high px-1 dark:bg-[#1a2942]"><span className="text-[10px] font-bold text-primary dark:text-[#4edea3]">{b.tag}</span></div>
                          <div className="flex items-center gap-1 text-xs font-bold muted"><span className="icon text-[14px]">schedule</span>{b.duration}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" title="ট্যাগ পরিবর্তন করুন" aria-label="ট্যাগ পরিবর্তন করুন" onClick={() => { setEdit(b); setTag(b.tag); setErr(""); }} className="p-1 transition-colors muted hover:text-primary dark:hover:text-[#b259ff]"><span className="icon text-[18px]">edit</span></button>
                          <button type="button" title="বুকমার্ক মুছুন" aria-label="বুকমার্ক মুছুন" onClick={() => setDel(b)} className="p-1 transition-colors muted hover:text-error dark:hover:text-red-400"><span className="icon text-[18px]">delete</span></button>
                        </div>
                      </div>
                      <div>
                        <h3 className="mb-1 text-base leading-snug font-bold text-on-surface md:text-lg dark:text-background">{b.title}</h3>
                        <p className="text-xs font-bold text-on-surface-variant dark:text-[#b45b4c]">{b.subtitle}</p>
                      </div>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center self-end rounded-full bg-surface-container-high md:self-center dark:bg-primary/20">
                      <Link href={b.href} aria-label="ভিডিও দেখুন" title="ভিডিও দেখুন" className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-md transition-transform hover:scale-110 hover:shadow-lg"><span className="icon ml-1 text-[20px]">play_arrow</span></Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="relative mb-8 flex h-48 w-48 items-center justify-center">
                <div className="absolute h-32 w-32 rounded-full bg-surface-container-high dark:bg-[#111827]" />
                <svg className="relative z-10 h-24 w-24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M20 60 Q20 50 30 50 Q35 40 45 45 Q50 40 55 50 Q65 50 65 60 Z" fill="#fecaca" opacity="0.8" />
                  <path d="M75 55 Q75 45 65 45 Q60 35 50 40 Q45 35 40 45 Q30 45 30 55 Z" fill="#fecaca" opacity="0.6" />
                  <path d="M35 20 L65 20 L65 80 L50 65 L35 80 Z" fill="url(#bm-grad1)" />
                  <path d="M50 35 L53 42 L60 42 L54 46 L56 53 L50 49 L44 53 L46 46 L40 42 L47 42 Z" fill="#fde047" />
                  <path d="M25 30 L27 25 L32 23 L27 21 L25 16 L23 21 L18 23 L23 25 Z" fill="#fca5a5" />
                  <path d="M75 70 L76 67 L79 66 L76 65 L75 62 L74 65 L71 66 L74 67 Z" fill="#fca5a5" />
                  <defs><linearGradient id="bm-grad1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#fca5a5" /><stop offset="100%" stopColor="#fecaca" /></linearGradient></defs>
                </svg>
              </div>
              <h2 className="mb-8 text-xl font-bold text-on-surface md:text-2xl dark:text-background">এই মুহূর্তে কোনো বুকমার্ক ভিডিও উপলব্ধ নেই।</h2>
              <Link href="/dashboard#courses" className="rounded-full bg-primary px-8 py-3 text-sm font-bold text-white transition-shadow duration-300 hover:shadow-[0_0_15px_rgba(178,89,255,0.4)]">শেখা চালিয়ে যান</Link>
            </div>
          )}
        </div>
      </div>

      <DeleteModal open={!!del} title="বুকমার্ক মুছবেন?" text="আপনি কি নিশ্চিত যে আপনি এই বুকমার্কটি সরাতে চান? এই কাজটি আর ফেরানো যাবে না।"
        cancel="বাতিল" ok="মুছুন" pending={pending} onCancel={() => setDel(null)} onOk={doDelete} />
      <Modal open={!!edit} onClose={() => setEdit(null)} icon="sell" title="ট্যাগ পরিবর্তন করুন" sub={edit?.title}
        actions={[{ label: "বাতিল", kind: "ghost" }, { label: pending ? "সেভ হচ্ছে…" : "সেভ করুন", onClick: doTag, disabled: pending }]}>
        <label className="label" htmlFor="bk-tag">ট্যাগ (যেমন গ, JS)</label>
        <input id="bk-tag" className="field" value={tag} onChange={(e) => setTag(e.target.value)} maxLength={12} aria-invalid={!!err} />
        {err && <p className="mt-2 text-xs font-bold text-error" role="alert">{err}</p>}
      </Modal>
    </main>
  );
}
