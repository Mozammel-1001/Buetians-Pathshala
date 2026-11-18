import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { displayPhone } from "@/lib/validation";
import { SessionGuard } from "@/components/session-guard";
import { signOut } from "../(auth)/actions";

export const metadata: Metadata = { title: "ড্যাশবোর্ড" };

const bn = (v: string | number) => String(v).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);
const ROLE: Record<string, string> = { student: "শিক্ষার্থী", teacher: "শিক্ষক", manager: "ম্যানেজার", admin: "অ্যাডমিন", evaluator: "খাতা মূল্যায়নকারী" };

type Pay = { id: number; status: string; trx_id: string; amount: number; reject_reason: string | null; courses: { slug: string; title: string } | null };
type Enrollment = { status: string; enrolled_at: string; expires_at: string | null; courses: { slug: string; title: string } | null };

// পাতার কাঠামো আগেই তৈরি থাকে; লগইন লাগে এমন অংশ <Suspense> এর ভেতরে request এর সময় আসে
export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <main className="mx-auto max-w-[1100px] px-4 py-10 md:px-8">
      <Suspense fallback={<div className="card h-48 animate-pulse" />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const profile = await requireProfile("/dashboard");
  const supabase = await createClient();
  const [{ data: payments }, { data: enrollments }, { data: status }, sp] = await Promise.all([
    supabase.from("payments").select("id, status, trx_id, amount, reject_reason, created_at, courses(slug, title)").eq("user_id", profile.id).neq("status", "approved").order("created_at", { ascending: false }).limit(10),
    supabase.from("enrollments").select("status, enrolled_at, expires_at, courses(slug, title)").eq("user_id", profile.id).order("enrolled_at", { ascending: false }),
    supabase.rpc("session_status"),
    searchParams,
  ]);
  const device = (status as { device: string | null; since: string }[] | null)?.[0];
  const list = (enrollments ?? []) as unknown as Enrollment[];

  return (
    <>
      <SessionGuard />
      {sp.replaced && (
        <p className="mb-6 rounded-2xl border border-amber-300/50 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          আগে অন্য একটা ডিভাইসে লগইন ছিল, সেখান থেকে লগআউট হয়েছে। সেখানে কোনো পরীক্ষা চলছিল থাকলে জমা হয়ে গেছে।
        </p>
      )}
      {sp.enrolled && <p className="mb-6 rounded-2xl border border-emerald-300/50 bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">ভর্তি হয়েছে, কোর্সটা নিচে দেখুন।</p>}
      {sp.existing && <p className="mb-6 rounded-2xl border border-amber-300/50 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">এই নম্বরে আগেই অ্যাকাউন্ট ছিল, তাই নতুন অ্যাকাউন্ট খোলা হয়নি; আগের অ্যাকাউন্টে লগইন হয়েছে।</p>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">স্বাগতম, {profile.full_name}</h1>
          <p className="mt-1 muted">{ROLE[profile.role] ?? profile.role} · আইডি {profile.user_code}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(profile.role === "admin" || profile.role === "manager") && <Link href="/admin" className="btn-primary"><span className="icon text-[18px]">admin_panel_settings</span>{profile.role === "admin" ? "অ্যাডমিন" : "ম্যানেজার"} প্যানেল</Link>}
          <form action={signOut}><button className="btn-ghost"><span className="icon text-[18px]">logout</span>লগআউট</button></form>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
        {(payments ?? []).length > 0 && (
          <section className="card p-6" data-testid="my-payments">
            <h2 className="text-lg font-bold">ভর্তির আবেদন</h2>
            <ul className="mt-4 space-y-3">
              {(payments as unknown as Pay[]).map((p) => (
                <li key={p.id} className="rounded-2xl border border-outline-variant/30 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/courses/${p.courses?.slug}`} className="font-bold hover:text-primary">{p.courses?.title}</Link>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${p.status === "pending" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" : "bg-error/10 text-error"}`}>
                      {p.status === "pending" ? "যাচাই বাকি" : "বাতিল"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs muted">TrxID <span className="font-mono font-bold">{p.trx_id}</span> · ৳{bn(Number(p.amount).toLocaleString("en-IN"))}</p>
                  {p.reject_reason && <p className="mt-1 text-xs text-error dark:text-red-300">কারণ: {p.reject_reason}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="card p-6">
          <h2 className="text-lg font-bold">আমার কোর্স</h2>
          {list.length === 0 ? (
            <p className="mt-3 text-sm muted">এখনো কোনো কোর্সে ভর্তি হননি।</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {list.map((e) => (
                <li key={e.courses?.slug ?? e.enrolled_at} className="flex items-center justify-between rounded-2xl border border-outline-variant/30 p-4">
                  <span className="font-bold">{e.courses?.title}</span>
                  <span className="text-xs muted">{e.status === "active" ? "চলছে" : e.status === "expired" ? "মেয়াদ শেষ" : "বাতিল"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        </div>
        <aside className="card space-y-3 self-start p-6 text-sm">
          <h2 className="text-lg font-bold">অ্যাকাউন্ট</h2>
          {profile.phone && <p><span className="muted">মোবাইল:</span> {bn(displayPhone(profile.phone))}</p>}
          {profile.email && <p><span className="muted">ইমেইল:</span> {profile.email}</p>}
          {profile.institute && <p><span className="muted">প্রতিষ্ঠান:</span> {profile.institute}</p>}
          {profile.class_level && <p><span className="muted">শ্রেণি:</span> {profile.class_level}</p>}
          {device?.device && <p className="flex items-center gap-1.5"><span className="icon text-[18px] text-primary dark:text-primary-fixed">devices</span>এখন লগইন: {device.device}</p>}
        </aside>
      </div>
    </>
  );
}
