"use client";

import { useRef, useState, type ReactNode } from "react";
import { bn, type Course } from "@/lib/content-schema";
import { CourseCard } from "./course-card";

// সব কোর্সের পাতা (courses.html) হুবহু: বাঁয়ে খোঁজার বাক্স আর ক্যাটাগরির টিক-বাক্স, ডানে "কতটির মধ্যে কত"
// আর "দেখান" বাছাই, তিন কলামের কার্ড, নিচে পাতা নম্বরের বোতাম (আগে/পরে তীরসহ)।
// ডেমোতে খোঁজা আর টিক-বাক্স শুধু সাজানো ছিল, এখানে কাজও করে: একাধিক ক্যাটাগরি টিক দিলে "বা", খোঁজার সাথে "এবং"।
// টিক-বাক্সের নাম আসে কোর্সের ক্যাটাগরি থেকে (অ্যাডমিন প্যানেল → কোর্স)।
const PER_PAGE = ["6", "9", "12", "all"] as const;
type PerPage = (typeof PER_PAGE)[number];

const box = "rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 dark:border-outline-variant/10 dark:bg-inverse-surface";
const navBtn = "flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container-highest text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary disabled:cursor-default disabled:opacity-50 disabled:hover:bg-surface-container-highest disabled:hover:text-on-surface-variant dark:border-outline-variant/10 dark:bg-inverse-surface";

