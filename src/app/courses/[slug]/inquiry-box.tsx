"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { bn } from "@/lib/content-schema";
import { useConfirmSubmit } from "@/app/admin/_components/kit";
import { askInquiry, deleteInquiry } from "./inquiry-actions";

export type Inquiry = { id: number; body: string; when: string; mine: boolean; answers: { body: string; when: string }[] };

// course_details.html এর "প্রশ্ন ও উত্তর" ট্যাব: প্রশ্ন লেখা (লগইন থাকলে), আগের প্রশ্ন ও উত্তর, খোঁজা, নিজের অপেক্ষমাণ প্রশ্ন মোছা
export function InquiryBox({ courseId, slug, list, loggedIn, who }: { courseId: number; slug: string; list: Inquiry[]; loggedIn: boolean; who: string | null }) {
  const [state, ask, asking] = useActionState(askInquiry, undefined);
  const [body, setBody] = useState("");
  const [q, setQ] = useState("");
  const rows = list.filter((x) => !q || x.body.includes(q) || x.answers.some((a) => a.body.includes(q)));
  const back = `/courses/${slug}`;
  return (
    <>
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm md:p-8 dark:border-outline-variant/10 dark:bg-inverse-surface">
        <div className="mb-3 flex items-start gap-4 md:mb-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary-fixed/10 dark:text-primary-fixed"><span className="icon">support_agent</span></div>
          <div><h2 className="text-xl font-bold text-on-background md:text-2xl dark:text-background">ভর্তি নিয়ে প্রশ্ন ও উত্তর</h2>
            <p className="mt-1 text-sm muted">কোর্স ফি, পেমেন্ট, ক্লাসের সময় বা ভর্তি নিয়ে কিছু জানতে চাইলে প্রশ্ন করুন। ম্যানেজার বা অ্যাডমিন উত্তর দেবেন।</p></div>
        </div>
        {loggedIn ? (
          <form action={(fd) => { ask(fd); setBody(""); }} className="space-y-2">
            <input type="hidden" name="course_id" value={courseId} />
            {who && <p className="text-xs muted"><b>{who}</b> হিসেবে প্রশ্ন করছেন</p>}
            <textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={3} aria-label="আপনার প্রশ্ন"
              className="field min-h-[90px] resize-y" placeholder="যেমন: কিস্তিতে টাকা দেওয়া যায়? ক্লাস কোন সময় হয়?" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs muted">উত্তর আসার আগে প্রশ্নটা শুধু আপনি দেখবেন। উত্তর এলে সবাই দেখতে পাবে।</p>
              <button disabled={asking || body.trim().length < 10} className="btn-primary"><span className="icon text-[18px]">send</span>{asking ? "পাঠানো হচ্ছে…" : "প্রশ্ন পাঠান"}</button>
            </div>
            {state?.error && <p className="text-sm font-bold text-error" role="alert">{state.error}</p>}
            {state?.ok && <p className="text-sm font-bold text-primary dark:text-primary-fixed" role="status">প্রশ্ন পাঠানো হয়েছে। উত্তর এলে এখানে দেখবেন।</p>}
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-outline-variant/50 p-4">
            <p className="text-sm muted">উত্তর এলে আপনাকে জানাতে লগইন দরকার। আগের প্রশ্ন ও উত্তর নিচে দেখুন।</p>
            <Link href={`/sign-in?next=${encodeURIComponent(back)}`} className="btn-primary"><span className="icon text-[18px]">login</span>প্রশ্ন করতে লগইন করুন</Link>
          </div>
        )}
      </div>

      <p className="flex items-start gap-1.5 px-1 text-xs muted">
        <span className="icon text-[16px] text-primary dark:text-primary-fixed">school</span>
        <span>পড়াশোনার কোনো প্রশ্ন? ভর্তি হওয়ার পর <Link href="/dashboard/qa" className="font-bold text-primary hover:underline dark:text-primary-fixed">ড্যাশবোর্ডের প্রশ্নোত্তরে</Link> শিক্ষককে জিজ্ঞেস করুন।</span>
      </p>

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h3 className="text-lg font-bold text-on-background dark:text-background">আগের প্রশ্ন ও উত্তর <span className="text-base font-normal muted">({bn(list.length)})</span></h3>
        <div className="relative sm:w-64">
          <span className="icon pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[20px] muted">search</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} className="field pl-10!" placeholder="প্রশ্নে খুঁজুন" aria-label="প্রশ্নে খুঁজুন" />
        </div>
      </div>
      <div className="space-y-3 md:space-y-4">
        {rows.length ? rows.map((x) => <Item key={x.id} x={x} />) : (
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest py-12 text-center dark:border-outline-variant/10 dark:bg-inverse-surface"><span className="icon text-5xl text-outline-variant">forum</span><p className="mt-3 font-bold muted">{q ? "কিছু পাওয়া যায়নি" : "এখনো কোনো প্রশ্ন নেই, প্রথম প্রশ্নটা আপনিই করুন"}</p></div>
        )}
      </div>
    </>
  );
}

function Item({ x }: { x: Inquiry }) {
  const [state, del, deleting] = useActionState(deleteInquiry, undefined);
  const [onSubmit, node] = useConfirmSubmit(() => ({ title: "প্রশ্নটা মুছে ফেলবেন?", tone: "danger", icon: "delete", ok: "হ্যাঁ, মুছুন", body: "উত্তর আসার আগে নিজের প্রশ্ন মুছে ফেলা যায়। মুছলে আর ফেরানো যাবে না।" }));
  const waiting = x.answers.length === 0;
  return (
    <div className={`rounded-2xl border p-4 shadow-sm md:p-5 ${x.mine && waiting ? "border-primary/30 bg-primary/5" : "border-outline-variant/30 bg-surface-container-lowest dark:border-outline-variant/10 dark:bg-inverse-surface"}`}>
      {node}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs muted">{x.mine ? "আপনার প্রশ্ন" : "একজন শিক্ষার্থী"} · {x.when}</span>
        {waiting ? <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700"><span className="icon text-[13px]">hourglass_top</span>উত্তরের অপেক্ষায় · শুধু আপনি দেখছেন</span>
          : <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700"><span className="icon text-[13px]">check_circle</span>উত্তর দেওয়া হয়েছে</span>}
      </div>
      <p className="text-sm font-bold text-on-background dark:text-background">{x.body}</p>
      {x.answers.map((a, i) => (
        <div key={i} className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-800/40 dark:bg-emerald-900/20">
          <div className="mb-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">বুয়েটিয়ান&apos;স পাঠশালা টিম · {a.when}</div>
          <p className="whitespace-pre-line">{a.body}</p>
        </div>
      ))}
      {x.mine && waiting && (
        <form action={del} onSubmit={onSubmit} className="mt-3">
          <input type="hidden" name="id" value={x.id} />
          <button disabled={deleting} className="inline-flex items-center gap-1 text-xs font-bold text-error hover:underline"><span className="icon text-[16px]">delete</span>{deleting ? "মোছা হচ্ছে…" : "মুছুন"}</button>
          {state?.error && <span className="ml-2 text-xs text-error">{state.error}</span>}
        </form>
      )}
    </div>
  );
}
