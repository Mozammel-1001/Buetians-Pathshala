"use client";

import { useTools } from "./tools";

// ড্যাশবোর্ডের তিনটা কাজের card, কোর্স card এর "কন্টেন্ট যোগ করুন" আর নোটিশ বোতাম: modal গুলো খোলে
const CARD = "tilt-card flex cursor-pointer flex-col items-center rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center hover:border-primary dark:border-outline-variant/10 dark:bg-inverse-surface group";
export function ActionCards() {
  const t = useTools();
  return (
    <div className="reveal mb-4 grid grid-cols-1 gap-2 md:mb-8 md:grid-cols-3 md:gap-6">
      <div id="t-act-material" className={CARD} onClick={() => t.selectCourse("material")}>
        <div className="mb-2 grid h-14 w-14 place-items-center rounded-full bg-blue-100 text-blue-600 transition-transform group-hover:scale-110 md:mb-4 dark:bg-blue-900/30 dark:text-blue-400"><span className="icon text-3xl">cloud_upload</span></div>
        <h3 className="mb-1 font-bold text-on-background md:mb-2 dark:text-background">স্টাডি ম্যাটেরিয়াল আপলোড</h3>
        <p className="mb-2 text-xs text-on-surface-variant md:mb-4 dark:text-surface-variant">পিডিএফ, স্লাইড, নোট বা লেকচার শিট আপলোড করুন</p>
        <button type="button" className="mt-auto w-full rounded-lg bg-blue-50 py-2 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40">ফাইল নির্বাচন করুন</button>
      </div>
      <div id="t-act-video" className={CARD} onClick={() => t.selectCourse("video")}>
        <div className="mb-2 grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600 transition-transform group-hover:scale-110 md:mb-4 dark:bg-emerald-900/30 dark:text-emerald-400"><span className="icon text-3xl">video_file</span></div>
        <h3 className="mb-1 font-bold text-on-background md:mb-2 dark:text-background">রেকর্ডেড ক্লাস আপলোড</h3>
        <p className="mb-2 text-xs text-on-surface-variant md:mb-4 dark:text-surface-variant">প্রি-রেকর্ডেড ভিডিও লেকচার কোর্সে যুক্ত করুন</p>
        <button type="button" className="mt-auto w-full rounded-lg bg-emerald-50 py-2 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/40">ভিডিও আপলোড করুন</button>
      </div>
      <div id="t-act-live" className="tilt-card group relative flex cursor-pointer flex-col items-center overflow-hidden rounded-2xl bg-primary p-6 text-center text-on-primary shadow-md transition-all" onClick={() => t.selectCourse("live")}>
        <div className="absolute top-0 right-0 h-24 w-24 -translate-y-1/2 translate-x-1/4 rounded-full bg-white/10 blur-2xl" />
        <div className="mb-2 grid h-14 w-14 place-items-center rounded-full bg-on-primary/20 backdrop-blur-sm transition-transform group-hover:scale-110 md:mb-4"><span className="icon text-3xl text-white">podcasts</span></div>
        <h3 className="relative z-10 mb-1 font-bold text-white md:mb-2">লাইভ ক্লাস শুরু করুন</h3>
        <p className="relative z-10 mb-2 text-xs text-primary-fixed md:mb-4">আপনার শিডিউল করা লাইভ সেশনে যুক্ত হন</p>
        <button type="button" className="relative z-10 mt-auto w-full rounded-lg bg-on-primary py-2 text-sm font-bold text-primary shadow-sm transition-transform hover:scale-105">গো লাইভ (Go Live)</button>
      </div>
    </div>
  );
}

export function AddContentButton({ courseId }: { courseId: number }) {
  const t = useTools();
  return <button type="button" data-add-content={courseId} onClick={() => t.contentType(courseId)} className="flex-1 rounded-xl bg-surface-container-high py-2.5 text-xs font-bold text-on-surface transition-colors hover:bg-surface-variant sm:text-sm dark:bg-white/10 dark:text-white dark:hover:bg-white/20">কন্টেন্ট যোগ করুন</button>;
}

export function SoonBtn({ className, children, text }: { className: string; children: React.ReactNode; text?: string }) {
  const t = useTools();
  return <button type="button" className={className} onClick={() => t.soon(text)}>{children}</button>;
}
