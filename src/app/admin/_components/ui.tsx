import Link from "next/link";
import type { ReactNode } from "react";

// অ্যাডমিন প্যানেলের ছোট অংশ, হুবহু admin_dashboard.html এর badge / avatar / emptyState / tabs / পাতার মাথা
export const TONE = {
  green: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40",
  amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40",
  red: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/40",
  blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/40",
  gray: "bg-surface-container-high dark:bg-white/10 text-on-surface-variant dark:text-surface-variant border-outline-variant/30",
  purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/40",
  cyan: "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/40",
} as const;
export type Tone = keyof typeof TONE;

export const ROLE: Record<string, { label: string; tone: Tone }> = {
  student: { label: "শিক্ষার্থী", tone: "blue" },
  teacher: { label: "শিক্ষক", tone: "green" },
  manager: { label: "ম্যানেজার", tone: "amber" },
  admin: { label: "অ্যাডমিন", tone: "purple" },
  evaluator: { label: "মূল্যায়নকারী", tone: "cyan" },
};

export function Badge({ tone, icon, children }: { tone: Tone; icon?: string; children: ReactNode }) {
  return <span className={`badge ${TONE[tone]}`}>{icon && <span className="icon text-[13px]">{icon}</span>}{children}</span>;
}

export function Avatar({ name, size = "h-10 w-10" }: { name: string; size?: string }) {
  return (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 font-bold text-primary dark:bg-primary-fixed/10 dark:text-primary-fixed`}>
      {Array.from((name || "?").trim())[0]}
    </div>
  );
}

export function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="py-14 text-center">
      <span className="icon text-5xl text-outline-variant">{icon}</span>
      <p className="mt-3 font-bold muted">{text}</p>
    </div>
  );
}

// পাতার মাথা: শিরোনাম, নিচে ছোট লেখা, ডানে বোতাম
export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="reveal mb-3 flex flex-col justify-between gap-2 md:mb-6 md:flex-row md:items-end md:gap-4">
      <div>
        <h2 className="text-2xl font-bold text-on-background md:text-3xl dark:text-background">{title}</h2>
        {sub && <p className="mt-1 text-sm muted">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

// "অপেক্ষমাণ (৩) · অনুমোদিত (৫) ..." ট্যাব; ঠিকানা বদলায়, তাই refresh/শেয়ারেও একই জায়গা
export function TabLinks({ items, active, href }: { items: { key: string; label: string; count?: string }[]; active: string; href: (key: string) => string }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((t) => (
        <Link key={t.key} href={href(t.key)} role="tab" aria-selected={active === t.key} aria-current={active === t.key ? "page" : undefined} className="tab">
          {t.label}{t.count !== undefined && <span className="opacity-70"> ({t.count})</span>}
        </Link>
      ))}
    </div>
  );
}

export const when = (iso: string) => new Date(iso).toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });
export const day = (iso: string) => new Date(iso).toLocaleDateString("bn-BD", { dateStyle: "medium", timeZone: "Asia/Dhaka" });
