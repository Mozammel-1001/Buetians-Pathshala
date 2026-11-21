import type { Metadata } from "next";
import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SessionGuard } from "@/components/session-guard";
import { bn } from "@/lib/content-schema";
import { displayPhone, normalizeBdPhone, normalizeUserCode } from "@/lib/validation";
import { CsvButton } from "../_components/csv-button";
import { Avatar, Badge, EmptyState, PageHead, ROLE, TabLinks, day } from "../_components/ui";
import { RoleChanger } from "./role-select";
import { ProfileButton } from "./profile-button";
import { AddStaffButton, BlockButton } from "./user-extras";

export const metadata: Metadata = { title: "ইউজার ও রোল" };

const TABS = [
  { key: "all", label: "সব" },
  { key: "student", label: "শিক্ষার্থী" },
  { key: "teacher", label: "শিক্ষক" },
  { key: "manager", label: "ম্যানেজার" },
  { key: "evaluator", label: "মূল্যায়নকারী" },
  { key: "admin", label: "অ্যাডমিন" },
] as const;

type Row = { id: string; user_code: string; full_name: string; phone: string; email: string | null; role: string; institute: string | null; guardian_phone: string | null; created_at: string };

// ইউজার ও রোল, হুবহু admin_dashboard.html এর users: রোলের ট্যাব, খোঁজা, তালিকা। রোল বদলান শুধু admin
export default function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse" />}>
      <Users searchParams={searchParams} />
    </Suspense>
  );
}

