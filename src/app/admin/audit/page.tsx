import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SessionGuard } from "@/components/session-guard";
import { bn } from "@/lib/content-schema";
import { AUDIT, auditLabel } from "../_components/audit-labels";
import { CsvButton } from "../_components/csv-button";
import { Avatar, Badge, EmptyState, PageHead, TabLinks, when } from "../_components/ui";

export const metadata: Metadata = { title: "অডিট লগ" };

type Log = { id: number; action: string; entity: string; entity_id: string | null; meta: Record<string, unknown> | null; created_at: string; actor: { full_name: string; user_code: string } | null };
const ENTITY: Record<string, string> = { payments: "পেমেন্ট", enrollments: "এনরোলমেন্ট", profiles: "ইউজার", courses: "কোর্স", site_content: "সাইটের লেখা", admission_circulars: "ভর্তি বিজ্ঞপ্তি" };
const GROUPS = [
  { key: "all", label: "সব", match: () => true },
  { key: "payment", label: "পেমেন্ট", match: (a: string) => a.startsWith("payment") },
  { key: "enrollment", label: "এনরোলমেন্ট", match: (a: string) => a.startsWith("enrollment") },
  { key: "role", label: "রোল", match: (a: string) => a.startsWith("role") },
  { key: "content", label: "কোর্স ও সাইট", match: (a: string) => a.startsWith("courses") || a.startsWith("site_content") || a.startsWith("admission_circulars") },
];

// অডিট লগ (শুধু admin), হুবহু admin_dashboard.html এর audit: কে, কখন, কী করেছেন। মোছা বা বদলানো যায় না
export default function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse" />}>
      <Audit searchParams={searchParams} />
    </Suspense>
  );
}

async function Audit({ searchParams }: { searchParams: PageProps<"/admin/audit">["searchParams"] }) {
  await requireAdmin("/admin/audit");
  const sp = await searchParams;
  const grp = GROUPS.find((g) => g.key === sp.group) ?? GROUPS[0];
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const supabase = await createClient();
  const { data, error } = await supabase.from("audit_logs").select("id, action, entity, entity_id, meta, created_at, actor:profiles(full_name, user_code)").order("id", { ascending: false }).limit(500);
  const all = (data ?? []) as unknown as Log[];
  const text = (l: Log) => `${auditLabel(l.action).label} ${l.actor?.full_name ?? ""} ${l.actor?.user_code ?? ""} ${l.entity_id ?? ""} ${JSON.stringify(l.meta ?? {})}`.toLowerCase();
  const rows = all.filter((l) => grp.match(l.action) && (!q || text(l).includes(q)));
  const href = (key: string) => `/admin/audit?group=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  // কার উপর: যাঁর বা যে জিনিসের উপর কাজটা হয়েছে (নাম না থাকলে ধরন আর ID)
  const target = (l: Log) => {
    const m = l.meta ?? {};
    const n = m.target_name ?? m.student_name ?? m.name ?? m.full_name ?? m.title;
    return n ? String(n) : `${ENTITY[l.entity] ?? l.entity}${l.entity_id ? ` #${bn(String(l.entity_id))}` : ""}`;
  };
  const detail = (l: Log) => {
    const m = l.meta ?? {};
    const bits = [ m.trx_id && `TrxID ${m.trx_id}`, m.from && m.to && `${m.from} → ${m.to}`, m.reason && `কারণ: ${m.reason}`, m.note && `কারণ: ${m.note}`, m.price_from != null && `দাম ৳${bn(String(m.price_from))} → ৳${bn(String(m.price_to ?? ""))}`].filter(Boolean);
    return bits.length ? bits.join(" · ") : "—";
  };

  return (
    <>
      <SessionGuard />
      <PageHead title="অডিট লগ" sub="কোন অ্যাডমিন কখন কী করেছেন তার স্থায়ী রেকর্ড">
        <CsvButton name="audit" rows={[["সময়", "কে", "কাজ", "কার উপর", "বিস্তারিত"], ...rows.map((l) => [l.created_at, l.actor?.full_name ?? "সিস্টেম", auditLabel(l.action).label, target(l), detail(l)])]} />
      </PageHead>
      <div className="reveal mb-3 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 md:mb-6 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200">
        <span className="icon shrink-0 text-[20px]">verified_user</span>
        <p>অডিট লগ কেউ বদলাতে বা মুছতে পারে না। Database এ এই টেবিলে শুধু নতুন লাইন যোগ হয়, তাই কোন অ্যাডমিন কখন কী করেছেন তার স্থায়ী রেকর্ড থাকে।</p>
      </div>
      <div className="reveal card p-4 md:p-6">
        <div className="mb-3 flex flex-col justify-between gap-3 md:mb-5 xl:flex-row xl:items-center">
          <TabLinks items={GROUPS.map((g) => ({ key: g.key, label: g.label, count: bn(all.filter((l) => g.match(l.action)).length) }))} active={grp.key} href={href} />
          <form className="relative sm:w-72" role="search">
            <input type="hidden" name="group" value={grp.key} />
            <span className="icon pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[20px] muted">search</span>
            <input name="q" type="search" defaultValue={q} className="field pl-10!" placeholder="নাম, ID বা বিস্তারিত" aria-label="খুঁজুন" />
          </form>
        </div>
        {error && <p className="mb-3 rounded-xl bg-error/10 p-3 text-sm text-error">লগ আনা যায়নি: {error.message}</p>}
        {rows.length === 0 ? <EmptyState icon="history" text="কিছু পাওয়া যায়নি" /> : (
          <div className="custom-scrollbar -mx-2 overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead><tr className="border-b border-outline-variant/20"><th className="th">সময়</th><th className="th">কে</th><th className="th">কাজ</th><th className="th">কার উপর</th><th className="th">বিস্তারিত</th></tr></thead>
              <tbody className="divide-y divide-outline-variant/10">
                {rows.slice(0, 200).map((l, i) => (
                  <tr key={l.id} className="row-in hover:bg-surface-container-low/60 dark:hover:bg-white/5" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                    <td className="td text-xs whitespace-nowrap muted">{when(l.created_at)}</td>
                    <td className="td"><div className="flex items-center gap-3"><Avatar name={l.actor?.full_name ?? "সি"} size="h-8 w-8" /><div><div className="font-bold">{l.actor?.full_name ?? "সিস্টেম"}</div><div className="text-xs muted">{l.actor?.user_code}</div></div></div></td>
                    <td className="td"><Badge tone={AUDIT[l.action]?.tone ?? "gray"}>{auditLabel(l.action).label}</Badge></td>
                    <td className="td max-w-[220px] text-sm font-bold">{target(l)}</td>
                    <td className="td max-w-[360px] text-xs muted">{detail(l)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
