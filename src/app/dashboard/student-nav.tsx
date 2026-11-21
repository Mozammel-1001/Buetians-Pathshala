"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useToast } from "../admin/_components/kit";

// শিক্ষার্থীর ড্যাশবোর্ডের পাশের মেনু (বড় পর্দায়) আর ছোট পর্দার চিপ: dashboard.html এর sidebar অনুযায়ী
type Item = { href?: string; icon: string; label: string; badge?: number };
export const STUDENT_MENU: Item[] = [
  { href: "/dashboard", icon: "dashboard", label: "ড্যাশবোর্ড" },
  { href: "/dashboard#courses", icon: "school", label: "আমার কোর্সসমূহ" },
  { href: "/dashboard/report", icon: "assessment", label: "পরীক্ষার রিপোর্ট" },
  { href: "/dashboard/leaderboard", icon: "leaderboard", label: "লিডারবোর্ড" },
  { href: "/dashboard/qa", icon: "forum", label: "প্রশ্নোত্তর" },
  { href: "/dashboard/materials", icon: "folder_open", label: "স্টাডি ম্যাটেরিয়ালস" },
  { href: "/notes", icon: "edit_note", label: "নোটসমূহ" },
  { href: "/bookmarks", icon: "bookmark", label: "বুকমার্ক" },
  { icon: "assignment", label: "অ্যাসাইনমেন্ট" },
  { icon: "calendar_today", label: "রুটিন" },
  { icon: "settings", label: "সেটিংস" },
];

function useActive() {
  const path = usePathname();
  return (href?: string) => !!href && !href.includes("#") && (href === "/dashboard" ? path === "/dashboard" : path === href || path.startsWith(href + "/"));
}

const base = "flex items-center gap-3 rounded-lg border-l-4 px-4 py-3 transition-colors";
const on = "border-primary bg-primary/10 text-primary dark:border-primary-fixed dark:bg-primary-fixed/10 dark:text-primary-fixed";
const off = "border-transparent text-on-surface-variant hover:border-outline-variant hover:bg-surface-container-low dark:text-surface-variant dark:hover:bg-inverse-surface";

export function StudentSideNav() {
  const active = useActive();
  const [toast, node] = useToast();
  return (
    <nav className="flex grow flex-col gap-2 font-bold" aria-label="ড্যাশবোর্ড">
      {node}
      {STUDENT_MENU.map((m) => m.href ? (
        <Link key={m.label} href={m.href} aria-current={active(m.href) ? "page" : undefined} className={`${base} ${active(m.href) ? on : off}`}>
          <span className="icon">{m.icon}</span><span>{m.label}</span>
        </Link>
      ) : (
        <button key={m.label} type="button" onClick={() => toast("এই অংশটি শীঘ্রই আসছে", "info")} className={`${base} ${off} text-left`}>
          <span className="icon">{m.icon}</span><span>{m.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function StudentChips() {
  const active = useActive();
  return (
    <div className="no-scrollbar -mx-5 mb-3 overflow-x-auto px-5 lg:hidden">
      <div className="flex w-max gap-2">
        {STUDENT_MENU.filter((m) => m.href).map((m) => (
          <Link key={m.label} href={m.href!} aria-current={active(m.href) ? "page" : undefined} className="chip-link">
            <span className="icon text-[18px]">{m.icon}</span>{m.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
