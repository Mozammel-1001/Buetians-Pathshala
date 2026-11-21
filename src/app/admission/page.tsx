import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getCirculars } from "@/lib/content";
import { daysLeft } from "@/lib/circulars";
import { bn } from "@/lib/content-schema";

export const metadata: Metadata = { title: "ভর্তি পরীক্ষার বিজ্ঞপ্তি" };

const dateBn = (d: string) => new Date(`${d}T00:00:00+06:00`).toLocaleDateString("bn-BD", { dateStyle: "long", timeZone: "Asia/Dhaka" });
const badge = "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] leading-none font-bold whitespace-nowrap";

// ভর্তি পরীক্ষার বিজ্ঞপ্তি: অ্যাডমিন প্যানেল থেকে দেওয়া সব বিজ্ঞপ্তি, শেষ তারিখ অনুযায়ী (আগে শেষ হবে যেটা সেটা আগে)।
// প্রতিটার বিস্তারিত admission_circular.html এর মতো আলাদা পাতায়
export default function AdmissionPage() {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-margin-mobile pt-2.5 pb-5 md:px-margin-desktop md:pt-5 md:pb-xl">
      <div className="reveal mt-10 mb-5 text-center md:mt-20 md:mb-10">
        <h1 className="mb-2 text-3xl font-bold text-on-background md:text-4xl dark:text-background">ভর্তি পরীক্ষার <span className="text-primary dark:text-primary-fixed">বিজ্ঞপ্তি</span></h1>
        <p className="mx-auto max-w-2xl text-sm muted md:text-base">বিশ্ববিদ্যালয় আর কলেজের ভর্তি পরীক্ষার বিজ্ঞপ্তি, আবেদনের শেষ তারিখসহ, এক জায়গায়।</p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-surface-container dark:bg-white/5" />}>
        <List />
      </Suspense>
    </main>
  );
}

async function List() {
  const rows = await getCirculars();
  await connection();   // "আর কত দিন" প্রতি request এ আজকের তারিখ ধরে
  const now = new Date().getTime();
  if (!rows || rows.length === 0) {
    return <div className="reveal card p-10 text-center"><span className="icon text-5xl text-outline-variant">article</span><p className="mt-3 font-bold muted">{rows ? "এই মুহূর্তে কোনো ভর্তি বিজ্ঞপ্তি নেই" : "বিজ্ঞপ্তি আনা যায়নি, একটু পরে আবার দেখুন।"}</p></div>;
  }
  // যেগুলোর আবেদন চলছে আগে, শেষ হয়ে যাওয়াগুলো নিচে
  const sorted = [...rows].sort((a, b) => Number((daysLeft(a.deadline, now) ?? 1) < 0) - Number((daysLeft(b.deadline, now) ?? 1) < 0));
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6">
      {sorted.map((c, i) => {
        const d = daysLeft(c.deadline, now);
        return (
          <div key={c.id} className="reveal h-full" style={{ transitionDelay: `${(i % 2) * 100}ms` }}>
            <div className={`tilt-card card flex h-full flex-col rounded-2xl! p-6 ${d !== null && d < 0 ? "opacity-70" : ""}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className={`${badge} border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800/40 dark:bg-purple-900/20 dark:text-purple-300`}><span className="icon text-[13px]">account_balance</span>{c.institution}</span>
                {d === null ? null : d < 0 ? <span className={`${badge} border-red-200 bg-red-50 text-red-700`}><span className="icon text-[13px]">event_busy</span>আবেদন শেষ</span>
                  : <span className={`${badge} ${d <= 7 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}><span className="icon text-[13px]">timer</span>আর {bn(d)} দিন</span>}
              </div>
              <h2 className="mb-2 text-lg font-bold text-on-background dark:text-background">{c.title}</h2>
              {c.deadline && <p className="mb-4 flex items-center gap-1 text-sm muted"><span className="icon text-[16px]">event</span>শেষ তারিখ: {dateBn(c.deadline)}</p>}
              <div className="mt-auto flex gap-2">
                {c.body && <Link href={`/admission/${c.id}`} className="btn-primary flex-1"><span className="icon text-[18px]">description</span> বিস্তারিত পড়ুন</Link>}
                {c.apply_url && <a href={c.apply_url} target="_blank" rel="noopener noreferrer" className="btn-outline flex-1"><span className="icon text-[18px]">open_in_new</span> আবেদন লিংক</a>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
