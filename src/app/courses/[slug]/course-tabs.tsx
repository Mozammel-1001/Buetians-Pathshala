"use client";

import { useState, type ReactNode } from "react";

// কোর্সের পাতার তিন ট্যাব (course_details.html এর switchTab): সক্রিয়টা সবুজ, বাকিগুলো সাদা। প্যানেলগুলো server এ তৈরি হয়ে আসে
export type Tab = { id: string; label: string; panel: ReactNode };

export function CourseTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  return (
    <>
      <div className="reveal flex flex-wrap gap-2" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={active === t.id} onClick={() => setActive(t.id)}
            className={active === t.id
              ? "rounded-md bg-primary px-5 py-3 text-sm font-bold text-on-primary shadow-md transition-transform hover:-translate-y-1 md:px-8"
              : "rounded-md border border-outline-variant/20 bg-surface-container-lowest px-5 py-3 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container-low md:px-8 dark:border-outline-variant/10 dark:bg-inverse-surface dark:text-surface-variant"}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={active !== t.id} className="space-y-4 md:space-y-8">{t.panel}</div>
      ))}
    </>
  );
}
