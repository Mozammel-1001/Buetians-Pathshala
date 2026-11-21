"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ExModal, useExToast, type ModalSpec } from "@/app/practice/ui";
import { deleteMaterial } from "./actions";
import { useTools } from "./tools";
import { bn, dateBd } from "./lib";
import { MUTED } from "@/app/evaluator/ui";
import type { ContentItem } from "./data";

// কোর্সের কন্টেন্টের তালিকা (manage-course-view): ম্যাটেরিয়াল আর রেকর্ডেড ক্লাস। ম্যাটেরিয়াল মোছা যায় (ফাইলসহ);
// লেকচার সরানো শুধু অ্যাডমিনের কাজ (database এ শিক্ষকের লেখার অনুমতি নেই)
const ICON: Record<string, [string, string]> = {
  sheet: ["description", "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"],
  bank: ["quiz", "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"],
  solution: ["task_alt", "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"],
  formula: ["functions", "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"],
  lesson: ["video_library", "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"],
};

export function ContentList({ items, courseId, showCourse }: { items: ContentItem[]; courseId?: number; showCourse: boolean }) {
  const router = useRouter();
  const tools = useTools();
  const [toast, toastNode] = useExToast();
  const [modal, setModal] = useState<ModalSpec | null>(null);
  const [gone, setGone] = useState<string[]>([]);
  const close = useCallback(() => setModal(null), []);
  const ask = (it: ContentItem) => setModal({
    icon: "delete", title: "কন্টেন্টটা মুছবেন?", body: <p className="text-sm">&quot;{it.title}&quot; শিক্ষার্থীদের কাছ থেকেও সরে যাবে, ফাইলও মুছে যাবে।</p>,
    actions: [{ label: "না", kind: "ghost" }, { label: "মুছুন", kind: "danger", id: "t-del-go", onClick: () => {
      void deleteMaterial(it.id).then((r) => { if (r.ok) { setGone((g) => [...g, it.key]); toast("কন্টেন্ট সফলভাবে মুছে ফেলা হয়েছে"); router.refresh(); } else toast(r.error, "error"); });
    } }],
  });
  const list = items.filter((i) => !gone.includes(i.key));
  return (
    <div className="max-w-4xl rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm dark:border-outline-variant/10 dark:bg-inverse-surface">
      <div className="mb-3 flex items-center justify-between border-b border-outline-variant/20 pb-4 md:mb-6">
        <h3 className="text-lg font-bold text-on-background dark:text-background">সকল কন্টেন্ট</h3>
        <button type="button" id="t-new-content" onClick={() => tools.contentType(courseId)} className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-white dark:bg-primary-fixed/10 dark:text-primary-fixed"><span className="icon text-[18px]">add</span> নতুন কন্টেন্ট</button>
      </div>
      <div className="space-y-2 md:space-y-4">
        {list.map((it) => {
          const [icon, cls] = ICON[it.kind === "lesson" ? "lesson" : it.mkind ?? "sheet"] ?? ICON.sheet;
          return (
            <div key={it.key} data-content={it.key} className="group flex flex-col justify-between gap-2 rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5 shadow-sm transition-all duration-300 sm:flex-row sm:items-center md:gap-4 dark:bg-white/5">
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${cls}`}><span className="icon">{icon}</span></div>
                <div><h4 className="text-base font-bold text-on-background dark:text-background">{it.title}</h4>
                  <p className={`mt-1 text-xs ${MUTED}`}>{showCourse ? it.course + " • " : ""}আপলোড: {dateBd(it.at)} • {bn(it.sub)}</p></div>
              </div>
              {it.kind === "material" && <button type="button" title="মুছুন" aria-label="মুছুন" data-act="delete" onClick={() => ask(it)} className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error dark:text-surface-variant dark:hover:text-red-400"><span className="icon text-[20px]">delete</span></button>}
            </div>
          );
        })}
        {!list.length && <p className={`rounded-xl bg-surface-container-low p-8 text-center text-sm dark:bg-white/5 ${MUTED}`}>এখনো কোনো কন্টেন্ট নেই। &quot;নতুন কন্টেন্ট&quot; দিয়ে শুরু করুন।</p>}
      </div>
      <ExModal spec={modal} close={close} />
      {toastNode}
    </div>
  );
}
