"use client";

import { useState } from "react";
import type { Course } from "@/lib/content-schema";
import { CourseCard } from "./course-card";

// ডেমোর মতো "সকল কোর্স / একাডেমিক / ..." বোতাম আর কার্ডের grid। বোতামগুলো আসে কোর্সের ক্যাটাগরি থেকে
// (অ্যাডমিন প্যানেল → কোর্স → ক্যাটাগরি); কোনো কোর্সে ক্যাটাগরি না থাকলে শুধু "সকল কোর্স"
export function CourseGrid({ courses, allLabel, limit }: { courses: Course[]; allLabel: string; limit?: number }) {
  const cats = [...new Set(courses.map((c) => c.category).filter((x): x is string => !!x))];
  const [cat, setCat] = useState<string | null>(null);
  const shown = courses.filter((c) => !cat || c.category === cat).slice(0, limit);
  const pill = (active: boolean) =>
    `rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap transition-colors duration-300 hover:scale-105 md:px-6 md:text-sm ${
      active ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface dark:text-surface-variant dark:hover:text-background"
    }`;

  return (
    <>
      <div className="reveal mb-6 flex md:mb-12 max-w-full justify-center overflow-x-auto pb-2" style={{ transitionDelay: "100ms" }}>
        <div className="inline-flex rounded-full border border-outline-variant/30 bg-surface-container-lowest p-1 shadow-sm transition-colors duration-300 dark:border-outline-variant/10 dark:bg-inverse-surface" role="tablist">
          <button type="button" role="tab" aria-selected={!cat} onClick={() => setCat(null)} className={pill(!cat)}>{allLabel}</button>
          {cats.map((c) => (
            <button key={c} type="button" role="tab" aria-selected={cat === c} onClick={() => setCat(c)} className={pill(cat === c)}>{c}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 md:gap-6">
        {shown.map((c, i) => <CourseCard key={c.id} c={c} delay={Math.min(500, (i % 4 + 1) * 100)} />)}
      </div>
    </>
  );
}
