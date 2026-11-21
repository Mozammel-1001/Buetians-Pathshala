"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

// ধাপ ১ (শুধু UI) এর সাধারণ উপাদান: নমুনা-সতর্কবার্তা, modal, ট্যাব, সুইচ, টোস্ট। কাজের অংশ জোড়ার সময় এগুলো আসল action এ বদলাবে

export function SampleNote() {
  return (
    <div className="reveal mb-3 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 md:mb-6 md:text-sm dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200">
      <span className="icon shrink-0 text-[20px]">science</span>
      <p><b>নমুনা তথ্য।</b> এই অংশের ডিজাইন তৈরি হয়েছে, কিন্তু এখনো database এর সাথে যুক্ত নয়; যা দেখছেন সব উদাহরণ, বোতাম চাপলে কিছু সংরক্ষণ হবে না।</p>
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "info" } | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  const node = msg && createPortal(
    <div role="status" className="view-in fixed top-24 right-4 z-[120] flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-sm font-bold shadow-xl dark:bg-inverse-surface">
      <span className={`icon ${msg.tone === "ok" ? "text-emerald-500" : "text-blue-500"}`}>{msg.tone === "ok" ? "check_circle" : "info"}</span>{msg.text}
    </div>,
    document.body,
  );
  return [(text: string, tone: "ok" | "info" = "ok") => setMsg({ text, tone }), node] as const;
}

// ডেমোর মতো নিশ্চিতকরণ (ব্রাউজারের confirm() এর বদলে): const [ask, node] = useConfirm(); if (await ask({...})) ...
type Ask = { title: string; sub?: string; body?: ReactNode; ok?: string; tone?: "primary" | "danger" | "amber"; icon?: string };
export function useConfirm() {
  const [q, setQ] = useState<(Ask & { done: (v: boolean) => void }) | null>(null);
  const ask = (a: Ask) => new Promise<boolean>((resolve) => setQ({ ...a, done: resolve }));
  const close = (v: boolean) => { q?.done(v); setQ(null); };
  const node = q && (
    <Modal open onClose={() => close(false)} icon={q.icon ?? (q.tone === "danger" ? "warning" : "help")} tone={q.tone} title={q.title} sub={q.sub}
      actions={[{ label: "বাতিল", kind: "ghost", onClick: () => close(false) }, { label: q.ok ?? "হ্যাঁ, নিশ্চিত", kind: q.tone === "danger" ? "danger" : "primary", onClick: () => close(true) }]}>
      {q.body ? <div className="text-sm muted">{q.body}</div> : null}
    </Modal>
  );
  return [ask, node] as const;
}

// server action এর form জমার আগে নিশ্চিতকরণ: <form onSubmit={onSubmit}> ; হ্যাঁ বললে form আবার জমা হয়
export function useConfirmSubmit(make: () => Ask | null) {
  const [ask, node] = useConfirm();
  const pass = useRef(false);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (pass.current) { pass.current = false; return; }
    const a = make();
    if (!a) return;
    e.preventDefault();
    const form = e.currentTarget;
    void ask(a).then((ok) => { if (ok) { pass.current = true; form.requestSubmit(); } });
  };
  return [onSubmit, node] as const;
}

const ICON_TONE = { primary: "bg-primary/10 text-primary dark:bg-primary-fixed/10 dark:text-primary-fixed", danger: "bg-error/10 text-error dark:text-red-300", amber: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300" };

export function Modal({ open, onClose, icon = "info", tone = "primary", title, sub, children, actions, size = "max-w-lg" }: {
  open: boolean; onClose: () => void; icon?: string; tone?: "primary" | "danger" | "amber"; title: string; sub?: string; children: ReactNode; size?: string;
  actions?: { label: string; kind?: "primary" | "ghost" | "danger"; onClick?: () => void; disabled?: boolean }[];
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  // body তে বসে, যাতে পাতার ভেতরের স্তর (z-index) এ আটকে না থেকে header সহ পুরো পর্দা ঢাকে
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`view-in custom-scrollbar max-h-[92vh] w-full ${size} overflow-y-auto rounded-t-3xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-2xl sm:rounded-3xl md:p-6 dark:bg-inverse-surface`}>
        <div className="mb-4 flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${ICON_TONE[tone]}`}><span className="icon">{icon}</span></div>
          <div className="min-w-0 grow"><h3 className="text-lg font-bold text-on-background dark:text-background">{title}</h3>{sub && <p className="mt-0.5 text-xs muted">{sub}</p>}</div>
          <button type="button" className="icon-btn" aria-label="বন্ধ" onClick={onClose}><span className="icon">close</span></button>
        </div>
        <div>{children}</div>
        {actions && (
          <div className="mt-5 flex justify-end gap-2">
            {actions.map((a) => (
              <button key={a.label} type="button" disabled={a.disabled} onClick={a.onClick ?? onClose}
                className={a.kind === "ghost" ? "btn-outline" : a.kind === "danger" ? "btn-danger" : "btn-primary"}>{a.label}</button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function Tabs<T extends string>({ items, value, onChange }: { items: { key: T; label: string; count?: string }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((t) => (
        <button key={t.key} type="button" role="tab" aria-selected={value === t.key} aria-current={value === t.key ? "page" : undefined} className="tab" onClick={() => onChange(t.key)}>
          {t.label}{t.count !== undefined && <span className="opacity-70"> ({t.count})</span>}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold muted">
      <span className="relative inline-flex shrink-0 items-center">
        <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-outline-variant/60 transition-colors duration-300 peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 dark:bg-white/15 dark:peer-checked:bg-primary-fixed" />
        <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 peer-checked:translate-x-5" />
      </span>
      {label}
    </label>
  );
}

export function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div><label className="label" htmlFor={id}>{label}</label>{children}</div>;
}

export function SearchBox({ value, onChange, placeholder, width = "sm:w-64" }: { value: string; onChange: (v: string) => void; placeholder: string; width?: string }) {
  return (
    <div className={`relative ${width}`}>
      <span className="icon pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[20px] muted">search</span>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} className="field pl-10!" placeholder={placeholder} aria-label={placeholder} />
    </div>
  );
}
