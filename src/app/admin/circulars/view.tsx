"use client";

import { useActionState, useState } from "react";
import { bn } from "@/lib/content-schema";
import { daysLeft } from "@/lib/circulars";
import { Field, Modal, useConfirmSubmit } from "../_components/kit";
import { Badge, EmptyState, PageHead } from "../_components/ui";
import { deleteCircular, saveCircular } from "./actions";

export type Row = { id: number; institution: string; title: string; body: string | null; apply_url: string | null; deadline: string | null };

const dateBn = (d: string) => new Date(`${d}T00:00:00+06:00`).toLocaleDateString("bn-BD", { dateStyle: "long", timeZone: "Asia/Dhaka" });

// ভর্তি বিজ্ঞপ্তি (admin_dashboard.html এর circulars): কার্ডের গ্রিড, আবেদন লিংক, যোগ/সম্পাদনা/মোছা। আসল ডেটা
export function CircularsView({ rows, now }: { rows: Row[]; now: number }) {
  const [edit, setEdit] = useState<Row | "new" | null>(null);
  const dl = (c: Row) => {
    const d = daysLeft(c.deadline, now);
    if (d === null) return <Badge tone="gray" icon="event">তারিখ নেই</Badge>;
    return d < 0 ? <Badge tone="red" icon="event_busy">আবেদন শেষ</Badge> : d <= 7 ? <Badge tone="amber" icon="timer">আর {bn(d)} দিন</Badge> : <Badge tone="green" icon="timer">আর {bn(d)} দিন</Badge>;
  };
  return (
    <>
      <PageHead title="ভর্তি বিজ্ঞপ্তি" sub={`ওয়েবসাইটের "ভর্তি বিজ্ঞপ্তি" পেজে যা দেখা যাবে`}>
        <button type="button" className="btn-primary" onClick={() => setEdit("new")}><span className="icon text-[18px]">add</span> নতুন বিজ্ঞপ্তি</button>
      </PageHead>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6">
        {rows.length ? rows.map((c, i) => (
          <div key={c.id} className="reveal h-full" style={{ transitionDelay: `${(i % 2) * 100}ms` }}>
            <div className="tilt-card card flex h-full flex-col rounded-2xl! p-6">
              <div className="mb-3 flex items-center justify-between gap-3"><Badge tone="purple" icon="account_balance">{c.institution}</Badge>{dl(c)}</div>
              <h4 className="mb-2 text-lg font-bold text-on-background dark:text-background">{c.title}</h4>
              {c.deadline && <p className="mb-4 flex items-center gap-1 text-sm muted"><span className="icon text-[16px]">event</span>শেষ তারিখ: {dateBn(c.deadline)}</p>}
              <div className="mt-auto flex gap-2">
                {c.apply_url ? <a href={c.apply_url} target="_blank" rel="noopener noreferrer" className="btn-soft flex-1"><span className="icon text-[18px]">open_in_new</span> আবেদন লিংক</a>
                  : <span className="btn-soft flex-1 cursor-default opacity-50"><span className="icon text-[18px]">link_off</span> লিংক নেই</span>}
                <button type="button" className="icon-btn h-10! w-10! border border-outline-variant/30" title="সম্পাদনা" aria-label="সম্পাদনা" onClick={() => setEdit(c)}><span className="icon text-[20px]">edit</span></button>
                <DeleteBtn c={c} />
              </div>
            </div>
          </div>
        )) : <div className="card p-6 md:col-span-2"><EmptyState icon="article" text="কোনো বিজ্ঞপ্তি নেই" /></div>}
      </div>
      {edit && <EditModal key={edit === "new" ? "new" : edit.id} row={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function DeleteBtn({ c }: { c: Row }) {
  const [state, del, pending] = useActionState(deleteCircular, undefined);
  const [onSubmit, node] = useConfirmSubmit(() => ({ title: "বিজ্ঞপ্তি মুছবেন?", sub: c.title, tone: "danger", icon: "delete", ok: "হ্যাঁ, মুছুন", body: "ওয়েবসাইট থেকে সরিয়ে দেওয়া হবে।" }));
  return (
    <form action={del} onSubmit={onSubmit}>
      {node}
      <input type="hidden" name="id" value={c.id} />
      <button disabled={pending} className="icon-btn h-10! w-10! border border-outline-variant/30 hover:text-error!" title={state?.error ?? "মুছুন"} aria-label="মুছুন"><span className="icon text-[20px]">{pending ? "progress_activity" : "delete"}</span></button>
    </form>
  );
}

function EditModal({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const [state, save, pending] = useActionState(async (p: Awaited<ReturnType<typeof saveCircular>>, f: FormData) => {
    const r = await saveCircular(p, f);
    if (r?.ok) onClose();
    return r;
  }, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <Modal open onClose={onClose} icon="article" title={row ? "বিজ্ঞপ্তি আপডেট" : "নতুন বিজ্ঞপ্তি"} sub="ওয়েবসাইটের ভর্তি বিজ্ঞপ্তি পেজে দেখাবে" size="max-w-2xl">
      <form action={save} className="space-y-4">
        <input type="hidden" name="id" value={row?.id ?? ""} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="ci-inst" label="প্রতিষ্ঠান"><input id="ci-inst" name="institution" className="field" defaultValue={row?.institution} placeholder="যেমন: বুয়েট" aria-invalid={!!fe.institution} /></Field>
          <Field id="ci-deadline" label="আবেদনের শেষ তারিখ"><input id="ci-deadline" name="deadline" type="date" className="field" defaultValue={row?.deadline ?? ""} /></Field>
        </div>
        {fe.institution && <p className="-mt-2 text-xs text-error">{fe.institution}</p>}
        <Field id="ci-title" label="শিরোনাম"><input id="ci-title" name="title" className="field" defaultValue={row?.title} placeholder="যেমন: বিজ্ঞান ইউনিট প্রথম বর্ষ স্নাতক ভর্তি ২০২৬-২৭" aria-invalid={!!fe.title} /></Field>
        {fe.title && <p className="-mt-2 text-xs text-error">{fe.title}</p>}
        <Field id="ci-url" label="আবেদন লিংক"><input id="ci-url" name="apply_url" className="field" defaultValue={row?.apply_url ?? ""} placeholder="https://..." aria-invalid={!!fe.apply_url} /></Field>
        {fe.apply_url && <p className="-mt-2 text-xs text-error">{fe.apply_url}</p>}
        <Field id="ci-body" label="বিস্তারিত (ঐচ্ছিক)">
          <textarea id="ci-body" name="body" className="field min-h-[180px] resize-y" defaultValue={row?.body ?? ""} placeholder={"যোগ্যতা, শর্ত, তারিখ...\n# দিয়ে শুরু করলে শিরোনাম, - দিয়ে শুরু করলে তালিকা, > দিয়ে শুরু করলে বিশেষ নোট"} />
        </Field>
        {state?.error && <p className="text-sm font-bold text-error" role="alert">{state.error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>বাতিল</button>
          <button disabled={pending} className="btn-primary">{pending ? "সেভ হচ্ছে…" : row ? "আপডেট করুন" : "প্রকাশ করুন"}</button>
        </div>
      </form>
    </Modal>
  );
}
