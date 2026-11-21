import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SessionGuard } from "@/components/session-guard";
import { CopyButton } from "@/components/copy-button";
import { bn, taka } from "@/lib/content-schema";
import { getSiteContent } from "@/lib/content";
import { displayPhone, normalizeBdPhone, normalizeUserCode } from "@/lib/validation";
import { CsvButton } from "../_components/csv-button";
import { PayActions } from "../_components/pay-actions";
import { Avatar, Badge, EmptyState, PageHead, TabLinks, when } from "../_components/ui";


const TABS = [
  { key: "pending", label: "অপেক্ষমাণ" },
  { key: "approved", label: "অনুমোদিত" },
  { key: "rejected", label: "বাতিল" },
  { key: "all", label: "সব" },
] as const;

type Row = {
  id: number; amount: number; sender_number: string; trx_id: string; status: string; reject_reason: string | null;
  created_at: string; reviewed_at: string | null;
  student: { full_name: string; user_code: string; phone: string } | null;
  course: { title: string } | null;
  reviewer: { full_name: string } | null;
};

// পেমেন্ট অনুমোদন (admin আর manager), হুবহু admin_dashboard.html এর payments: bKash এ TrxID, টাকা আর প্রেরকের নম্বর মিলিয়ে অনুমোদন
// ম্যানেজার প্যানেলেও একই পাতা (/manager/payments); root দিয়ে লিংকগুলো সেই প্যানেলেই থাকে
export function PaymentsScreen({ searchParams, root }: { searchParams: Promise<Record<string, string | string[] | undefined>>; root: "/admin" | "/manager" }) {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse" />}>
      <Payments searchParams={searchParams} root={root} />
    </Suspense>
  );
}

