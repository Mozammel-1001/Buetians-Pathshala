"use client";

import { useState } from "react";
import { bn, taka } from "@/lib/content-schema";
import { Modal } from "../_components/kit";
import { Avatar, Badge, ROLE } from "../_components/ui";

export type ProfileData = {
  name: string; code: string; phone: string; email: string | null; role: string; institute: string | null; guardian: string | null; joined: string;
  courses: { title: string; status: string; until: string | null }[];
  payments: { title: string; amount: number; status: string }[];
  teaches: string[];
};

// ইউজারের প্রোফাইল (admin_dashboard.html এর viewUser): যোগাযোগ, এনরোলমেন্ট, পেমেন্ট, শিক্ষক হলে যে কোর্স পড়ান
export function ProfileButton({ p }: { p: ProfileData }) {
  const [open, setOpen] = useState(false);
  const row = (label: string, value: string | null) => value ? <div className="rounded-xl bg-surface-container-low p-3 dark:bg-white/5"><div className="text-xs muted">{label}</div><div className="mt-0.5 font-bold break-all">{value}</div></div> : null;
  return (
    <>
      <button type="button" className="icon-btn" title="প্রোফাইল" aria-label="প্রোফাইল" onClick={() => setOpen(true)}><span className="icon text-[20px]">visibility</span></button>
      <Modal open={open} onClose={() => setOpen(false)} icon="person" title={p.name} sub={`${p.code} · যোগ দিয়েছেন ${p.joined}`} actions={[{ label: "বন্ধ করুন", kind: "ghost" }]}>
        <div className="mb-4 flex items-center gap-3"><Avatar name={p.name} /><Badge tone={ROLE[p.role]?.tone ?? "gray"}>{ROLE[p.role]?.label ?? p.role}</Badge></div>
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {row("ফোন", p.phone)}{row("ইমেইল", p.email)}{row("প্রতিষ্ঠান", p.institute)}{row("অভিভাবকের নম্বর", p.guardian)}
        </div>
        {p.role === "teacher" ? (
          <>
            <div className="mb-2 text-sm font-bold">যে কোর্স পড়ান</div>
            {p.teaches.length ? <ul className="space-y-1 text-sm">{p.teaches.map((t) => <li key={t} className="flex items-center gap-2"><span className="icon text-[16px] text-primary dark:text-primary-fixed">book</span>{t}</li>)}</ul> : <p className="text-sm muted">কোনো কোর্সে যুক্ত নেই</p>}
          </>
        ) : (
          <>
            <div className="mb-2 text-sm font-bold">এনরোলমেন্ট</div>
            {p.courses.length ? (
              <ul className="mb-4 space-y-2 text-sm">{p.courses.map((c, i) => <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline-variant/20 p-2.5"><span className="font-bold">{c.title}</span><span className="text-xs muted">{c.status === "active" ? (c.until ? `মেয়াদ ${c.until}` : "সীমাহীন") : c.status === "revoked" ? "বাতিল" : "মেয়াদোত্তীর্ণ"}</span></li>)}</ul>
            ) : <p className="mb-4 text-sm muted">কোনো কোর্সে নেই</p>}
            <div className="mb-2 text-sm font-bold">পেমেন্ট</div>
            {p.payments.length ? (
              <ul className="space-y-2 text-sm">{p.payments.map((x, i) => <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline-variant/20 p-2.5"><span>{x.title} · <b>{taka(x.amount)}</b></span><Badge tone={x.status === "approved" ? "green" : x.status === "pending" ? "amber" : "red"}>{x.status === "approved" ? "অনুমোদিত" : x.status === "pending" ? "অপেক্ষমাণ" : "বাতিল"}</Badge></li>)}</ul>
            ) : <p className="text-sm muted">কোনো পেমেন্ট নেই</p>}
            {p.payments.length > 0 && <p className="mt-2 text-xs muted">মোট {bn(p.payments.length)}টি আবেদন</p>}
          </>
        )}
      </Modal>
    </>
  );
}
