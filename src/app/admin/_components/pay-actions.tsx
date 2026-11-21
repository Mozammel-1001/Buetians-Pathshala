"use client";

import { useActionState, useState } from "react";
import { approvePayment, rejectPayment } from "../payments/actions";
import { Modal, useConfirmSubmit } from "./kit";

const REASONS = ["এই TrxID bKash এ পাওয়া যায়নি", "টাকার পরিমাণ কম", "অন্য নম্বরে টাকা পাঠানো হয়েছে", "অন্য কারণ"];

// একটা পেমেন্টের অনুমোদন (✓) আর বাতিল (✕): admin_dashboard.html এর মতো দুটোতেই modal। বাতিলে কারণ বাছাই,
// "অন্য কারণ" হলে বিস্তারিত লাগে (শিক্ষার্থী কোর্সের পাতায় আর SMS এ এটা দেখে)। সফল হলে সারিটা তালিকা থেকে সরে যায়, modal ও তার সাথে
export function PayActions({ id, label, wide = false }: { id: number; label: string; wide?: boolean }) {
  const [aState, approve, approving] = useActionState(approvePayment, undefined);
  const [rState, reject, rejecting] = useActionState(rejectPayment, undefined);
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState(REASONS[0]);
  const [detail, setDetail] = useState("");
  const [onApprove, confirmNode] = useConfirmSubmit(() => ({
    title: "পেমেন্ট অনুমোদন করবেন?", icon: "verified", ok: "হ্যাঁ, অনুমোদন করুন",
    body: <><p className="mb-2 font-bold text-on-background dark:text-background">{label}</p><p>bKash এ টাকা এসেছে, আমি নিজে মিলিয়ে দেখেছি। অনুমোদন দিলে সাথে সাথে কোর্স চালু হবে আর কাজটি অডিট লগে থাকবে।</p></>,
  }));
  const error = aState?.error ?? rState?.error;
  const busy = approving || rejecting;
  const reason = pick === "অন্য কারণ" ? detail.trim() : detail.trim() ? `${pick}। ${detail.trim()}` : pick;

  return (
    <div className={wide ? "w-full space-y-2" : "space-y-2"}>
      {confirmNode}
      <div className={`flex gap-2 ${wide ? "" : "justify-end"}`}>
        <form action={approve} className={wide ? "flex-1" : ""} onSubmit={onApprove}>
          <input type="hidden" name="id" value={id} />
          {wide ? (
            <button type="submit" disabled={busy} className="btn-primary w-full"><span className="icon text-[18px]">check</span>{approving ? "হচ্ছে…" : "অনুমোদন"}</button>
          ) : (
            <button type="submit" disabled={busy} title="অনুমোদন" aria-label="অনুমোদন" className="icon-btn-ok"><span className="icon text-[20px]">{approving ? "progress_activity" : "check"}</span></button>
          )}
        </form>
        {wide ? (
          <button type="button" disabled={busy} onClick={() => setOpen(true)} className="btn-outline flex-1 text-error!"><span className="icon text-[18px]">close</span>বাতিল</button>
        ) : (
          <button type="button" disabled={busy} onClick={() => setOpen(true)} title="বাতিল" aria-label="বাতিল" className="icon-btn-bad"><span className="icon text-[20px]">close</span></button>
        )}
      </div>
      {error && <p className="text-xs font-bold text-error dark:text-red-300" role="alert">{error}</p>}

      <Modal open={open} onClose={() => setOpen(false)} icon="block" tone="danger" title="পেমেন্ট বাতিল করবেন?" sub={label}>
        <form action={reject} className="space-y-4 text-left">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="reason" value={reason} />
          <div className="space-y-2">
            {REASONS.map((r) => (
              <label key={r} className="flex cursor-pointer items-center gap-3 rounded-xl border border-outline-variant/30 p-3 text-sm has-[:checked]:border-error has-[:checked]:bg-error/5">
                <input type="radio" name="pick" checked={pick === r} onChange={() => setPick(r)} className="accent-[var(--color-error)]" />{r}
              </label>
            ))}
          </div>
          <div>
            <label className="label" htmlFor={`rj-${id}`}>বিস্তারিত (ঐচ্ছিক, &quot;অন্য কারণ&quot; হলে আবশ্যক)</label>
            <textarea id={`rj-${id}`} value={detail} onChange={(e) => setDetail(e.target.value)} className="field min-h-[80px]" placeholder="যেমন: ভুয়া TrxID, অ্যাকাউন্ট শেয়ার" />
          </div>
          <p className="text-xs muted">বাতিলের কারণ (শিক্ষার্থী SMS এ এটা দেখবে)</p>
          {rState?.error && <p className="text-xs font-bold text-error" role="alert">{rState.error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setOpen(false)}>ফিরে যান</button>
            <button type="submit" disabled={rejecting || reason.length < 3} className="btn-danger">{rejecting ? "হচ্ছে…" : "বাতিল নিশ্চিত করুন"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
