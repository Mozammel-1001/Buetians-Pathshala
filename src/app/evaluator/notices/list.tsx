"use client";

import { useEffect, useState } from "react";
import { markSeen } from "../nav";
import { fmtDate, seenKey } from "../lib";
import type { NoticeRow } from "../data";
import { Badge, CARD, MUTED } from "../ui";

// নোটিশের তালিকা। "নতুন" = এই browser এ আগে না দেখা; পাতা খুললে সব দেখা হয়ে যায় (ঘণ্টার ফোঁটা ও ব্যাজ নিভে),
// কিন্তু এই পাতায় "নতুন" চিহ্ন বাকি থাকে
export function NoticeList({ uid, list }: { uid: string; list: NoticeRow[] }) {
  const [seen, setSeen] = useState(Infinity);   // browser এ কী দেখা হয়েছে জানার আগে কিছুই "নতুন" নয় (hydration এ গরমিল এড়াতে)
  useEffect(() => {
    const t = setTimeout(() => {
      let s = 0;
      try { s = Number(localStorage.getItem(seenKey(uid))) || 0; } catch { /* পাওয়া না গেলে সব নতুন */ }
      setSeen(s);
      if (list.length) markSeen(uid, Math.max(...list.map((n) => n.at)));
    }, 0);
    return () => clearTimeout(t);
  }, [uid, list]);
  return (
    <>
      <h2 className="text-2xl font-bold text-on-background md:text-3xl dark:text-background">নোটিশ</h2>
      <p className={`mt-1 mb-3 text-sm md:mb-6 ${MUTED}`}>অ্যাডমিন যা জানিয়েছেন</p>
      <div className="space-y-2 md:space-y-4">
        {list.map((n, i) => (
          <div key={n.id} className={`ev-row ${CARD} rounded-2xl! p-5 ${n.at > seen ? "border-primary/50! dark:border-primary-fixed/40!" : ""}`} style={{ "--i": i } as React.CSSProperties}>
            <div className="flex items-start justify-between gap-3"><h3 className="font-bold text-on-background dark:text-background">{n.title}</h3>{n.at > seen && <Badge tone="red">নতুন</Badge>}</div>
            <p className={`mt-2 text-sm whitespace-pre-line ${MUTED}`}>{n.body}</p>
            <div className={`mt-3 text-xs ${MUTED}`}>অ্যাডমিন · {fmtDate(n.at)}</div>
          </div>
        ))}
        {!list.length && <div className={`${CARD} ${MUTED} p-8 text-center`}>কোনো নোটিশ নেই</div>}
      </div>
    </>
  );
}
