import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SessionGuard } from "@/components/session-guard";
import { UUID, loadComments, loadPeople } from "./data";
import { LiveRoom } from "./live-room";

export const metadata: Metadata = { title: "লাইভ ক্লাস" };

// লাইভ ক্লাস (live_class.html): Facebook Live এর মতো। ক্লাসের শিক্ষক ক্যামেরা চালু করে লাইভ করেন,
// ভর্তি শিক্ষার্থীরা দেখে আর কমেন্ট করে; শিক্ষক, কোর্সের অন্য শিক্ষক ও admin কমেন্ট সামলান।
// সেশন, কমেন্ট, pin/সমাধান/মুছুন, শুরু/শেষ আর উপস্থিতি database এ (live_sessions, live_comments, live_views)।
// কে দেখতে পারবে সেটা RLS ঠিক করে: অনুমতি না থাকলে সেশনই পাওয়া যায় না (404)
export default function LivePage({ params }: PageProps<"/live/[id]">) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-[1440px] grow px-5 pt-2.5 pb-5 md:px-10 md:pt-5 md:pb-10"><div className="aspect-video w-full animate-pulse rounded-2xl bg-surface-container dark:bg-white/5 lg:w-[calc(100%-400px)]" /></main>}>
      <Live params={params} />
    </Suspense>
  );
}

async function Live({ params }: { params: PageProps<"/live/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const me = await requireProfile(`/live/${id}`);
  const supabase = await createClient();
  const { data: s } = await supabase.from("live_sessions").select("id, course_id, teacher_id, title, status, started_at").eq("id", id).maybeSingle();
  if (!s) notFound();
  const [{ data: course }, { data: co }] = await Promise.all([
    supabase.from("courses").select("title").eq("id", s.course_id).maybeSingle(),
    supabase.from("course_teachers").select("course_id").eq("course_id", s.course_id).eq("teacher_id", me.id).limit(1),
  ]);
  // যিনি সম্প্রচার করেন: ক্লাসের শিক্ষক। কোর্সের অন্য শিক্ষক আর admin দেখেন ও কমেন্ট সামলান
  const broadcaster = s.teacher_id === me.id;
  const moderator = broadcaster || !!co?.length || me.role === "admin";
  const [comments, people] = await Promise.all([loadComments(supabase, id, moderator), loadPeople(supabase, id)]);
  people[me.id] = { name: me.full_name, role: broadcaster || me.role === "teacher" ? "teacher" : me.role === "admin" ? "admin" : "student" };
  const back = me.role === "admin" ? "/admin/live" : "/dashboard";

  return (
    <>
      <SessionGuard />
      <LiveRoom
        session={{ id, title: s.title, course: course?.title ?? "লাইভ ক্লাস", teacherId: s.teacher_id, status: s.status, startedAt: s.started_at ? Date.parse(s.started_at) : null }}
        me={{ id: me.id, name: me.full_name, broadcaster, moderator, admin: me.role === "admin" }}
        initialComments={comments} initialPeople={people} back={back}
      />
    </>
  );
}
