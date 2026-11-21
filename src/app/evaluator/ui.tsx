import type { ReactNode } from "react";
import Link from "next/link";
import { ago, bn, num, type ExamItem, type Prog, type Kind } from "./lib";

// খাতা মূল্যায়নের পাতার ছোট অংশ: server আর client দুই জায়গাতেই চলে ("use client" নেই)।
// রঙ, বোতাম, card হুবহু demo (evaluator_dashboard.html) এর ক্লাস
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
export const KIND: Record<Kind, [string, ToneKey]> = { written: ["লিখিত", "blue"], mixed: ["MCQ + লিখিত", "purple"], mcq: ["MCQ", "gray"] };
// দ্বিতীয় যাচাইয়ের অবস্থা
export const MOD: Record<string, [string, ToneKey]> = {
  pending: ["দ্বিতীয় যাচাই বাকি", "amber"], agreed: ["দুজনের নম্বর মিলেছে", "green"], flagged: ["পার্থক্য: সিদ্ধান্ত দরকার", "red"], resolved: ["চূড়ান্ত করা হয়েছে", "blue"],
};

export function Badge({ tone, icon, children }: { tone: ToneKey; icon?: string; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${TONE[tone]}`}>{icon && <span className="icon text-[14px]">{icon}</span>}{children}</span>;
}

// একটা অগ্রগতির দণ্ড: কাটা (সবুজ), কারো হাতে (হলুদ), ফেরত (লাল), বাকি (ধূসর)
export function ProgressBar({ pr }: { pr: Prog }) {
  const t = pr.scripts || 1;
  return (
    <div className="ev-bar h-2.5 w-full overflow-hidden rounded-full bg-surface-container-highest dark:bg-on-surface-variant">
      <i className="bg-emerald-500" style={{ width: `${(pr.marked * 100) / t}%` }} /><i className="bg-amber-400" style={{ width: `${(pr.inHand * 100) / t}%` }} /><i className="bg-red-500" style={{ width: `${(pr.returned * 100) / t}%` }} />
    </div>
  );
}
export function Legend({ pr }: { pr: Prog }) {
  const dot = (c: string) => <i className={`inline-block h-2.5 w-2.5 rounded-sm ${c}`} />;
  return (
    <div className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs ${MUTED}`}>
      <span className="inline-flex items-center gap-1">{dot("bg-emerald-500")}কাটা {bn(pr.marked)}</span>
      <span className="inline-flex items-center gap-1">{dot("bg-amber-400")}কারো হাতে {bn(pr.inHand)}</span>
      <span className="inline-flex items-center gap-1">{dot("bg-red-500")}ফেরত {bn(pr.returned)}</span>
      <span className="inline-flex items-center gap-1">{dot("bg-surface-container-highest dark:bg-on-surface-variant")}বাকি {bn(pr.remaining - pr.inHand - pr.returned)}</span>
      {pr.modLeft > 0 && <span className="inline-flex items-center gap-1 font-bold text-purple-700 dark:text-purple-300"><span className="icon text-[14px]">difference</span>দ্বিতীয় যাচাই বাকি {bn(pr.modLeft)}{pr.flagged ? ` (পার্থক্য ${bn(pr.flagged)})` : ""}</span>}
      <span>মোট {bn(pr.scripts)}টি খাতা</span>
    </div>
  );
}

// ড্যাশবোর্ডের পরিসংখ্যানের ছোট card
export function Tile({ icon, cls, value, label, sub, tilt }: { icon: string; cls: string; value: ReactNode; label: string; sub?: string; tilt?: boolean }) {
  return (
    <div className={`${tilt ? "tilt-card " : ""}${CARD} rounded-2xl! p-5`}>
      <div className={`mb-3 grid h-11 w-11 place-items-center rounded-full ${cls}`}><span className="icon">{icon}</span></div>
      <div className="text-2xl font-bold text-on-background dark:text-background">{value}</div>
      <div className={`mt-1 text-sm font-bold ${MUTED}`}>{label}</div>
      {sub && <div className={`mt-1 text-xs ${MUTED}`}>{sub}</div>}
    </div>
  );
}
export const TILE_COLORS = {
  green: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
  blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
  amber: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
  red: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
};

// পরীক্ষার card (ড্যাশবোর্ড আর "খাতা কাটা" দুই জায়গায়)
export function ExamCard({ e, i, now }: { e: ExamItem; i: number; now: number }) {
  const pr = e.prog, work = (pr.remaining > 0 || pr.modLeft > 0) && !e.published;
  return (
    <div className={`ev-row ${CARD} flex flex-col gap-3 rounded-2xl! p-5`} style={{ "--i": i } as React.CSSProperties}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h4 className="font-bold text-on-background dark:text-background">{e.title}</h4>
          <p className={`mt-1 text-xs ${MUTED}`}>{e.course} · পরীক্ষা শেষ {ago(e.closesAt, now)}</p></div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={KIND[e.kind][1]}>{KIND[e.kind][0]}</Badge>
          {e.published ? <Badge tone="green" icon="verified">ফল প্রকাশিত</Badge> : pr.remaining ? <Badge tone="amber">{bn(pr.remaining)}টি বাকি</Badge> : pr.modLeft ? <Badge tone="purple">দ্বিতীয় যাচাই বাকি</Badge> : <Badge tone="green" icon="task_alt">কাটা শেষ</Badge>}
        </div>
      </div>
      <ProgressBar pr={pr} /><Legend pr={pr} />
      <div className="mt-1 flex gap-2">
        <Link href={`/evaluator/mark/${e.id}`} className={`${work ? BTN_PRI : BTN_GHOST} flex-1`}><span className="icon text-[18px]">{work ? "rate_review" : "visibility"}</span>{work ? "খাতা কাটুন" : "দেখুন"}</Link>
      </div>
    </div>
  );
}

// "পরীক্ষা নেই" ফাঁকা অবস্থা
export const Empty = ({ children }: { children: ReactNode }) => <div className={`${CARD} ${MUTED} p-8 text-center`}>{children}</div>;

// নমুনা খাতার ফল: আমার নম্বর বনাম শিক্ষকের নম্বর
export function CalTable({ rows, full }: { rows: { code: string; mine: number; teacher: number; within: boolean }[]; full: number }) {
  return (
    <div className="mt-4 overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className={`border-b border-outline-variant/20 text-left text-xs ${MUTED}`}><th className="py-2 pr-3">নমুনা খাতা</th><th className="py-2 pr-3">আপনার নম্বর</th><th className="py-2 pr-3">শিক্ষকের নম্বর</th><th className="py-2">ফল</th></tr></thead>
      <tbody>{rows.map((f) => (
        <tr key={f.code} className="border-b border-outline-variant/10"><td className="py-2 pr-3 font-mono">#{f.code}</td><td className="py-2 pr-3 font-bold">{num(f.mine)}/{bn(full)}</td><td className="py-2 pr-3">{num(f.teacher)}</td>
          <td className="py-2">{f.within ? <Badge tone="green">কাছাকাছি</Badge> : <Badge tone="red">পার্থক্য বেশি</Badge>}</td></tr>
      ))}</tbody>
    </table></div>
  );
}
