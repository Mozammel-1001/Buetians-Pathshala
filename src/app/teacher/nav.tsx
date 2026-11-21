"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { markRemindersRead } from "./actions";
import { useTools } from "./tools";
import { ago, bn } from "@/app/evaluator/lib";
import { MUTED } from "@/app/evaluator/ui";
import type { Reminder } from "./data";

// শিক্ষকের পাশের মেনু (বড় পর্দায়), ছোট পর্দার চিপ আর ঘণ্টা: teacher_dashboard.html এর sidebar অনুযায়ী
type Item = { key: string; icon: string; label: string; href?: string; tool?: "material" | "live"; soon?: boolean; badge?: "qa" | "mark" };
export const ITEMS: Item[] = [
  { key: "home", icon: "dashboard", label: "ড্যাশবোর্ড", href: "/teacher" },
  { key: "courses", icon: "book", label: "কোর্স ম্যানেজমেন্ট", href: "/teacher/courses" },
  { key: "material", icon: "upload_file", label: "ম্যাটেরিয়াল আপলোড", tool: "material" },
  { key: "live", icon: "video_camera_front", label: "লাইভ ক্লাস পরিচালনা", href: "/teacher/live" },
  { key: "qa", icon: "forum", label: "শিক্ষার্থীদের প্রশ্ন", href: "/teacher/qa", badge: "qa" },
  { key: "exams", icon: "quiz", label: "পরীক্ষা ও প্রশ্নপত্র", href: "/exam-editor" },
  { key: "marking", icon: "grading", label: "খাতা মূল্যায়ন", href: "/evaluator", badge: "mark" },
  { key: "routine", icon: "calendar_today", label: "ক্লাস রুটিন", soon: true },
  { key: "settings", icon: "settings", label: "সেটিংস", soon: true },
];

const base = "flex items-center gap-3 rounded-lg border-l-4 px-4 py-3 transition-colors text-left";
const on = "border-primary bg-primary/10 text-primary dark:border-primary-fixed dark:bg-primary-fixed/10 dark:text-primary-fixed";
const off = "border-transparent text-on-surface-variant hover:border-outline-variant hover:bg-surface-container-low dark:text-surface-variant dark:hover:bg-inverse-surface";

function useActive() {
  const path = usePathname();
  return (h?: string) => !!h && (h === "/teacher" ? path === h : path === h || path.startsWith(h + "/"));
}
const Badge = ({ n, cls }: { n: number; cls: string }) => n > 0 ? <span className={`ml-auto grid h-[22px] min-w-[22px] place-items-center rounded-full px-1.5 text-xs font-bold text-white ${cls}`}>{bn(n)}</span> : null;

export function TSideNav({ qa, mark }: { qa: number; mark: number }) {
  const active = useActive();
  const tools = useTools();
  return (
    <nav className="flex grow flex-col gap-2 font-bold" aria-label="শিক্ষক">
      {ITEMS.map((m) => {
        const b = m.badge === "qa" ? <Badge n={qa} cls="bg-error" /> : m.badge === "mark" ? <Badge n={mark} cls="bg-amber-500" /> : null;
        const inner = <><span className="icon">{m.icon}</span><span>{m.label}</span>{b}</>;
        return m.href ? <Link key={m.key} href={m.href} aria-current={active(m.href) ? "page" : undefined} className={`${base} ${active(m.href) ? on : off}`}>{inner}</Link>
          : <button key={m.key} type="button" onClick={() => (m.tool ? tools.selectCourse(m.tool) : tools.soon())} className={`${base} ${off}`}>{inner}</button>;
      })}
    </nav>
  );
}

