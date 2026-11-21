"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SEEN_EVENT, bn, seenKey } from "./lib";

// খাতা মূল্যায়নের পাশের মেনু (বড় পর্দায়), ছোট পর্দার চিপ আর ঘণ্টা: evaluator_dashboard.html এর sidebar অনুযায়ী
export type NavItem = { href: string; icon: string; label: string; badge?: "mark" | "notices" };

// নোটিশ দেখা হয়েছে কিনা প্রতি browser এ মনে রাখা (সার্ভারে আলাদা রেকর্ড নেই)
function useSeen(uid: string) {
  const sub = (cb: () => void) => { window.addEventListener("storage", cb); window.addEventListener(SEEN_EVENT, cb); return () => { window.removeEventListener("storage", cb); window.removeEventListener(SEEN_EVENT, cb); }; };
  const raw = useSyncExternalStore(sub, () => { try { return localStorage.getItem(seenKey(uid)) ?? "0"; } catch { return "0"; } }, () => "0");
  return Number(raw) || 0;
}
// নোটিশের পাতা খুললে সব "দেখা হয়েছে"
export function markSeen(uid: string, latest: number) {
  try { localStorage.setItem(seenKey(uid), String(latest)); window.dispatchEvent(new Event(SEEN_EVENT)); } catch { /* ব্রাউজারে রাখা না গেলে বাদ */ }
}

function useNav(items: NavItem[], uid: string, remaining: number, noticeTimes: number[]) {
  const path = usePathname();
  const seen = useSeen(uid);
  const unseen = noticeTimes.filter((t) => t > seen).length;
  const active = (h: string) => (h === "/evaluator" ? path === h : path === h || path.startsWith(h + "/"));
  const count = (b?: NavItem["badge"]) => (b === "mark" ? remaining : b === "notices" ? unseen : 0);
  return { items, active, count, unseen };
}

const base = "flex items-center gap-3 rounded-lg border-l-4 px-4 py-3 transition-colors";
const on = "border-primary bg-primary/10 text-primary dark:border-primary-fixed dark:bg-primary-fixed/10 dark:text-primary-fixed";
const off = "border-transparent text-on-surface-variant hover:border-outline-variant hover:bg-surface-container-low dark:text-surface-variant dark:hover:bg-inverse-surface";

export function EvSideNav({ items, uid, remaining, noticeTimes }: { items: NavItem[]; uid: string; remaining: number; noticeTimes: number[] }) {
  const { active, count } = useNav(items, uid, remaining, noticeTimes);
  return (
    <nav className="flex grow flex-col gap-2 font-bold" aria-label="খাতা মূল্যায়ন">
      {items.map((m) => {
        const c = count(m.badge);
        return (
          <Link key={m.href} href={m.href} aria-current={active(m.href) ? "page" : undefined} className={`${base} ${active(m.href) ? on : off}`}>
            <span className="icon">{m.icon}</span><span>{m.label}</span>
            {c > 0 && <span className={`ml-auto grid h-[22px] min-w-[22px] place-items-center rounded-full px-1.5 text-xs font-bold text-white ${m.badge === "notices" ? "bg-error" : "bg-amber-500"}`}>{bn(c)}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function EvChips({ items, uid, remaining, noticeTimes, back }: { items: NavItem[]; uid: string; remaining: number; noticeTimes: number[]; back: [string, string] | null }) {
  const { active, count } = useNav(items, uid, remaining, noticeTimes);
  return (
    <div className="no-scrollbar -mx-5 mb-3 overflow-x-auto px-5 lg:hidden">
      <div className="flex w-max gap-2">
        {items.map((m) => {
          const c = count(m.badge);
          return (
            <Link key={m.href} href={m.href} aria-current={active(m.href) ? "page" : undefined} className="chip-link">
              <span className="icon text-[18px]">{m.icon}</span>{m.label}{c > 0 && <span className={`ml-1 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] font-bold text-white ${m.badge === "notices" ? "bg-error" : "bg-amber-500"}`}>{bn(c)}</span>}
            </Link>
          );
        })}
        {back && <Link href={back[0]} className="chip-link"><span className="icon text-[18px]">arrow_back</span>{back[1]}</Link>}
      </div>
    </div>
  );
}

// উপরের ঘণ্টা: নতুন নোটিশ থাকলে লাল ফোঁটা
export function EvBell({ uid, noticeTimes }: { uid: string; noticeTimes: number[] }) {
  const seen = useSeen(uid);
  const dot = noticeTimes.some((t) => t > seen);
  return (
    <Link href="/evaluator/notices" aria-label="নোটিশ" className="relative flex text-on-surface-variant transition-colors hover:text-primary dark:text-surface-variant">
      <span className="icon">notifications</span>
      {dot && <span className="absolute top-0 right-0 h-2 w-2 animate-pulse rounded-full bg-error" />}
    </Link>
  );
}