async function Users({ searchParams }: { searchParams: PageProps<"/admin/users">["searchParams"] }) {
  const me = await requireStaff("/admin/users");
  const sp = await searchParams;
  const role = TABS.some((t) => t.key === sp.role) ? (sp.role as string) : "all";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const supabase = await createClient();

  let query = supabase.from("profiles").select("id, user_code, full_name, phone, email, role, institute, guardian_phone, created_at").order("created_at", { ascending: false }).limit(200);
  if (role !== "all") query = query.eq("role", role);
  if (q) {
    const code = normalizeUserCode(q), phone = normalizeBdPhone(q);
    const safe = q.replace(/[%,()]/g, " ");
    query = code ? query.eq("user_code", code) : phone ? query.eq("phone", phone) : query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,user_code.ilike.%${safe}%`);
  }
  const [{ data, error }, counts] = await Promise.all([
    query,
    Promise.all(TABS.map((t) => (t.key === "all" ? supabase.from("profiles").select("id", { count: "exact", head: true }) : supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", t.key)))),
  ]);
  const rows = (data ?? []) as Row[];
  // প্রোফাইলের জন্য তালিকার সবার এনরোলমেন্ট, পেমেন্ট আর (শিক্ষক হলে) কোর্স একবারে
  const ids = rows.map((r) => r.id);
  type E = { user_id: string; status: string; expires_at: string | null; course: { title: string } | null };
  type P = { user_id: string; amount: number; status: string; course: { title: string } | null };
  type T = { teacher_id: string; course: { title: string } | null };
  const [enr, pays, teach] = ids.length ? await Promise.all([
    supabase.from("enrollments").select("user_id, status, expires_at, course:courses(title)").in("user_id", ids),
    supabase.from("payments").select("user_id, amount, status, course:courses(title)").in("user_id", ids).order("created_at", { ascending: false }),
    supabase.from("course_teachers").select("teacher_id, course:courses(title)").in("teacher_id", ids),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const enrs = (enr.data ?? []) as unknown as E[], payList = (pays.data ?? []) as unknown as P[], teachList = (teach.data ?? []) as unknown as T[];
  const per = new Map<string, number>();
  for (const e of enrs) if (e.status === "active") per.set(e.user_id, (per.get(e.user_id) ?? 0) + 1);
  const profileOf = (u: Row) => ({
    name: u.full_name, code: u.user_code, phone: displayPhone(u.phone), email: u.email, role: u.role, institute: u.institute,
    guardian: u.guardian_phone ? displayPhone(u.guardian_phone) : null, joined: day(u.created_at),
    courses: enrs.filter((e) => e.user_id === u.id).map((e) => ({ title: e.course?.title ?? "—", status: e.status, until: e.expires_at ? day(e.expires_at) : null })),
    payments: payList.filter((x) => x.user_id === u.id).slice(0, 10).map((x) => ({ title: x.course?.title ?? "—", amount: Number(x.amount), status: x.status })),
    teaches: teachList.filter((t) => t.teacher_id === u.id).map((t) => t.course?.title ?? "—"),
  });
  const info = (u: Row) => u.role === "student" ? `${bn(per.get(u.id) ?? 0)}টি কোর্সে` : u.role === "teacher" ? `${bn(teachList.filter((t) => t.teacher_id === u.id).length)}টি কোর্স পড়ান` : u.role === "manager" ? "পেমেন্ট, এনরোল, শিক্ষক" : u.role === "evaluator" ? "লিখিত খাতা কাটেন" : "সব অ্যাক্সেস";
  const href = (key: string) => `/admin/users?role=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <SessionGuard />
      <PageHead title="ইউজার ও রোল" sub={me.role === "admin" ? "শিক্ষার্থী, শিক্ষক আর অ্যাডমিনদের দেখুন, রোল বদলান বা অ্যাকাউন্ট ব্লক করুন" : "শিক্ষার্থী, শিক্ষক আর ম্যানেজারদের দেখুন"}>
        <CsvButton name="users" rows={[["আইডি", "নাম", "ফোন", "ইমেইল", "রোল", "প্রতিষ্ঠান", "যোগদান"], ...rows.map((u) => [u.user_code, u.full_name, u.phone, u.email ?? "", u.role, u.institute ?? "", u.created_at])]} />
        {me.role === "admin" && <AddStaffButton />}
      </PageHead>
      <div className="reveal card p-4 md:p-6">
        <div className="mb-3 flex flex-col justify-between gap-3 md:mb-5 xl:flex-row xl:items-center">
          <TabLinks items={TABS.map((t, i) => ({ key: t.key, label: t.label, count: bn(counts[i].count ?? 0) }))} active={role} href={href} />
          <form className="relative sm:w-72" role="search">
            <input type="hidden" name="role" value={role} />
            <span className="icon pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[20px] muted">search</span>
            <input name="q" type="search" defaultValue={q} className="field pl-10!" placeholder="নাম, ফোন, আইডি বা ইমেইল" aria-label="খুঁজুন" />
          </form>
        </div>
        {error && <p className="mb-3 rounded-xl bg-error/10 p-3 text-sm text-error">তালিকা আনা যায়নি: {error.message}</p>}
        {rows.length === 0 ? <EmptyState icon="person_search" text="কোনো ইউজার পাওয়া যায়নি" /> : (
          <div className="custom-scrollbar -mx-2 overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead><tr className="border-b border-outline-variant/20"><th className="th">ইউজার</th><th className="th">ফোন</th><th className="th">রোল</th><th className="th">কোর্স</th><th className="th">যোগদান</th><th className="th">স্ট্যাটাস</th><th className="th text-right">অ্যাকশন</th></tr></thead>
              <tbody className="divide-y divide-outline-variant/10">
                {rows.map((u, i) => (
                  <tr key={u.id} className="row-in transition-colors hover:bg-surface-container-low/60 dark:hover:bg-white/5" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                    <td className="td"><div className="flex items-center gap-3"><Avatar name={u.full_name} size="h-9 w-9" /><div><div className="font-bold">{u.full_name}{u.id === me.id && <span className="text-xs muted"> (আপনি)</span>}</div><div className="text-xs muted">{u.user_code}{u.email ? ` · ${u.email}` : ""}</div></div></div></td>
                    <td className="td trx">{displayPhone(u.phone)}</td>
                    <td className="td"><Badge tone={ROLE[u.role]?.tone ?? "gray"}>{ROLE[u.role]?.label ?? u.role}</Badge></td>
                    <td className="td text-xs muted">{info(u)}</td>
                    <td className="td text-xs whitespace-nowrap muted">{day(u.created_at)}</td>
                    {/* ব্লক করার ব্যবস্থা database এ আসার আগ পর্যন্ত সবাই সক্রিয় */}
                    <td className="td"><Badge tone="green">সক্রিয়</Badge></td>
                    <td className="td"><div className="flex items-center justify-end gap-1"><ProfileButton p={profileOf(u)} />{me.role === "admin" && u.role !== "admin" && u.id !== me.id ? <><RoleChanger id={u.id} name={u.full_name} role={u.role} /><BlockButton name={u.full_name} /></> : null}</div></td>
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
