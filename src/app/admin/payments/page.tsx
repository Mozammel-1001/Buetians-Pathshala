import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SessionGuard } from "@/components/session-guard";
import { CopyButton } from "@/components/copy-button";
import { bn, taka } from "@/lib/content-schema";
import { displayPhone, normalizeBdPhone, normalizeUserCode } from "@/lib/validation";
import { ReviewButtons } from "./review-buttons";

export const metadata: Metadata = { title: "পেমেন্ট যাচাই" };

const TABS = [
  { key: "pending", label: "যাচাই বাকি", icon: "hourglass_top" },
  { key: "approved", label: "অনুমোদিত", icon: "verified" },
  { key: "rejected", label: "বাতিল", icon: "block" },
] as const;

type Row = {
  id: number; amount: number; sender_number: string; trx_id: string; status: string; reject_reason: string | null;
  created_at: string; reviewed_at: string | null;
  student: { full_name: string; user_code: string; phone: string } | null;
  course: { title: string } | null;
  reviewer: { full_name: string } | null;
};

const when = (iso: string) => new Date(iso).toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });

// পেমেন্ট যাচাই (admin আর manager): bKash অ্যাপ/স্টেটমেন্টে TrxID আর টাকা মিলিয়ে অনুমোদন বা কারণসহ বাতিল
export default function PaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">পেমেন্ট যাচাই</h1>
        <p className="mt-1 text-sm muted">bKash এ TrxID, টাকার পরিমাণ আর পাঠানোর নম্বর মিলিয়ে অনুমোদন দিন। অনুমোদনের সাথে সাথে শিক্ষার্থীর ভর্তি চালু হয়।</p>
      </div>
      <Suspense fallback={<div className="card h-64 animate-pulse" />}>
        <Payments searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Payments({ searchParams }: { searchParams: PageProps<"/admin/payments">["searchParams"] }) {
  const me = await requireStaff("/admin/payments");
  const sp = await searchParams;
  const status = TABS.some((t) => t.key === sp.status) ? (sp.status as string) : "pending";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const supabase = await createClient();

  let query = supabase
    .from("payments")
    .select("id, amount, sender_number, trx_id, status, reject_reason, created_at, reviewed_at, student:profiles!payments_user_id_fkey(full_name, user_code, phone), course:courses(title), reviewer:profiles!payments_reviewed_by_fkey(full_name)")
    .order("created_at", { ascending: status === "pending" })
    .limit(100);
  if (q) {
    // খোঁজা: আইডি (BP-1001), মোবাইল নম্বর (শিক্ষার্থীর বা পাঠানোর), নয়তো TrxID এর অংশ
    const code = normalizeUserCode(q);
    const phone = normalizeBdPhone(q);
    if (code || phone) {
      const { data: p } = await supabase.from("profiles").select("id").eq(code ? "user_code" : "phone", code ?? phone!).maybeSingle();
      query = phone ? query.or(`sender_number.eq.${phone}${p ? `,user_id.eq.${p.id}` : ""}`) : query.eq("user_id", p?.id ?? "00000000-0000-0000-0000-000000000000");
    } else {
      query = query.ilike("trx_id", `%${q.toUpperCase().replace(/[^A-Z0-9]/g, "")}%`);
    }
  } else {
    query = query.eq("status", status);
  }

  const [{ data, error }, counts, dup] = await Promise.all([
    query,
    Promise.all(TABS.map((t) => supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", t.key))),
    me.role === "admin"
      ? supabase.from("audit_logs").select("id, meta, created_at, actor:profiles(full_name, user_code)").eq("action", "payment.duplicate_trx").order("id", { ascending: false }).limit(8)
      : Promise.resolve({ data: null }),
  ]);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <SessionGuard />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist">
          {TABS.map((t, i) => (
            <Link key={t.key} href={`/admin/payments?status=${t.key}`} role="tab" aria-selected={!q && status === t.key}
              className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold ${!q && status === t.key ? "border-primary bg-primary text-on-primary" : "border-outline-variant/50 muted hover:border-primary"}`}>
              <span className="icon text-[18px]">{t.icon}</span>{t.label}
              <span className={`rounded-full px-2 text-xs ${!q && status === t.key ? "bg-white/20" : "bg-surface-container dark:bg-white/10"}`}>{bn(counts[i].count ?? 0)}</span>
            </Link>
          ))}
        </div>
        <form className="flex gap-2" role="search">
          <input name="q" defaultValue={q} placeholder="TrxID, আইডি বা মোবাইল" className="field w-56" aria-label="খুঁজুন" />
          <button className="btn-ghost py-2!"><span className="icon text-[18px]">search</span></button>
        </form>
      </div>

      {error && <p className="card p-4 text-sm text-error">তালিকা আনা যায়নি: {error.message}</p>}
      {rows.length === 0 ? (
        <p className="card p-8 text-center text-sm muted">{q ? "কিছু পাওয়া যায়নি।" : status === "pending" ? "যাচাই বাকি কোনো পেমেন্ট নেই। 🎉" : "কিছু নেই।"}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((p) => (
            <li key={p.id} className="card grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto]" data-testid="payment-row">
              <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div>
                  <p className="font-bold">{p.student?.full_name}</p>
                  <p className="text-xs muted">{p.student?.user_code} · {displayPhone(p.student?.phone)}</p>
                </div>
                <div>
                  <p className="font-bold">{p.course?.title}</p>
                  <p className="text-xs muted">{when(p.created_at)}</p>
                </div>
                <div>
                  <span className="block text-xs muted">TrxID</span>
                  <span className="flex items-center gap-2"><b className="font-mono text-base tracking-wider">{p.trx_id}</b><CopyButton text={p.trx_id} compact /></span>
                </div>
                <div className="flex gap-6">
                  <div><span className="block text-xs muted">টাকা</span><b className="text-base">{taka(p.amount)}</b></div>
                  <div><span className="block text-xs muted">পাঠানোর নম্বর</span><b className="font-mono">{displayPhone(p.sender_number)}</b></div>
                </div>
                {p.status !== "pending" && (
                  <p className="text-xs sm:col-span-2">
                    <span className={`mr-2 rounded-full px-2 py-0.5 font-bold ${p.status === "approved" ? "bg-primary/10 text-primary dark:text-primary-fixed" : "bg-error/10 text-error"}`}>
                      {p.status === "approved" ? "অনুমোদিত" : "বাতিল"}
                    </span>
                    <span className="muted">{p.reviewer?.full_name}{p.reviewed_at ? ` · ${when(p.reviewed_at)}` : ""}{p.reject_reason ? ` · কারণ: ${p.reject_reason}` : ""}</span>
                  </p>
                )}
              </div>
              {p.status === "pending" && <ReviewButtons id={p.id} label={`${p.student?.full_name} · ${p.course?.title} · ${taka(p.amount)} · TrxID ${p.trx_id}`} />}
            </li>
          ))}
        </ul>
      )}

      {dup.data && dup.data.length > 0 && (
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-bold"><span className="icon text-error">report</span>আগে ব্যবহার হওয়া TrxID দিয়ে চেষ্টা</h2>
          <p className="mt-1 text-xs muted">এগুলো সাথে সাথে বাতিল হয়েছে, কিছু করতে হবে না। একই জনের বারবার চেষ্টা থাকলে খেয়াল রাখুন।</p>
          <ul className="mt-3 divide-y divide-outline-variant/30 text-sm">
            {(dup.data as unknown as { id: number; meta: { trx_id?: string; same_user?: boolean }; created_at: string; actor: { full_name: string; user_code: string } | null }[]).map((d) => (
              <li key={d.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span><b>{d.actor?.full_name}</b> <span className="muted">{d.actor?.user_code}</span> · <span className="font-mono">{d.meta?.trx_id}</span>{d.meta?.same_user ? <span className="muted"> (নিজের পুরনো)</span> : <span className="font-bold text-error"> (অন্যের)</span>}</span>
                <span className="text-xs muted">{when(d.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
