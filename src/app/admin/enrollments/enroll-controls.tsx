"use client";

import { useActionState, useState } from "react";
import { useConfirmSubmit } from "../_components/kit";
import { extendEnrollment, manualEnroll, revokeEnrollment } from "./actions";

// একটা সারির কাজ: মেয়াদ বাড়ানো (তারিখ), বাতিল (কারণ, শুধু admin)
export function RowControls({ id, status, canRevoke }: { id: number; status: string; canRevoke: boolean }) {
  const [eState, extend, extending] = useActionState(extendEnrollment, undefined);
  const [rState, revoke, revoking] = useActionState(revokeEnrollment, undefined);
  const [open, setOpen] = useState<"" | "extend" | "revoke">("");
  const [onSubmit, node] = useConfirmSubmit(() => open === "revoke" ? { title: "এনরোলমেন্ট বাতিল করবেন?", tone: "danger", icon: "person_remove", ok: "হ্যাঁ, বাতিল করুন", body: "শিক্ষার্থী আর কোর্স দেখতে পারবে না। আবার চালু করতে ম্যানুয়াল এনরোল করতে হবে।" } : null);
  const error = eState?.error ?? rState?.error;
  if (status === "revoked") return <span className="block text-right text-xs muted">বাতিল</span>;
  return (
    <div className="relative flex justify-end gap-1">
      {node}
      <button type="button" className="icon-btn" title="মেয়াদ বাড়ান" aria-label="মেয়াদ বাড়ান" onClick={() => setOpen(open === "extend" ? "" : "extend")}><span className="icon text-[20px]">update</span></button>
      {canRevoke && <button type="button" className="icon-btn hover:text-error!" title="বাতিল" aria-label="বাতিল" onClick={() => setOpen(open === "revoke" ? "" : "revoke")}><span className="icon text-[20px]">person_remove</span></button>}
      {open && (
        <form action={open === "extend" ? extend : revoke} className="absolute top-full right-0 z-30 mt-1 w-64 space-y-2 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-3 text-left shadow-lg dark:bg-inverse-surface"
          onSubmit={onSubmit}>
          <input type="hidden" name="id" value={id} />
          {open === "extend" ? (
            <><label className="label" htmlFor={`u-${id}`}>নতুন মেয়াদ (শেষ দিন)</label><input id={`u-${id}`} name="until" type="date" className="field" required /></>
          ) : (
            <><label className="label" htmlFor={`r-${id}`}>বাতিলের কারণ</label><input id={`r-${id}`} name="reason" className="field" placeholder="কেন বাতিল" required /></>
          )}
          <button disabled={extending || revoking} className={open === "revoke" ? "btn-danger w-full py-2!" : "btn-primary w-full py-2!"}>{extending || revoking ? "হচ্ছে…" : open === "extend" ? "মেয়াদ বাড়ান" : "বাতিল করুন"}</button>
          {error && <p className="text-xs font-bold text-error" role="alert">{error}</p>}
        </form>
      )}
    </div>
  );
}

// "ম্যানুয়াল এনরোল" বোতাম আর তার ফর্ম (ক্যাশে টাকা নেওয়া, স্কলারশিপ ইত্যাদির জন্য)
// startOpen: ম্যানেজারের ড্যাশবোর্ডের "ম্যানুয়াল এনরোল" কার্ড থেকে এলে (?manual=1) ফর্ম খোলা অবস্থায়
export function ManualEnroll({ courses, startOpen = false }: { courses: { id: number; title: string }[]; startOpen?: boolean }) {
  const [state, action, pending] = useActionState(manualEnroll, undefined);
  const [open, setOpen] = useState(startOpen);
  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}><span className="icon text-[18px]">how_to_reg</span> ম্যানুয়াল এনরোল</button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="ম্যানুয়াল এনরোল" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <form action={action} className="view-in w-full max-w-md space-y-3 rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-2xl dark:bg-inverse-surface">
            <div className="flex items-center justify-between"><h3 className="section-title">ম্যানুয়াল এনরোল</h3><button type="button" className="icon-btn" aria-label="বন্ধ" onClick={() => setOpen(false)}><span className="icon">close</span></button></div>
            {state?.ok ? (
              <div className="space-y-3 py-4 text-center"><span className="icon text-5xl text-primary dark:text-primary-fixed">task_alt</span><p className="font-bold">এনরোল হয়ে গেছে</p><button type="button" className="btn-primary" onClick={() => setOpen(false)}>ঠিক আছে</button></div>
            ) : (
              <>
                <div><label className="label" htmlFor="me-who">শিক্ষার্থীর আইডি বা মোবাইল</label><input id="me-who" name="who" className="field" placeholder="BP-1001 বা 01XXXXXXXXX" required /></div>
                <div><label className="label" htmlFor="me-course">কোর্স</label><select id="me-course" name="course" className="field" required>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></div>
                <div><label className="label" htmlFor="me-until">মেয়াদ শেষ (ফাঁকা হলে সীমাহীন)</label><input id="me-until" name="until" type="date" className="field" /></div>
                <div><label className="label" htmlFor="me-note">কারণ</label><input id="me-note" name="note" className="field" placeholder="স্কলারশিপ, ক্যাশ পেমেন্ট ..." required /></div>
                {state?.error && <p className="text-sm font-bold text-error" role="alert">{state.error}</p>}
                <button disabled={pending} className="btn-primary w-full">{pending ? "হচ্ছে…" : "এনরোল করুন"}</button>
              </>
            )}
          </form>
        </div>
      )}
    </>
  );
}
