import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SessionGuard } from "@/components/session-guard";
import { bn } from "@/lib/content-schema";
import { displayPhone, normalizeBdPhone, normalizeUserCode } from "@/lib/validation";
import { Avatar, Badge, EmptyState, PageHead, TabLinks, day } from "../_components/ui";
import { ManualEnroll, RowControls } from "./enroll-controls";


const TABS = [
  { key: "active", label: "সক্রিয়" },
  { key: "soon", label: "শীঘ্রই শেষ" },
  { key: "expired", label: "মেয়াদ শেষ" },
  { key: "revoked", label: "বাতিল" },
  { key: "all", label: "সব" },
] as const;

type Row = {
  id: number; status: string; enrolled_at: string; expires_at: string | null; note: string | null; payment_id: number | null;
  student: { full_name: string; user_code: string; phone: string } | null; course: { title: string } | null;
};

// এনরোলমেন্ট, হুবহু admin_dashboard.html এর enrollments: কে কোন কোর্সে, মেয়াদ কবে শেষ, মেয়াদ বাড়ানো / বাতিল / ম্যানুয়াল এনরোল
// ম্যানেজার প্যানেলেও একই পাতা (/manager/enrollments); root দিয়ে লিংকগুলো সেই প্যানেলেই থাকে
export function EnrollmentsScreen({ searchParams, root }: { searchParams: Promise<Record<string, string | string[] | undefined>>; root: "/admin" | "/manager" }) {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse" />}>
      <Enrollments searchParams={searchParams} root={root} />
    </Suspense>
  );
}

