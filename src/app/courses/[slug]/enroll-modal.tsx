"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { submitPayment } from "../actions";

const bn = (v: string | number) => String(v).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);
const taka = (n: number) => "৳" + bn(Number(n).toLocaleString("en-IN"));
const ACTION = { personal: "Send Money", agent: "Cash Out", merchant: "Payment" } as const;
const TYPE = { personal: "পার্সোনাল", agent: "এজেন্ট", merchant: "মার্চেন্ট" } as const;

type Pay = { bkash_number: string; account_type: keyof typeof ACTION; note: string; review_time: string };

// ভর্তির modal: bKash নম্বর (কপি), টাকার পরিমাণ (কপি), আইডি (Reference), তারপর পাঠানোর নম্বর আর TrxID।
// জমা দিলেই database TrxID মিলিয়ে দেখে: আগে ব্যবহার হয়ে থাকলে সাথে সাথে কারণসহ বাতিল, নইলে "যাচাই বাকি"
export function EnrollButton({ course, pay, userCode, phone, rejectedNote }: {
  course: { id: number; title: string; price: number };
  pay: Pay;
  userCode: string;
  phone: string;
  rejectedNote?: string | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const params = useSearchParams();
  const router = useRouter();
  const [state, action, pending] = useActionState(submitPayment, undefined);
  const [view, setView] = useState<"form" | "result">("form");
  const [seen, setSeen] = useState<number | undefined>(undefined);

  // নতুন ফল এলে: ঘরের ভুল হলে ফর্মেই, বাকি সব ফলাফলের পর্দায়
  if (state?.at && state.at !== seen) {
    setSeen(state.at);
    setView(state.status === "invalid" && state.field ? "form" : "result");
  }

  const open = () => { setView("form"); ref.current?.showModal(); };
  const close = () => ref.current?.close();

  // লগইনের পর ?enroll=1 নিয়ে ফিরলে নিজে খোলে (স্বাগত বার্তা থাকলে সেটা বন্ধের পর)
  const auto = params.get("enroll") === "1" && !params.get("welcome");
  useEffect(() => { if (auto && ref.current && !ref.current.open) ref.current.showModal(); }, [auto]);

  const result = view === "result" ? state : undefined;
  const ok = result?.status === "pending";
  const fieldErr = (f: "sender" | "trx") => (state?.status === "invalid" && state.field === f && view === "form" ? state.reason : undefined);

  return (
    <>
      <button type="button" onClick={open} className="btn-primary enroll-cta mb-3 w-full py-3! md:mb-6">
        <span className="icon text-[20px]">add</span>কোর্সে ভর্তি হোন
      </button>
      {rejectedNote && <p className="mt-3 rounded-xl bg-error/10 p-3 text-xs text-error dark:text-red-300">আগের আবেদন বাতিল হয়েছিল: {rejectedNote}। ঠিক তথ্য দিয়ে আবার আবেদন করুন।</p>}

      <dialog ref={ref} aria-labelledby="enroll-title"
        // আবেদন জমা হলে বন্ধের পর পাতা নতুন করে: বোতামের জায়গায় "যাচাই বাকি"
        onClose={() => { if (view === "result" && state?.status === "pending") router.refresh(); }}
        onClick={(e) => { if (e.target === ref.current) close(); }}
        className="m-auto max-h-[92dvh] w-[min(94vw,520px)] overflow-y-auto rounded-3xl bg-transparent p-0 backdrop:bg-on-background/60 backdrop:backdrop-blur-sm">
        <div className="card relative p-6 md:p-7">
          <button type="button" onClick={close} aria-label="বন্ধ করুন" className="absolute top-4 right-4 grid h-9 w-9 place-items-center rounded-full muted hover:bg-surface-container dark:hover:bg-white/10">
            <span className="icon">close</span>
          </button>

          {!result && (
            <>
              <p className="text-xs font-bold text-primary dark:text-primary-fixed">ভর্তির আবেদন</p>
              <h2 id="enroll-title" className="mt-1 pr-10 text-xl font-bold">{course.title}</h2>
              <p className="mt-1 text-3xl font-bold">{taka(course.price)}</p>

              {!pay.bkash_number ? (
                <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                  পেমেন্টের নম্বর এখনো ঠিক করা হয়নি। একটু পরে আবার চেষ্টা করুন, নয়তো আমাদের সাথে যোগাযোগ করুন।
                </p>
              ) : (
                <>
                  <ol className="mt-5 space-y-3 rounded-2xl border border-[#e2136e]/25 bg-[#e2136e]/[0.04] p-4 text-sm">
                    <Step n={1}>
                      bKash অ্যাপে <b>{ACTION[pay.account_type]}</b> করুন
                      <span className="ml-2 rounded-full bg-[#e2136e] px-2 py-0.5 text-[11px] font-bold text-white">bKash {TYPE[pay.account_type]}</span>
                    </Step>
                    <Step n={2}>
                      <span className="block text-xs muted">এই নম্বরে</span>
                      <span className="flex flex-wrap items-center gap-2">
                        <b className="font-mono text-xl tracking-wider" data-testid="bkash-number">{pay.bkash_number}</b>
                        <CopyButton text={pay.bkash_number} label="নম্বর কপি" compact />
                      </span>
                    </Step>
                    <Step n={3}>
                      <span className="block text-xs muted">টাকার পরিমাণ</span>
                      <span className="flex flex-wrap items-center gap-2">
                        <b className="text-xl">{taka(course.price)}</b>
                        <CopyButton text={String(course.price)} label="পরিমাণ কপি" compact />
                      </span>
                    </Step>
                    <Step n={4}>
                      <span className="block text-xs muted">Reference এ আপনার আইডি</span>
                      <span className="flex flex-wrap items-center gap-2">
                        <b className="font-mono text-base">{userCode}</b>
                        <CopyButton text={userCode} label="আইডি কপি" compact />
                      </span>
                    </Step>
                  </ol>
                  {pay.note && <p className="mt-3 text-xs muted">{pay.note}</p>}

                  <form action={action} className="mt-5 space-y-4" noValidate>
                    <input type="hidden" name="course_id" value={course.id} />
                    <div>
                      <label className="label" htmlFor="sender">যে bKash নম্বর থেকে পাঠিয়েছেন</label>
                      <input id="sender" name="sender" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="০১XXXXXXXXX"
                        defaultValue={state?.values?.sender ?? "0" + phone.slice(3)} aria-invalid={fieldErr("sender") ? true : undefined} className="field text-base" />
                      {fieldErr("sender") && <p className="mt-1 text-xs font-bold text-error dark:text-red-300">{fieldErr("sender")}</p>}
                    </div>
                    <div>
                      <label className="label" htmlFor="trx">TrxID (লেনদেন নম্বর)</label>
                      <input id="trx" name="trx" type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={14}
                        placeholder="যেমন 9A7B6C5D4E" defaultValue={state?.values?.trx ?? ""}
                        onInput={(e) => { const t = e.currentTarget; t.value = t.value.toUpperCase().replace(/\s/g, ""); }}
                        aria-invalid={fieldErr("trx") ? true : undefined} className="field font-mono text-lg tracking-widest" />
                      {fieldErr("trx")
                        ? <p className="mt-1 text-xs font-bold text-error dark:text-red-300">{fieldErr("trx")}</p>
                        : <p className="mt-1 text-xs muted">টাকা পাঠানোর পর bKash এর মেসেজ বা অ্যাপের ইতিহাসে পাবেন।</p>}
                    </div>
                    <button type="submit" disabled={pending} className="btn-primary w-full py-3!">
                      <span className="icon text-[20px]">{pending ? "progress_activity" : "send"}</span>
                      {pending ? "TrxID মিলিয়ে দেখা হচ্ছে…" : "আবেদন জমা দিন"}
                    </button>
                  </form>
                </>
              )}
            </>
          )}

          {result && ok && (
            <div className="pop-in py-2 text-center" role="status">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary text-on-primary shadow-lg shadow-primary/30">
                <svg viewBox="0 0 52 52" className="h-11 w-11" aria-hidden="true"><path className="check-draw" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" d="M14 27l8 8 16-17" /></svg>
              </div>
              <h2 id="enroll-title" className="mt-5 text-2xl font-bold">আবেদন জমা হয়েছে!</h2>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                <span className="icon text-[18px]">hourglass_top</span>যাচাই বাকি
              </p>
              <dl className="mx-auto mt-5 grid max-w-xs grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-left text-sm">
                <dt className="muted">কোর্স</dt><dd className="font-bold">{course.title}</dd>
                <dt className="muted">টাকা</dt><dd className="font-bold">{taka(result.amount ?? course.price)}</dd>
                <dt className="muted">TrxID</dt><dd className="font-mono font-bold">{result.trx_id}</dd>
              </dl>
              <p className="mt-4 text-sm muted">{pay.review_time || "শীঘ্রই যাচাই হবে।"} যাচাই হলে কোর্সটা আপনার ড্যাশবোর্ডে চালু হয়ে যাবে।</p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={close} className="btn-ghost py-3!">বন্ধ করুন</button>
                <Link href="/dashboard" className="btn-primary py-3!">ড্যাশবোর্ডে দেখুন</Link>
              </div>
            </div>
          )}

          {result && !ok && (
            <div className="shake py-2 text-center" role="alert">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-error text-on-error shadow-lg shadow-error/30">
                <span className="icon text-5xl">{result.status === "enrolled" ? "task_alt" : result.status === "pending_exists" ? "hourglass_top" : "block"}</span>
              </div>
              <h2 id="enroll-title" className="mt-5 text-2xl font-bold">
                {result.status === "duplicate" ? "আবেদন বাতিল: TrxID আগে ব্যবহার হয়েছে"
                  : result.status === "enrolled" ? "আপনি আগেই ভর্তি আছেন"
                  : result.status === "pending_exists" ? "আগের আবেদন যাচাই বাকি"
                  : "আবেদন জমা হয়নি"}
              </h2>
              <p className="mx-auto mt-3 max-w-sm rounded-2xl bg-error/10 p-4 text-sm font-bold text-error dark:text-red-300" data-testid="reject-reason">{result.reason}</p>
              {result.trx_id && <p className="mt-2 text-xs muted">দেওয়া TrxID: <span className="font-mono font-bold">{result.trx_id}</span></p>}
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={close} className="btn-ghost py-3!">বন্ধ করুন</button>
                {result.status === "duplicate" || result.status === "invalid" || result.status === "error" ? (
                  <button type="button" onClick={() => setView("form")} className="btn-primary py-3!">ঠিক TrxID দিয়ে আবার</button>
                ) : (
                  <Link href="/dashboard" className="btn-primary py-3!">ড্যাশবোর্ডে দেখুন</Link>
                )}
              </div>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#e2136e] text-xs font-bold text-white">{bn(n)}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}
