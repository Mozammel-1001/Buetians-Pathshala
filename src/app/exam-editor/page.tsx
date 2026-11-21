import type { Metadata } from "next";
import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EXAM_COLS, creators, myCourses, toExam } from "./data";
import { ExamList, type ListItem } from "./list";

export const metadata: Metadata = { title: "প্রশ্নপত্র ও সময়সূচি" };

// পরীক্ষার তালিকা (exam_editor.html এর list): কোর্স অনুযায়ী ছাঁকা, নতুন পরীক্ষা, প্রশ্নপত্র খোলা, ড্রাফট মোছা
export default function Page() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-[1440px] grow px-4 pt-2.5 pb-10 md:px-8 md:pt-5"><div className="h-40 animate-pulse rounded-2xl bg-surface-container dark:bg-white/5" /></main>}>
      <Loaded />
    </Suspense>
  );
}

async function Loaded() {
  const me = await requireProfile("/exam-editor");
  const supabase = await createClient();
  const courses = await myCourses(supabase, me);
  const ids = courses.map((c) => c.id);
  const { data } = ids.length ? await supabase.from("exams").select(EXAM_COLS).in("course_id", ids).order("opens_at", { ascending: false, nullsFirst: true }).order("id", { ascending: false }) : { data: [] };
  const rows = (data ?? []) as Parameters<typeof toExam>[0][];
  const [by, qs] = await Promise.all([
    creators(supabase, rows.map((r) => r.created_by)),
    rows.length ? supabase.from("exam_questions").select("exam_id, kind, section, marks").in("exam_id", rows.map((r) => r.id)) : Promise.resolve({ data: [] }),
  ]);
  const names = new Map(courses.map((c) => [c.id, c.name]));
  const qmap = new Map<number, { kind: "mcq" | "written"; section: string; marks: number }[]>();
  for (const q of (qs.data ?? []) as { exam_id: number; kind: "mcq" | "written"; section: string; marks: number | string }[]) {
    const l = qmap.get(q.exam_id) ?? [];
    l.push({ kind: q.kind, section: q.section, marks: Number(q.marks) });
    qmap.set(q.exam_id, l);
  }
  const items: ListItem[] = rows.map((r) => ({ exam: toExam(r, names, by), questions: qmap.get(r.id) ?? [] }));
  return <ExamList items={items} courses={courses} admin={me.role === "admin"} nowMs={new Date().getTime()} />;
}
