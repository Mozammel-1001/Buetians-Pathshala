import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SessionGuard } from "@/components/session-guard";
import { bn, taka } from "@/lib/content-schema";
import { PageHead } from "../_components/ui";
import { CourseCardActions } from "./card-actions";

export const metadata: Metadata = { title: "কোর্স" };

// admin_dashboard.html এর "কোর্স ম্যানেজমেন্ট": ছবিসহ কার্ডের grid (প্রকাশিত/ড্রাফট, দাম, শিক্ষার্থী/লেসন/পরীক্ষা,
// শিক্ষক, সম্পাদনা/কন্টেন্ট/প্রকাশ/মোছা) আর শেষে ডটেড "নতুন কোর্স তৈরি করুন" কার্ড
export default function AdminCourses({ searchParams }: PageProps<"/admin/courses">) {
  return (
    <>
      <PageHead title="কোর্স ম্যানেজমেন্ট" sub="কোর্স তৈরি, দাম ঠিক করা, শিক্ষক যুক্ত করা আর প্রকাশ/ড্রাফট করা">
        <Link href="/admin/courses/new" className="btn-primary"><span className="icon text-[18px]">add</span>নতুন কোর্স</Link>
      </PageHead>
      <Suspense fallback={<div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6 2xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="card h-80 animate-pulse rounded-2xl!" />)}</div>}>
        <CourseGrid searchParams={searchParams} />
      </Suspense>
    </>
  );
}

// কোর্স অনুযায়ী গোনা (ভুল হলে ০ ধরে নেয়, যাতে পাতা না ভাঙে)
const countBy = (rows: { course_id: number }[] | null) => {
  const m = new Map<number, number>();
  for (const r of rows ?? []) m.set(r.course_id, (m.get(r.course_id) ?? 0) + 1);
  return m;
};

async function CourseGrid({ searchParams }: { searchParams: PageProps<"/admin/courses">["searchParams"] }) {
  await requireAdmin("/admin/courses");
  const supabase = await createClient();
  const [{ data }, enr, les, exm, ct, sp] = await Promise.all([
    supabase.from("courses").select("id, slug, title, price, thumbnail_url, is_published, position").order("position").order("id"),
    supabase.from("enrollments").select("course_id").eq("status", "active"),
    supabase.from("lessons").select("course_id"),
    supabase.from("exams").select("course_id"),
    supabase.from("course_teachers").select("course_id, teacher_id"),
    searchParams,
  ]);
  const list = data ?? [];
  const students = countBy(enr.data), lessons = countBy(les.data), exams = countBy(exm.data);
  // শিক্ষকের নাম: course_teachers এর teacher_id দিয়ে profiles থেকে
  const tIds = [...new Set((ct.data ?? []).map((r) => r.teacher_id as string))];
  const { data: tp } = tIds.length ? await supabase.from("profiles").select("id, full_name").in("id", tIds) : { data: [] as { id: string; full_name: string | null }[] };
  const tName = new Map((tp ?? []).map((p) => [p.id, p.full_name ?? ""]));
  const teachers = new Map<number, string[]>();
  for (const r of ct.data ?? []) { const n = tName.get(r.teacher_id as string); if (n) teachers.set(r.course_id as number, [...(teachers.get(r.course_id as number) ?? []), n]); }

  return (
    <>
      <SessionGuard />
      {sp.deleted && <p className="reveal mb-3 rounded-xl border border-emerald-300/50 bg-emerald-50 p-3 text-sm text-emerald-800 md:mb-6 dark:bg-emerald-900/20 dark:text-emerald-200">কোর্সটা মোছা হয়েছে।</p>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6 2xl:grid-cols-3">
        {list.map((c, i) => (
          <div key={c.id} className="reveal h-full" style={{ transitionDelay: `${(i % 3) * 100}ms` }}>
            <div className="tilt-card card group flex h-full flex-col overflow-hidden rounded-2xl!">
              <div className="relative flex aspect-video items-end justify-start rounded-t-2xl border-b border-outline-variant/20 bg-surface-container bg-cover bg-center p-4 dark:bg-white/5"
                style={{ backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.1))${c.thumbnail_url ? `, url("${String(c.thumbnail_url).replace(/"/g, "%22")}")` : ""}` }}>
                <span className={`absolute top-2 left-2 rounded border border-outline-variant/20 px-2 py-1 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm ${c.is_published ? "bg-primary/80" : "bg-white/20"}`}>{c.is_published ? "প্রকাশিত" : "ড্রাফট"}</span>
                <span className="absolute top-2 right-2 rounded bg-black/40 px-2 py-1 text-xs font-bold text-white backdrop-blur-sm">{Number(c.price) === 0 ? "ফ্রি" : taka(c.price)}</span>
                <h4 className="text-left text-xl leading-tight font-bold text-white md:text-2xl">{c.title}</h4>
              </div>
              <div className="flex grow flex-col p-5">
                <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                  {[[students, "শিক্ষার্থী"], [lessons, "লেসন"], [exams, "পরীক্ষা"]].map(([m, l]) => (
                    <div key={l as string} className="rounded-xl bg-surface-container-low p-2 dark:bg-white/5"><div className="font-bold">{bn((m as Map<number, number>).get(c.id) ?? 0)}</div><div className="text-[11px] muted">{l as string}</div></div>
                  ))}
                </div>
                <p className="mb-4 flex items-start gap-1 text-xs muted"><span className="icon text-[14px]">co_present</span>{teachers.get(c.id)?.join(", ") || <span className="text-error">কোনো শিক্ষক নেই</span>}</p>
                <CourseCardActions id={c.id} title={c.title} published={!!c.is_published} />
              </div>
            </div>
          </div>
        ))}
        <div className="reveal h-full">
          <Link href="/admin/courses/new" className="group flex h-full min-h-[260px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-outline-variant/50 text-on-surface-variant transition-colors hover:border-primary hover:text-primary dark:text-surface-variant dark:hover:border-primary-fixed dark:hover:text-primary-fixed">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 transition-transform group-hover:scale-110 dark:bg-primary-fixed/10"><span className="icon text-3xl">add</span></span>
            <span className="font-bold">নতুন কোর্স তৈরি করুন</span>
          </Link>
        </div>
      </div>
    </>
  );
}