export function TChips({ qa, mark }: { qa: number; mark: number }) {
  const active = useActive();
  const tools = useTools();
  return (
    <div className="no-scrollbar -mx-5 mb-3 overflow-x-auto px-5 lg:hidden">
      <div className="flex w-max gap-2">
        {ITEMS.map((m) => {
          const n = m.badge === "qa" ? qa : m.badge === "mark" ? mark : 0;
          const inner = <><span className="icon text-[18px]">{m.icon}</span>{m.label}{n > 0 && <span className={`ml-1 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] font-bold text-white ${m.badge === "qa" ? "bg-error" : "bg-amber-500"}`}>{bn(n)}</span>}</>;
          return m.href ? <Link key={m.key} href={m.href} aria-current={active(m.href) ? "page" : undefined} className="chip-link">{inner}</Link>
            : <button key={m.key} type="button" onClick={() => (m.tool ? tools.selectCourse(m.tool) : tools.soon())} className="chip-link">{inner}</button>;
        })}
      </div>
    </div>
  );
}

// উপরের ঘণ্টা: অ্যাডমিন/ম্যানেজারের রিমাইন্ডার (পড়া হয়নি হলে লাল ফোঁটা), "সব পড়া হয়েছে"
export function TBell({ reminders, pending, nowMs }: { reminders: Reminder[]; pending: number; nowMs: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const unread = reminders.filter((r) => !r.read && !r.answered).length;
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [open]);
  const go = (href: string) => { setOpen(false); router.push(href); };
  return (
    <div ref={box} className="relative">
      <button type="button" id="t-bell" aria-label="নোটিফিকেশন" onClick={() => setOpen((v) => !v)} className="relative flex text-on-surface-variant transition-colors hover:text-primary dark:text-surface-variant">
        <span className="icon">notifications</span>
        {unread > 0 && <span id="t-bell-dot" className="absolute top-0 right-0 h-2 w-2 animate-pulse rounded-full bg-error" />}
      </button>
      <div className={`absolute top-full right-0 z-[70] mt-3 w-[min(92vw,360px)] origin-top-right rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-2xl transition-all duration-200 dark:border-outline-variant/10 dark:bg-inverse-surface ${open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0"}`}>
        <div className="flex items-center justify-between border-b border-outline-variant/20 px-4 py-3"><span className="font-bold text-on-background dark:text-background">নোটিফিকেশন</span>
          <button type="button" className="text-xs font-bold text-primary hover:underline dark:text-primary-fixed" onClick={() => void markRemindersRead().then(() => router.refresh())}>সব পড়া হয়েছে</button></div>
        <div className="max-h-[380px] overflow-y-auto p-2">
          {pending > 0 && (
            <button type="button" onClick={() => go("/teacher/qa")} className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-surface-container-low dark:hover:bg-white/5">
              <span className="icon text-primary dark:text-primary-fixed">forum</span><span className="grow text-sm font-bold">{bn(pending)}টি প্রশ্নের উত্তর বাকি</span><span className={`icon text-[18px] ${MUTED}`}>chevron_right</span></button>
          )}
          {reminders.slice(0, 8).map((r) => (
            <button key={r.id} type="button" onClick={() => go(`/teacher/qa?q=${r.qid}`)} className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors hover:bg-surface-container-low dark:hover:bg-white/5 ${r.read ? "opacity-70" : ""}`}>
              <span className={`icon ${r.read ? MUTED : "text-amber-500"}`}>notifications_active</span>
              <span className="min-w-0 grow"><span className="block text-sm text-on-background dark:text-background"><strong>{r.by}</strong> ({r.role === "manager" ? "ম্যানেজার" : "অ্যাডমিন"}) উত্তর দিতে বলেছেন</span>
                <span className={`mt-0.5 block truncate text-xs ${MUTED}`}>{r.question}</span>
                <span className={`mt-0.5 block text-[11px] ${MUTED}`}>{ago(r.at, nowMs)}{r.answered ? " · উত্তর দেওয়া হয়েছে" : ""}</span></span>
              {!r.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-error" />}
            </button>
          ))}
          {!pending && !reminders.length && <p className={`p-4 text-center text-sm ${MUTED}`}>নতুন কিছু নেই</p>}
        </div>
      </div>
    </div>
  );
}
