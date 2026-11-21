import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SessionGuard } from "@/components/session-guard";
import { bn } from "@/lib/content-schema";
import { Player, type Module } from "./player";

export const metadata: Metadata = { title: "ক্লাস" };

// লেকচারের পাতা (online_class.html): ভিডিও, নোট/বুকমার্ক/কপিরাইট, পাশে অধ্যায়ভিত্তিক লেকচারের তালিকা।
// শুধু কোর্সে ভর্তি থাকা শিক্ষার্থী (বা staff)। অধ্যায়, লেকচার আর "দেখা হয়েছে" database থেকে।
// [PRODUCTION] ভিডিও: lessons.bunny_video_id থেকে token সহ Bunny লিংক (এখনো তৈরি হয়নি), তাই আপাতত নমুনা ভিডিও
export default function LearnPage({ params, searchParams }: PageProps<"/learn/[slug]">) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-[1440px] grow px-4 pt-2.5 md:px-8 md:pt-5"><div className="aspect-video w-full animate-pulse rounded-xl bg-surface-container dark:bg-white/5 lg:w-2/3" /></main>}>
      <Learn params={params} searchParams={searchParams} />
    </Suspense>
  );
}

type L = { id: number; chapter_id: number | null; lecture_no: number | null; title: string; duration_seconds: number | null; video_status: string | null; created_at: string };

async function Learn({ params, searchParams }: { params: PageProps<"/learn/[slug]">["params"]; searchParams: PageProps<"/learn/[slug]">["searchParams"] }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const me = await requireProfile(`/learn/${slug}`);
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("id, slug, title, thumbnail_url").eq("slug", slug).maybeSingle();
  if (!course) notFound();
  // ভর্তি না থাকলে কোর্সের পাতায় (সেখানে ভর্তির বোতাম)
  if (!isStaff(me)) {
    const nowIso = new Date(new Date().getTime()).toISOString();
    const { data: enr } = await supabase.from("enrollments").select("id").eq("user_id", me.id).eq("course_id", course.id).eq("status", "active").or(`expires_at.is.null,expires_at.gt.${nowIso}`).limit(1);
    if (!enr?.length) redirect(`/courses/${slug}`);
  }

  const { data: ls } = await supabase.from("lessons").select("id, chapter_id, lecture_no, title, duration_seconds, video_status, created_at").eq("course_id", course.id).order("lecture_no").order("id");
  const lessons = (ls ?? []) as L[];
  const chIds = [...new Set(lessons.map((l) => l.chapter_id).filter((x): x is number => x !== null))];
  const [{ data: chs }, { data: prog }] = await Promise.all([
    chIds.length ? supabase.from("chapters").select("id, title, position").in("id", chIds) : Promise.resolve({ data: [] as { id: number; title: string; position: number | null }[] }),
    lessons.length ? supabase.from("lesson_progress").select("lesson_id, completed").eq("user_id", me.id).in("lesson_id", lessons.map((l) => l.id)) : Promise.resolve({ data: [] as { lesson_id: number; completed: boolean }[] }),
  ]);
  const done = new Set((prog ?? []).filter((p) => p.completed).map((p) => p.lesson_id));
  const chapters = ((chs ?? []) as { id: number; title: string; position: number | null }[]).sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id);
  // অধ্যায় = মডিউল; অধ্যায় ছাড়া লেকচারগুলো শেষে "অন্যান্য লেকচার"
  const groups = [...chapters.map((c) => ({ id: c.id, title: c.title, items: lessons.filter((l) => l.chapter_id === c.id) })),
    ...(lessons.some((l) => l.chapter_id === null) ? [{ id: 0, title: "অন্যান্য লেকচার", items: lessons.filter((l) => l.chapter_id === null) }] : [])];
  const modules: Module[] = groups.map((g, i) => ({
    id: g.id, title: g.title,
    lessons: g.items.map((l, k) => ({
      id: l.id, title: l.title, label: `লেকচার ${bn(i + 1)}.${bn(l.lecture_no ?? k + 1)}`, seconds: l.duration_seconds ?? 0,
      ready: !l.video_status || l.video_status === "ready", done: done.has(l.id),
    })),
  }));
  const all = modules.flatMap((m) => m.lessons);
  const asked = Number(sp.lesson) || 0;
  const current = all.find((l) => l.id === asked) ?? all.find((l) => l.ready && !l.done) ?? all[0] ?? null;

  return (
    <>
      <SessionGuard />
      <Player course={{ slug: course.slug, title: course.title, thumb: course.thumbnail_url }} modules={modules} currentId={current?.id ?? null} />
    </>
  );
}
