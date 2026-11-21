import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadContent, loadCourses, tMe } from "../data";
import { ContentList } from "../content-list";
import { MUTED } from "@/app/evaluator/ui";

export const metadata = { title: "কোর্স ম্যানেজমেন্ট" };

// কোর্সের কন্টেন্ট (teacher_dashboard.html এর manage-course-view): শিক্ষার্থীদের জন্য আপলোড করা সব ম্যাটেরিয়াল
export default function Page({ searchParams }: PageProps<"/teacher/courses">) {
  return (
    <Suspense fallback={<div className="h-60 animate-pulse rounded-3xl bg-surface-container dark:bg-white/5" />}>
      <Loaded searchParams={searchParams} />
    </Suspense>
  );
}

async function Loaded({ searchParams }: { searchParams: PageProps<"/teacher/courses">["searchParams"] }) {
  const me = await tMe("/teacher/courses");
  const sp = await searchParams;
  const sb = await createClient();
  const courses = await loadCourses(sb, me.id);
  const want = Number(Array.isArray(sp.course) ? sp.course[0] : sp.course);
  const course = courses.find((c) => c.id === want);
  const items = await loadContent(sb, course ? [course] : courses);
  return (
    <>
      <div className="mb-3 flex items-center gap-4 md:mb-8">
        <Link href="/teacher" aria-label="ড্যাশবোর্ডে ফিরুন" className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/20 bg-surface-container-low transition-colors hover:bg-surface-variant dark:bg-white/5"><span className="icon">arrow_back</span></Link>
        <div><h2 className="text-2xl font-bold text-on-background md:text-3xl dark:text-background">{course ? course.title : "আমার সকল কোর্স"} - কন্টেন্ট</h2>
          <p className={`mt-1 text-sm ${MUTED}`}>শিক্ষার্থীদের জন্য আপলোডকৃত সকল ম্যাটেরিয়াল পরিচালনা করুন</p></div>
      </div>
      {courses.length > 1 && (
        <div className="mb-2.5 flex flex-wrap gap-2 md:mb-5">
          {[{ id: 0, title: "সব কোর্স" }, ...courses].map((c) => (
            <Link key={c.id} href={c.id ? `/teacher/courses?course=${c.id}` : "/teacher/courses"} className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${(course?.id ?? 0) === c.id ? "border-primary bg-primary text-on-primary" : `border-outline-variant/40 ${MUTED} hover:border-primary`}`}>{c.title}</Link>
          ))}
        </div>
      )}
      <ContentList items={items} courseId={course?.id} showCourse={!course} />
    </>
  );
}
