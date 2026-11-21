"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import katex from "katex";
import "katex/dist/katex.min.css";

// practice.html এর ছোট সাহায্যকারী: বাংলা সংখ্যা, সময়, রঙ, বোতামের ক্লাস, গণিত (KaTeX), modal, toast

const BN = "০১২৩৪৫৬৭৮৯";
export const bn = (v: string | number) => String(v).replace(/\d/g, (d) => BN[+d]);
export const num = (n: number) => bn(Number.isInteger(+n) ? +n : String(+(+n).toFixed(2)));
export const LETTERS = ["ক", "খ", "গ", "ঘ"];
const MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const two = (n: number) => String(n).padStart(2, "0");
export const clock = (ts: number) => { const d = new Date(ts); return bn(two(d.getHours() % 12 || 12) + ":" + two(d.getMinutes())) + (d.getHours() < 12 ? " এএম" : " পিএম"); };
export const clockSec = (ts: number) => { const d = new Date(ts); return bn(two(d.getHours()) + ":" + two(d.getMinutes()) + ":" + two(d.getSeconds())); };
export const when = (ts: number, now: number) => { const d = new Date(ts), t = new Date(now); const day = d.toDateString() === t.toDateString() ? "আজ" : bn(d.getDate()) + " " + MONTHS[d.getMonth()].slice(0, 4); return day + ", " + clock(ts); };
export const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(s / 3600); return bn((h ? h + ":" : "") + two(Math.floor((s % 3600) / 60)) + ":" + two(s % 60)); };
export const span = (ms: number) => ms < 3600e3 ? bn(Math.max(1, Math.round(ms / 60e3))) + " মিনিট" : ms < 864e5 ? bn(Math.round(ms / 3600e3)) + " ঘণ্টা" : bn(Math.round(ms / 864e5)) + " দিন";

export const MUTED = "text-on-surface-variant dark:text-surface-variant";
export const CARD = "bg-surface-container-lowest dark:bg-inverse-surface border border-outline-variant/30 dark:border-outline-variant/10 rounded-3xl shadow-sm";
export const BTN = "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all";
export const BTN_PRI = BTN + " bg-primary text-on-primary hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,108,73,0.3)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0";
export const BTN_GHOST = BTN + " border border-outline-variant/40 " + MUTED + " hover:text-primary dark:hover:text-primary-fixed hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed";
export const TONE = {
  green: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40",
  amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40",
  red: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/40",
  blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/40",
  purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/40",
  gray: "bg-surface-container-high dark:bg-white/10 text-on-surface-variant dark:text-surface-variant border-outline-variant/30",
} as const;
export type ToneKey = keyof typeof TONE;