async function Payments({ searchParams, root }: { searchParams: Promise<Record<string, string | string[] | undefined>>; root: string }) {
  const me = await requireStaff(`${root}/payments`);
  const sp = await searchParams;
  const status = TABS.some((t) => t.key === sp.status) ? (sp.status as string) : "pending";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const courseId = Number(sp.course) || 0;
  const supabase = await createClient();
  const content = await getSiteContent();

  let query = supabase
    .from("payments")
    .select("id, amount, sender_number, trx_id, status, reject_reason, created_at, reviewed_at, student:profiles!payments_user_id_fkey(full_name, user_code, phone), course:courses(title), reviewer:profiles!payments_reviewed_by_fkey(full_name)")
    .order("created_at", { ascending: status === "pending" })
    .limit(200);
  if (status !== "all") query = query.eq("status", status);
  if (courseId) query = query.eq("course_id", courseId);
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
  }

  const [{ data, error }, counts, courses, dup] = await Promise.all([
    query,
    Promise.all(TABS.map((t) => (t.key === "all" ? supabase.from("payments").select("id", { count: "exact", head: true }) : supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", t.key)))),
    supabase.from("courses").select("id, title").order("position").order("id"),
    me.role === "admin"
      ? supabase.from("audit_logs").select("id, meta, created_at, actor:profiles(full_name, user_code)").eq("action", "payment.duplicate_trx").order("id", { ascending: false }).limit(8)
      : Promise.resolve({ data: null }),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const href = (key: string) => `${root}/payments?status=${key}${courseId ? `&course=${courseId}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  const statusBadge = (s: string) =>
    s === "pending" ? <Badge tone="amber" icon="schedule">অপেক্ষমাণ</Badge> : s === "approved" ? <Badge tone="green" icon="check_circle">অনুমোদিত</Badge> : <Badge tone="red" icon="cancel">বাতিল</Badge>;
  const sender = (p: Row) => (
    <>
      <span className="trx">{displayPhone(p.sender_number)}</span>
      {p.student && normalizeBdPhone(p.student.phone) !== normalizeBdPhone(p.sender_number) && <div className="mt-1"><Badge tone="gray">অন্য নম্বর</Badge></div>}
    </>
  );
  const trx = (p: Row) => (
    <span className="trx inline-flex items-center gap-1 rounded-lg border border-outline-variant/20 bg-surface-container-low px-2 py-1 dark:bg-white/5">{p.trx_id}<CopyButton text={p.trx_id} compact /></span>
  );
  const done = (p: Row) => (
    <div className="text-right text-xs muted">{p.reviewer?.full_name}{p.reviewed_at ? <><br />{when(p.reviewed_at)}</> : null}{p.reject_reason ? <><br /><span className="text-error">{p.reject_reason}</span></> : null}</div>
  );
  const label = (p: Row) => `${p.student?.full_name} · ${p.course?.title} · ${taka(p.amount)} · TrxID ${p.trx_id}`;

  return (
    <>
      <SessionGuard />
      <PageHead title="পেমেন্ট অনুমোদন" sub="bKash Send Money এর আবেদন মিলিয়ে দেখে অনুমোদন বা বাতিল করুন">
        {content.payment.bkash_number && (
          <span className="inline-flex items-center gap-2 rounded-xl border border-pink-200 bg-pink-50 px-4 py-2 text-sm font-bold text-pink-700 dark:border-pink-800/40 dark:bg-pink-900/20 dark:text-pink-300">
            <span className="icon text-[18px]">account_balance_wallet</span>আমাদের bKash: <span className="trx">{displayPhone(content.payment.bkash_number)}</span>
          </span>
        )}
        <CsvButton name="payments" rows={[["আইডি", "শিক্ষার্থী", "ফোন", "কোর্স", "টাকা", "প্রেরক", "TrxID", "জমার সময়", "অবস্থা"], ...rows.map((p) => [p.student?.user_code ?? "", p.student?.full_name ?? "", p.student?.phone ?? "", p.course?.title ?? "", p.amount, p.sender_number, p.trx_id, p.created_at, p.status])]} />
      </PageHead>

      <div className="reveal mb-3 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 md:mb-6 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-200">
        <span className="icon shrink-0 text-[20px]">info</span>
        <p>অনুমোদনের আগে bKash অ্যাপ বা স্টেটমেন্টে <strong>TrxID</strong>, <strong>টাকার পরিমাণ</strong> আর <strong>প্রেরকের নম্বর</strong> মিলিয়ে নিন। অনুমোদন করলে শিক্ষার্থী সাথে সাথে কোর্স দেখতে পারবে, আর কাজটি অডিট লগে থেকে যাবে।</p>
      </div>

      <div className="reveal card p-4 md:p-6">
        <div className="mb-3 flex flex-col justify-between gap-3 md:mb-5 xl:flex-row xl:items-center">
          <TabLinks items={TABS.map((t, i) => ({ key: t.key, label: t.label, count: bn(counts[i].count ?? 0) }))} active={status} href={href} />
          <form className="flex flex-col gap-3 sm:flex-row" role="search">
            <input type="hidden" name="status" value={status} />
            <div className="relative sm:w-64">
              <span className="icon pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[20px] muted">search</span>
              <input name="q" type="search" defaultValue={q} className="field pl-10!" placeholder="নাম, ফোন বা TrxID" aria-label="খুঁজুন" />
            </div>
            <select name="course" defaultValue={courseId || ""} className="field sm:w-56" aria-label="কোর্স">
              <option value="">সব কোর্স</option>
              {(courses.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <button className="btn-soft"><span className="icon text-[18px]">filter_alt</span>ছাঁকুন</button>
          </form>
        </div>

        {error && <p className="mb-3 rounded-xl bg-error/10 p-3 text-sm text-error">তালিকা আনা যায়নি: {error.message}</p>}
        {rows.length === 0 ? (
          <EmptyState icon={status === "pending" && !q ? "task_alt" : "search_off"} text={status === "pending" && !q ? "কোনো পেমেন্ট অপেক্ষমাণ নেই 🎉" : "কিছু পাওয়া যায়নি"} />
        ) : (
          <>
            <div className="custom-scrollbar -mx-2 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr className="border-b border-outline-variant/20"><th className="th">শিক্ষার্থী</th><th className="th">কোর্স</th><th className="th">পরিমাণ</th><th className="th">প্রেরকের নম্বর</th><th className="th">TrxID</th><th className="th">জমা</th><th className="th">স্ট্যাটাস</th><th className="th text-right">অ্যাকশন</th></tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {rows.map((p, i) => (
                    <tr key={p.id} data-testid="payment-row" className="row-in transition-colors hover:bg-surface-container-low/60 dark:hover:bg-white/5" style={{ "--i": i } as React.CSSProperties}>
                      <td className="td"><div className="flex items-center gap-3"><Avatar name={p.student?.full_name ?? "?"} size="h-9 w-9" /><div><div className="font-bold">{p.student?.full_name}</div><div className="trx text-xs muted">{p.student?.user_code} · {displayPhone(p.student?.phone)}</div></div></div></td>
                      <td className="td max-w-[200px]"><span className="line-clamp-2">{p.course?.title}</span></td>
                      <td className="td font-bold whitespace-nowrap">{taka(p.amount)}</td>
                      <td className="td">{sender(p)}</td>
                      <td className="td">{trx(p)}</td>
                      <td className="td text-xs whitespace-nowrap muted">{when(p.created_at)}</td>
                      <td className="td">{statusBadge(p.status)}</td>
                      <td className="td">{p.status === "pending" ? <PayActions id={p.id} label={label(p)} /> : done(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 md:hidden">
              {rows.map((p, i) => (
                <div key={p.id} data-testid="payment-row" className="row-in rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4 dark:bg-white/5" style={{ "--i": i } as React.CSSProperties}>
                  <div className="mb-3 flex items-start gap-3">
                    <Avatar name={p.student?.full_name ?? "?"} />
                    <div className="min-w-0 grow"><div className="font-bold">{p.student?.full_name}</div><div className="text-xs muted">{p.course?.title}</div></div>
                    {statusBadge(p.status)}
                  </div>
                  <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                    <div><div className="muted">পরিমাণ</div><div className="text-sm font-bold">{taka(p.amount)}</div></div>
                    <div><div className="muted">প্রেরক</div>{sender(p)}</div>
                    <div className="col-span-2"><div className="mb-1 muted">TrxID · {when(p.created_at)}</div>{trx(p)}</div>
                  </div>
                  {p.status === "pending" ? <PayActions id={p.id} label={label(p)} wide /> : done(p)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {dup.data && dup.data.length > 0 && (
        <section className="reveal card mt-4 p-5 md:mt-8">
          <h2 className="flex items-center gap-2 font-bold"><span className="icon text-error">report</span>আগে ব্যবহার হওয়া TrxID দিয়ে চেষ্টা</h2>
          <p className="mt-1 text-xs muted">এগুলো সাথে সাথে বাতিল হয়েছে, কিছু করতে হবে না। একই জনের বারবার চেষ্টা বা অন্য কারো TrxID হলে নজর রাখুন।</p>
          <ul className="mt-3 divide-y divide-outline-variant/30 text-sm">
            {(dup.data as unknown as { id: number; meta: { trx_id?: string; same_user?: boolean }; created_at: string; actor: { full_name: string; user_code: string } | null }[]).map((d) => (
              <li key={d.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span><b>{d.actor?.full_name}</b> <span className="muted">{d.actor?.user_code}</span> · <span className="trx">{d.meta?.trx_id}</span>{d.meta?.same_user ? <span className="muted"> (নিজেরই আগের)</span> : null}</span>
                <span className="text-xs muted">{when(d.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
