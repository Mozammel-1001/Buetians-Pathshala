import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EXAM_COLS, creators, loadQuestions, myCourses, toExam } from "../data";
import type { Chapter, ExamRow } from "../lib";
import { Editor } from "./editor";

export const metadata: Metadata = { title: "প্রশ্নপত্র" };

// একটা পরীক্ষা (exam_editor.html এর exam): তথ্য ও সময়, প্রশ্ন (MCQ আর লিখিত), শিক্ষার্থীর মতো দেখা, যাচাই ও প্রকাশ।
// /exam-editor/new = নতুন পরীক্ষা। শুরুর পর (exam_started) সব বন্ধ, শুধু দেখা
export default function Page({ params }: PageProps<"/exam-editor/[id]">) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-[1440px] grow px-4 pt-2.5 pb-24 md:px-8 md:pt-5"><div className="h-60 animate-pulse rounded-3xl bg-surface-container dark:bg-white/5" /></main>}>
      <Loaded params={params} />
    </Suspense>
  );
}

async function Loaded({ params }: { params: PageProps<"/exam-editor/[id]">["params"] }) {
  const { id } = await params;
  const me = await requireProfile(`/exam-editor/${id}`);
  const supabase = await createClient();
  const courses = await myCourses(supabase, me);
  const nowMs = new Date().getTime();
  const admin = me.role === "admin";

  if (id === "new") {
    if (!courses.length) redirect("/exam-editor");
    return <Editor key="new" exam={null} questions={[]} chapters={[]} courses={courses} locked={false} nowMs={nowMs} admin={admin} />;
  }
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) notFound();
  const { data } = await supabase.from("exams").select(EXAM_COLS).eq("id", n).maybeSingle();
  // নিজের কোর্সের পরীক্ষা ছাড়া অন্য (যেমন ভর্তি হওয়া কোর্সের প্রকাশিত) পরীক্ষা এখানে খোলে না
  if (!data || !courses.some((c) => c.id === data.course_id)) notFound();
  const [by, questions, { data: ch }, { data: started }] = await Promise.all([
    creators(supabase, [data.created_by]),
    loadQuestions(supabase, n),
    supabase.from("chapters").select("id, title, position").eq("course_id", data.course_id).order("position").order("id"),
    supabase.rpc("exam_started", { p_exam_id: n }),
  ]);
  const exam: ExamRow = toExam(data, new Map(courses.map((c) => [c.id, c.name])), by);
  const chapters: Chapter[] = ((ch ?? []) as { id: number; title: string }[]).map((c) => ({ id: c.id, title: c.title }));
  return <Editor key={n} exam={exam} questions={questions} chapters={chapters} courses={courses} locked={!!started} nowMs={nowMs} admin={admin} />;
}
