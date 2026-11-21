import type { Metadata } from "next";
import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SessionGuard } from "@/components/session-guard";
import { bn } from "@/lib/content-schema";
import { BookmarksView, type Bm } from "./view";

export const metadata: Metadata = { title: "বুকমার্ক" };

// বুকমার্ক (bookmarks.html): লেকচার দেখার সময় দেওয়া বুকমার্ক, নতুনটা আগে। ট্যাগ না থাকলে কোর্সের নামের প্রথম অক্ষর
export default function BookmarksPage() {
  return (
    <Suspense fallback={<main className="grow"><div className="mx-auto mt-10 h-64 max-w-[1000px] animate-pulse rounded-3xl bg-surface-container dark:bg-white/5" /></main>}>
      <Bookmarks />
    </Suspense>
  );
}

type Row = { lesson_id: number; tag: string | null; lesson: { title: string; duration_seconds: number | null; course: { title: string; slug: string } | null; chapter: { title: string } | null } | null };

async function Bookmarks() {
  const me = await requireProfile("/bookmarks");
  const supabase = await createClient();
  const { data } = await supabase.from("bookmarks")
    .select("lesson_id, tag, created_at, lesson:lessons(title, duration_seconds, course:courses(title, slug), chapter:chapters(title))")
    .eq("user_id", me.id).order("created_at", { ascending: false }).limit(300);
  const items: Bm[] = ((data ?? []) as unknown as Row[]).filter((r) => r.lesson).map((r) => {
    const course = r.lesson!.course?.title ?? "";
    const mins = r.lesson!.duration_seconds ? Math.max(1, Math.round(r.lesson!.duration_seconds / 60)) : null;
    return {
      lessonId: r.lesson_id,
      href: r.lesson!.course?.slug ? `/learn/${r.lesson!.course.slug}?lesson=${r.lesson_id}` : "/dashboard#courses",
      tag: r.tag ?? (Array.from(course.trim())[0] || "•"),
      duration: mins ? `${bn(mins)} মিনিট` : "—",
      title: r.lesson!.title,
      subtitle: [course, r.lesson!.chapter?.title].filter(Boolean).join(" · "),
    };
  });
  return (<><SessionGuard /><BookmarksView name={me.full_name.split(" ")[0] || me.full_name} items={items} /></>);
}