async function Enrollments({ searchParams, root }: { searchParams: Promise<Record<string, string | string[] | undefined>>; root: string }) {
  const me = await requireStaff(`${root}/enrollments`);
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.status) ? (sp.status as string) : "active";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const courseId = Number(sp.course) || 0;
  const supabase = await createClient();
  const nowMs = new Date().getTime();
  const nowIso = new Date(nowMs).toISOString();
  const soonIso = new Date(nowMs + 7 * 86400000).toISOString();

  const filter = (b: ReturnType<typeof base>, key: string) =>
    key === "active" ? b.eq("status", "active").or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    : key === "soon" ? b.eq("status", "active").gt("expires_at", nowIso).lte("expires_at", soonIso)
    : key === "expired" ? b.or(`status.eq.expired,and(status.eq.active,expires_at.lte.${nowIso})`)
    : key === "revoked" ? b.eq("status", "revoked") : b;
  const base = () => supabase.from("enrollments").select("id", { count: "exact", head: true });

  let query = supabase.from("enrollments")
    .select("id, status, enrolled_at, expires_at, note, payment_id, student:profiles!enrollments_user_id_fkey(full_name, user_code, phone), course:courses(title)")
    .order("enrolled_at", { ascending: false }).limit(200);
  query = filter(query as never, tab) as never;
  if (courseId) query = query.eq("course_id", courseId);
  if (q) {
    const code = normalizeUserCode(q), phone = normalizeBdPhone(q);
    const { data: ps } = code || phone
      ? await supabase.from("profiles").select("id").eq(code ? "user_code" : "phone", code ?? phone!)
      : await supabase.from("profiles").select("id").ilike("full_name", `%${q.replace(/[%,()]/g, " ")}%`).limit(50);
    query = query.in("user_id", (ps ?? []).map((p) => p.id).concat("00000000-0000-0000-0000-000000000000"));
  }

  const [{ data, error }, counts, courses] = await Promise.all([
    query,
    Promise.all(TABS.map((t) => filter(base(), t.key))),
    supabase.from("courses").select("id, title").order("position").order("id"),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const href = (key: string) => `${root}/enrollments?status=${key}${courseId ? `&course=${courseId}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  const state = (r: Row) => {
    if (r.status === "revoked") return <Badge tone="red" icon="block">বাতিল</Badge>;
    if (r.status === "expired" || (r.expires_at && Date.parse(r.expires_at) <= nowMs)) return <Badge tone="gray" icon="timer_off">মেয়াদ শেষ</Badge>;
    if (r.expires_at && Date.parse(r.expires_at) - nowMs <= 7 * 86400000) return <Badge tone="amber" icon="timer">শীঘ্রই শেষ</Badge>;
    return <Badge tone="green" icon="check_circle">সক্রিয়</Badge>;
  };

  return (
    <>
      <SessionGuard />
      <PageHead title="এনরোলমেন্ট" sub="কে কোন কোর্সে আছে, মেয়াদ কবে শেষ, আর হাতে-কলমে এনরোল বা বাতিল">
        <ManualEnroll courses={(courses.data ?? []) as { id: number; title: string }[]} startOpen={sp.manual === "1"} />
      </PageHead>
      <div className="reveal card p-4 md:p-6">
        <div className="mb-3 flex flex-col justify-between gap-3 md:mb-5 xl:flex-row xl:items-center">
          <TabLinks items={TABS.map((t, i) => ({ key: t.key, label: t.label, count: bn(counts[i].count ?? 0) }))} active={tab} href={href} />
          <form className="flex flex-col gap-3 sm:flex-row" role="search">
            <input type="hidden" name="status" value={tab} />
            <div className="relative sm:w-64">
              <span className="icon pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[20px] muted">search</span>
              <input name="q" type="search" defaultValue={q} className="field pl-10!" placeholder="নাম, আইডি বা ফোন" aria-label="খুঁজুন" />
            </div>
            <select name="course" defaultValue={courseId || ""} className="field sm:w-56" aria-label="কোর্স">
              <option value="">সব কোর্স</option>
              {(courses.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <button className="btn-soft"><span className="icon text-[18px]">filter_alt</span>ছাঁকুন</button>
          </form>
        </div>
        {error && <p className="mb-3 rounded-xl bg-error/10 p-3 text-sm text-error">তালিকা আনা যায়নি: {error.message}</p>}
        {rows.length === 0 ? <EmptyState icon="how_to_reg" text="কোনো এনরোলমেন্ট পাওয়া যায়নি" /> : (
          <div className="custom-scrollbar -mx-2 overflow-x-auto pb-24">
            <table className="w-full min-w-[920px]">
              <thead><tr className="border-b border-outline-variant/20"><th className="th">শিক্ষার্থী</th><th className="th">কোর্স</th><th className="th">স্ট্যাটাস</th><th className="th">শুরু</th><th className="th">মেয়াদ শেষ</th><th className="th">সূত্র</th><th className="th text-right">অ্যাকশন</th></tr></thead>
              <tbody className="divide-y divide-outline-variant/10">
                {rows.map((r, i) => (
                  <tr key={r.id} className="row-in transition-colors hover:bg-surface-container-low/60 dark:hover:bg-white/5" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                    <td className="td"><div className="flex items-center gap-3"><Avatar name={r.student?.full_name ?? "?"} size="h-9 w-9" /><div><div className="font-bold">{r.student?.full_name}</div><div className="trx text-xs muted">{r.student?.user_code} · {displayPhone(r.student?.phone)}</div></div></div></td>
                    <td className="td max-w-[220px]"><span className="line-clamp-2">{r.course?.title}</span></td>
                    <td className="td">{state(r)}</td>
                    <td className="td text-xs whitespace-nowrap muted">{day(r.enrolled_at)}</td>
                    <td className="td text-xs font-bold whitespace-nowrap">{r.expires_at ? day(r.expires_at) : "সীমাহীন"}</td>
                    {/* সূত্র: পেমেন্ট থেকে, নাকি অ্যাডমিন হাতে ভর্তি করেছেন (তখন কারণ) */}
                    <td className="td text-xs muted">{r.payment_id ? `বিকাশ পেমেন্ট #${bn(r.payment_id)}` : "ম্যানুয়াল এনরোল"}{r.note && <div className={r.status === "revoked" ? "text-error dark:text-red-300" : ""}>{r.note}</div>}</td>
                    <td className="td"><RowControls id={r.id} status={r.status} canRevoke={me.role === "admin"} /></td>
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
