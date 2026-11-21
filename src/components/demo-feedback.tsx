"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// notes.html আর bookmarks.html এর হুবহু টোস্ট (ডান থেকে আসে, সবুজ টিক, বন্ধের বোতাম, নিচে ৩ সেকেন্ডের দাগ)
// আর মোছার নিশ্চিতকরণ (মাঝখানে লাল সতর্কতা আইকন, দুটো সমান বোতাম, ছোট থেকে বড় হয়ে আসে)
type T = { id: number; msg: string; out: boolean };
export function useDemoToast() {
  const [list, setList] = useState<T[]>([]);
  const close = (id: number) => {
    setList((l) => l.map((t) => (t.id === id ? { ...t, out: true } : t)));
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 400);
  };
  const show = (msg: string) => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, msg, out: false }]);
    setTimeout(() => close(id), 3000);
  };
  const node = list.length > 0 && createPortal(
    <div className="pointer-events-none fixed top-24 right-4 z-[120] flex flex-col gap-2" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} role="status" className={`${t.out ? "toast-exit" : "toast-enter"} pointer-events-auto flex min-w-[300px] flex-col overflow-hidden rounded-lg border border-outline-variant/20 bg-white shadow-xl dark:border-outline-variant/10 dark:bg-inverse-surface`}>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500"><span className="icon text-sm font-bold text-white">check</span></div>
              <span className="text-sm font-bold text-on-surface dark:text-background">{t.msg}</span>
            </div>
            <button type="button" aria-label="বন্ধ" onClick={() => close(t.id)} className="muted hover:text-on-surface dark:hover:text-background"><span className="icon text-[18px]">close</span></button>
          </div>
          <div className="h-1 w-full bg-surface-container-high dark:bg-on-background"><div className="progress-bar-anim h-full bg-green-500" /></div>
        </div>
      ))}
    </div>,
    document.body,
  );
  return [show, node] as const;
}

export function DeleteModal({ open, title, text, cancel, ok, pending, onCancel, onOk }: {
  open: boolean; title: string; text: string; cancel: string; ok: string; pending?: boolean; onCancel: () => void; onOk: () => void;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!open) return;
    const r = requestAnimationFrame(() => setShown(true));
    const k = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", k);
    return () => { cancelAnimationFrame(r); window.removeEventListener("keydown", k); setShown(false); };
  }, [open, onCancel]);
  if (!open) return null;
  return createPortal(
    <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div role="alertdialog" aria-modal="true" aria-label={title} className={`modal-enter mx-4 w-full max-w-sm rounded-2xl border border-outline-variant/20 bg-surface p-6 shadow-2xl md:p-8 dark:border-outline-variant/10 dark:bg-[#0d1b2a] ${shown ? "modal-enter-active" : ""}`}>
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-error/10 text-error"><span className="icon text-3xl">warning</span></div>
          <h3 className="mb-2 text-xl font-bold text-on-surface dark:text-background">{title}</h3>
          <p className="mb-6 text-sm muted">{text}</p>
          <div className="flex w-full justify-center gap-3">
            <button type="button" onClick={onCancel} className="flex-1 rounded-xl bg-surface-container-low px-4 py-2.5 font-bold transition-colors muted hover:bg-surface-container-high dark:bg-inverse-surface">{cancel}</button>
            <button type="button" onClick={onOk} disabled={pending} className="flex-1 rounded-xl bg-error px-4 py-2.5 font-bold text-on-error shadow-md transition-colors hover:bg-error/90 disabled:opacity-60">{pending ? "মোছা হচ্ছে…" : ok}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