export function Badge({ tone, icon, children }: { tone: ToneKey; icon?: string; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${TONE[tone]}`}>{icon && <span className="icon text-[14px]">{icon}</span>}{children}</span>;
}
export const Icon = ({ name, className = "text-[18px]" }: { name: string; className?: string }) => <span className={`icon ${className}`}>{name}</span>;

// গণিত: $...$ অংশ KaTeX দিয়ে, বাকিটা নিরাপদ লেখা (নতুন লাইন <br>)
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function texHtml(src: string) {
  return String(src ?? "").split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g).map((part) => {
    const disp = /^\$\$[^$]+\$\$$/.test(part);
    if (disp || /^\$[^$]+\$$/.test(part)) {
      try { return katex.renderToString(disp ? part.slice(2, -2) : part.slice(1, -1), { throwOnError: false, displayMode: disp }); } catch { /* নিচে */ }
    }
    return esc(part).replace(/\n/g, "<br>");
  }).join("");
}
export function Tex({ src, className, as = "div" }: { src: string; className?: string; as?: "div" | "span" }) {
  const T = as;
  return <T className={className} dangerouslySetInnerHTML={{ __html: texHtml(src) }} />;
}

// ---------- modal (ex-modal এর মতো): আইকন, শিরোনাম, বন্ধ, ভেতর, ডানদিকে বোতাম ----------
export type ModalAction = { label: string; kind?: "ghost" | "danger" | "primary"; id?: string; disabled?: boolean; onClick?: () => boolean | void };
export type ModalSpec = { icon?: string; title: string; body: ReactNode; actions?: ModalAction[]; wide?: boolean; locked?: boolean; onClose?: () => void };

export function ExModal({ spec, close }: { spec: ModalSpec | null; close: () => void }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!spec) return;
    const r = requestAnimationFrame(() => setShown(true));
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !spec.locked) close(); };
    window.addEventListener("keydown", k);
    return () => { cancelAnimationFrame(r); window.removeEventListener("keydown", k); setShown(false); };
  }, [spec, close]);
  if (!spec) return null;
  const acts = spec.actions ?? [{ label: "ঠিক আছে" }];
  return createPortal(
    <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-on-background/50 p-4 backdrop-blur-sm transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`}
      onClick={(e) => { if (e.target === e.currentTarget && !spec.locked) close(); }}>
      <div role="dialog" aria-modal="true" aria-label={spec.title}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-2xl transition-transform duration-300 md:p-8 dark:border-outline-variant/10 dark:bg-inverse-surface ${spec.wide ? "max-w-3xl" : "max-w-lg"} ${shown ? "scale-100" : "scale-95"}`}>
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary-fixed/10 dark:text-primary-fixed"><span className="icon text-2xl">{spec.icon ?? "info"}</span></div>
          <h3 className="text-xl leading-tight font-bold text-on-background dark:text-background">{spec.title}</h3>
          {!spec.locked && <button type="button" onClick={close} aria-label="বন্ধ করুন" className={`ml-auto grid h-9 w-9 place-items-center rounded-full ${MUTED} hover:bg-surface-container-low dark:hover:bg-white/10`}><span className="icon">close</span></button>}
        </div>
        <div className="text-on-background dark:text-background">{spec.body}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {acts.map((a) => (
            <button key={a.label} id={a.id} type="button" disabled={a.disabled}
              className={a.kind === "ghost" ? BTN_GHOST : a.kind === "danger" ? BTN + " bg-error text-white hover:bg-red-700" : BTN_PRI}
              onClick={() => { if (!a.onClick || a.onClick() !== false) close(); }}>{a.label}</button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------- toast: ডান থেকে আসে, ৩.২ সেকেন্ড ----------
type T = { id: number; msg: string; type: "success" | "error" | "info"; on: boolean };
export function useExToast() {
  const [list, setList] = useState<T[]>([]);
  const seq = useRef(0);
  const show = (msg: string, type: T["type"] = "success") => {
    const id = ++seq.current;
    setList((l) => [...l, { id, msg, type, on: false }]);
    setTimeout(() => setList((l) => l.map((t) => (t.id === id ? { ...t, on: true } : t))), 20);
    setTimeout(() => setList((l) => l.map((t) => (t.id === id ? { ...t, on: false } : t))), 3200);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3500);
  };
  const node = list.length > 0 && createPortal(
    <div className="pointer-events-none fixed top-24 right-4 z-[200] flex flex-col gap-3 md:right-8" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} role="status" className={`pointer-events-auto flex max-w-[380px] min-w-[260px] items-center gap-3 rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-5 py-4 text-on-background shadow-2xl transition-all duration-300 dark:bg-inverse-surface dark:text-background ${t.on ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}`}>
          <span className={`icon ${t.type === "error" ? "text-error" : t.type === "info" ? "text-blue-500" : "text-primary dark:text-primary-fixed"}`}>{{ success: "check_circle", error: "error", info: "info" }[t.type]}</span>
          <span className="text-sm font-bold">{t.msg}</span>
        </div>
      ))}
    </div>,
    document.body,
  );
  return [show, node] as const;
}
