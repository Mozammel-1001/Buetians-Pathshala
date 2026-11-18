"use client";

import { useActionState, useState } from "react";
import { approvePayment, rejectPayment } from "./actions";

const REASONS = ["এই TrxID bKash এ পাওয়া যায়নি", "টাকার পরিমাণ কম", "অন্য নম্বরে টাকা পাঠানো হয়েছে", "পাঠানোর নম্বর মেলেনি"];

// একটা পেমেন্টের অনুমোদন / বাতিল। বাতিলে কারণ লাগে (শিক্ষার্থী কোর্সের পাতায় দেখবে)
export function ReviewButtons({ id, label }: { id: number; label: string }) {
  const [aState, approve, approving] = useActionState(approvePayment, undefined);
  const [rState, reject, rejecting] = useActionState(rejectPayment, undefined);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const error = aState?.error ?? rState?.error;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <form action={approve} onSubmit={(e) => { if (!confirm(`${label}\n\nbKash এ টাকা এসেছে নিশ্চিত? অনুমোদন দিলে সাথে সাথে ভর্তি চালু হবে।`)) e.preventDefault(); }}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" disabled={approving || rejecting} className="btn-primary py-2!">
            <span className="icon text-[18px]">{approving ? "progress_activity" : "verified"}</span>{approving ? "হচ্ছে…" : "যাচাই হয়েছে, ভর্তি করুন"}
          </button>
        </form>
        <button type="button" onClick={() => setOpen((o) => !o)} disabled={approving || rejecting} className="btn border border-error/40 py-2! text-error hover:bg-error/10">
          <span className="icon text-[18px]">block</span>বাতিল
        </button>
      </div>
      {open && (
        <form action={reject} className="space-y-2 rounded-2xl border border-error/30 p-3">
          <input type="hidden" name="id" value={id} />
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)}
                className={`rounded-full border px-2.5 py-1 text-xs font-bold ${reason === r ? "border-error bg-error/10 text-error" : "border-outline-variant/50 muted"}`}>{r}</button>
            ))}
          </div>
          <input name="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="বাতিলের কারণ (শিক্ষার্থী দেখবে)" className="field" />
          <button type="submit" disabled={rejecting} className="btn bg-error py-2! text-on-error">{rejecting ? "হচ্ছে…" : "বাতিল নিশ্চিত করুন"}</button>
        </form>
      )}
      {error && <p className="text-xs font-bold text-error dark:text-red-300" role="alert">{error}</p>}
    </div>
  );
}
