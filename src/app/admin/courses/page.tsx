import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SessionGuard } from "@/components/session-guard";
import { bnDate, taka } from "@/lib/content-schema";

export const metadata: Metadata = { title: "কোর্স" };

export default function AdminCourses({ searchParams }: PageProps<"/admin/courses">) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">কোর্স</h1>
        <Link href="/admin/courses/new" className="btn-primary"><span className="icon text-[18px]">add</span>নতুন কোর্স</Link>
      </div>
      <Suspense fallback={<div className="card h-64 animate-pulse" />}>
        <CourseList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CourseList({ searchParams }: { searchParams: PageProps<"/admin/courses">["searchParams"] }) {
  await requireAdmin("/admin/courses");
  const supabase = await createClient();
  const [{ data }, sp] = await Promise.all([
    supabase.from("courses").select("id, slug, title, batch_name, price, starts_on, thumbnail_url, is_published, position, updated_at").order("position").order("id"),
    searchParams,
  ]);
  const list = data ?? [];
  return (
    <>
      <SessionGuard />
      {sp.deleted && <p className="rounded-xl border border-emerald-300/50 bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">কোর্সটা মোছা হয়েছে।</p>}
      {list.length === 0 ? (
        <p className="card p-6 text-sm muted">এখনো কোনো কোর্স নেই। &quot;নতুন কোর্স&quot; চেপে শুরু করুন।</p>
      ) : (
        <ul className="space-y-3">
          {list.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/courses/${c.id}`} className="card flex items-center gap-4 p-3 pr-5 hover:shadow-md">
                <span className="relative block h-16 w-28 shrink-0 overflow-hidden rounded-xl bg-surface-container dark:bg-white/5">
                  {c.thumbnail_url ? <Image src={c.thumbnail_url} alt="" fill unoptimized sizes="112px" className="object-cover" /> : <span className="icon absolute inset-0 m-auto h-fit w-fit muted">image</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{c.title}</span>
                  <span className="block truncate text-xs muted">
                    {[c.batch_name, c.starts_on && `শুরু ${bnDate(c.starts_on)}`, `/courses/${c.slug}`].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="hidden font-bold sm:block">{Number(c.price) === 0 ? "ফ্রি" : taka(c.price)}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${c.is_published ? "bg-primary/10 text-primary dark:text-primary-fixed" : "bg-surface-container muted dark:bg-white/10"}`}>
                  {c.is_published ? "প্রকাশিত" : "খসড়া"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