function FilterGroup({ title, options, picked, onToggle, emptyText }: { title: string; options: string[]; picked: string[]; onToggle: (v: string) => void; emptyText: string }): ReactNode {
  return (
    <div className={box}>
      <h3 className="mb-3 text-sm font-bold">{title}</h3>
      <div className="space-y-3">
        {options.length === 0 && <p className="text-sm text-on-surface-variant/70 dark:text-surface-variant/70">{emptyText}</p>}
        {options.map((o) => (
          <label key={o} className="group flex cursor-pointer items-center gap-3">
            <input type="checkbox" className="filter-check" checked={picked.includes(o)} onChange={() => onToggle(o)} />
            <span className="text-sm text-on-surface-variant transition-colors group-hover:text-primary dark:text-surface-variant dark:group-hover:text-primary-fixed">{o}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// courses ফাঁকা (বা আনা না গেলে) হলেও পাতার বাকি সব থাকে; শুধু কার্ডের জায়গায় লেখা দেখায়
export function CoursesBrowser({ courses, failed = false }: { courses: Course[]; failed?: boolean }) {
  const [q, setQ] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [per, setPer] = useState<PerPage>("6");
  const [page, setPage] = useState(1);
  const gridRef = useRef<HTMLDivElement>(null);

  const catList = [...new Set(courses.map((c) => c.category).filter((x): x is string => !!x))];

  // খোঁজার সময় লেখার ধরন নিয়ে ঝামেলা নেই: য়-এর দুই রকম কোড, ZWJ/ZWNJ আর ছোট-বড় হাতের তফাত ধরা হয় না
  const fold = (x: string) => x.normalize("NFC").replace(/[\u200c\u200d]/g, "").toLowerCase();
  const needle = fold(q.trim());
  const matched = courses.filter((c) =>
    (cats.length === 0 || (!!c.category && cats.includes(c.category))) &&
    (!needle || [c.title, c.batch_name, c.subtitle, c.description, c.category].some((x) => !!x && fold(x).includes(needle))));

  const size = per === "all" ? Math.max(1, matched.length) : Number(per);
  const pageCount = Math.max(1, Math.ceil(matched.length / size));
  const cur = Math.min(page, pageCount);
  const start = (cur - 1) * size;
  const shown = matched.slice(start, start + size);

  const toggle = (set: (f: (a: string[]) => string[]) => void) => (v: string) => {
    set((a) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]));
    setPage(1);
  };
  const go = (n: number) => {
    setPage(n);
    const el = gridRef.current;
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 100, behavior: "smooth" });
  };

  const info = matched.length === 0
    ? "০টি কোর্স পাওয়া গেছে"
    : `${bn(matched.length)}টি কোর্সের মধ্যে ${bn(start + 1)}-${bn(Math.min(start + size, matched.length))} নম্বর দেখানো হচ্ছে`;

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-8">
      <aside className="flex w-full shrink-0 flex-col gap-3 md:w-64 md:gap-6">
        <div className={box}>
          <h3 className="mb-3 text-sm font-bold">কোর্স খুঁজুন</h3>
          <div className="relative">
            <span className="icon absolute top-1/2 left-3 -translate-y-1/2 text-[18px] text-on-surface-variant dark:text-surface-variant">search</span>
            <input type="text" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="খুঁজুন..." aria-label="কোর্স খুঁজুন"
              className="w-full rounded-md border border-outline-variant/30 bg-background py-2 pr-3 pl-10 text-sm text-on-surface placeholder-on-surface-variant/70 focus:border-primary focus:outline-none dark:border-outline-variant/20 dark:bg-on-background dark:text-background dark:focus:border-primary-fixed" />
          </div>
        </div>
        <FilterGroup title="ক্যাটাগরি" options={catList} picked={cats} onToggle={toggle(setCats)} emptyText="এখনো কোনো ক্যাটাগরি নেই" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className={`mb-3 flex flex-col items-center justify-between gap-2 sm:flex-row md:mb-6 md:gap-4 ${box}`}>
          <span className="text-sm font-bold text-on-surface-variant dark:text-surface-variant" id="showing-text" aria-live="polite">{info}</span>
          <div className="flex items-center gap-3 text-sm">
            <label htmlFor="per-page" className="font-bold text-on-surface-variant dark:text-surface-variant">দেখান:</label>
            <select id="per-page" value={per} onChange={(e) => { setPer(e.target.value as PerPage); setPage(1); }} className="cf-select h-10 cursor-pointer rounded-md border border-outline-variant/30 bg-background py-1.5 pr-8 pl-3 font-medium text-on-surface focus:border-primary focus:outline-none dark:border-outline-variant/20 dark:bg-on-background dark:text-background">
              {PER_PAGE.map((v) => <option key={v} value={v}>{v === "all" ? "সব" : v}</option>)}
            </select>
          </div>
        </div>

        <div ref={gridRef} id="course-grid" className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {shown.map((c, i) => <CourseCard key={c.id} c={c} delay={(i % 3 + 1) * 100} />)}
        </div>
        {matched.length === 0 && (
          <p className="card p-10 text-center text-sm font-bold muted" role="status">
            {failed ? "কোর্সের তালিকা আনা যায়নি, একটু পরে আবার দেখুন।" : courses.length === 0 ? "এই মুহূর্তে কোনো কোর্স চলমান নেই" : "এই খোঁজা বা ফিল্টারে কোনো কোর্স মেলেনি।"}
          </p>
        )}

        {pageCount > 1 && (
          <nav className="mt-5 flex flex-wrap justify-center gap-2 md:mt-10 text-sm font-bold" aria-label="পাতা">
            <button type="button" className={navBtn} disabled={cur === 1} onClick={() => go(cur - 1)} aria-label="আগের পাতা"><span className="icon text-lg">chevron_left</span></button>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" onClick={() => go(n)} aria-current={n === cur ? "page" : undefined}
                className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${n === cur
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline-variant/30 bg-surface-container-highest text-on-surface-variant hover:bg-primary/10 hover:text-primary dark:border-outline-variant/10 dark:bg-inverse-surface"}`}>
                {bn(n)}
              </button>
            ))}
            <button type="button" className={navBtn} disabled={cur === pageCount} onClick={() => go(cur + 1)} aria-label="পরের পাতা"><span className="icon text-lg">chevron_right</span></button>
          </nav>
        )}
      </div>
    </div>
  );
}
