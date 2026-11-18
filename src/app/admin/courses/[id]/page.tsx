import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SessionGuard } from "@/components/session-guard";
import { COURSE_COLUMNS, type Course } from "@/lib/content-schema";
import { CourseEditor } from "../../_components/course-editor";

export const metadata: Metadata = { title: "কোর্স সম্পাদনা" };

export default function EditCoursePage({ params, searchParams }: PageProps<"/admin/courses/[id]">) {
  return (
    <div className="space-y-6">
      <nav className="text-sm muted"><Link href="/admin/courses" className="hover:text-primary">কোর্স</Link> / সম্পাদনা</nav>
      <Suspense fallback={<div className="card h-96 animate-pulse" />}>
        <Editor params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Editor({ params, searchParams }: Pick<PageProps<"/admin/courses/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  await requireAdmin(`/admin/courses/${id}`);
  if (!/^\d+$/.test(id)) notFound();
  const supabase = await createClient();
  const [{ data }, sp] = await Promise.all([supabase.from("courses").select(COURSE_COLUMNS).eq("id", Number(id)).maybeSingle(), searchParams]);
  if (!data) notFound();
  const course = data as unknown as Course;
  return (
    <>
      <SessionGuard />
      <h1 className="text-3xl font-bold">{course.title}</h1>
      {sp.created && (
        <p className="rounded-xl border border-emerald-300/50 bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
          কোর্স তৈরি হয়েছে।{course.is_published ? "" : " এখন খসড়া; সব ঠিক হলে \"সাইটে প্রকাশিত\" চালু করে সেভ করুন।"}
        </p>
      )}
      {/* key: অন্য কোর্সে গেলে ফর্ম নতুন করে */}
      <CourseEditor key={course.id} course={course} />
    </>
  );
}
