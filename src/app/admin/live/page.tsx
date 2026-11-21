import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { LiveView, type RealLive } from "./view";

export const metadata: Metadata = { title: "লাইভ ক্লাস" };

// আসল লাইভ সেশন থাকলে (এখন লাইভ, আসন্ন বা শেষ) সেগুলো, নইলে নমুনা তালিকা
export default function Page() {
  return (
    <Suspense fallback={<LiveView real={[]} />}>
      <Real />
    </Suspense>
  );
}

const dhaka = (iso: string | null) => (iso ? new Date(iso).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "সময় ঠিক হয়নি");

async function Real() {
  const supabase = await createClient();
  const { data } = await supabase.from("live_sessions")
    .select("id, title, status, scheduled_at, started_at, ended_at, peak_viewers, course_id, teacher_id, recording_lesson_id")
    .order("created_at", { ascending: false }).limit(60);
  const rows = (data ?? []) as { id: string; title: string; status: "live" | "scheduled" | "ended"; scheduled_at: string | null; started_at: string | null; ended_at: string | null; peak_viewers: number; course_id: number; teacher_id: string; recording_lesson_id: number | null }[];
  if (!rows.length) return <LiveView real={[]} />;
  const [{ data: cs }, { data: ps }] = await Promise.all([
    supabase.from("courses").select("id, title").in("id", [...new Set(rows.map((r) => r.course_id))]),
    supabase.from("profiles").select("id, full_name").in("id", [...new Set(rows.map((r) => r.teacher_id))]),
  ]);
  const course = new Map(((cs ?? []) as { id: number; title: string }[]).map((c) => [c.id, c.title]));
  const name = new Map(((ps ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));
  const mins = (a: string | null, b: string | null) => (a && b ? Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 60000)) : 0);
  const real: RealLive[] = rows.map((r, i) => ({
    id: -(i + 1), sid: r.id, title: r.title, course: 0, courseTitle: course.get(r.course_id) ?? "কোর্স", teacher: name.get(r.teacher_id) ?? "শিক্ষক", status: r.status,
    when: r.status === "live" ? "এখন" : dhaka(r.status === "ended" ? r.started_at : r.scheduled_at),
    viewers: r.peak_viewers, started: r.started_at ? `${dhaka(r.started_at)} থেকে` : undefined,
    duration: r.status === "ended" ? `${mins(r.started_at, r.ended_at).toLocaleString("bn-BD")} মিনিট` : undefined,
    attendance: r.peak_viewers, recording: r.recording_lesson_id ? "ready" : "none",
  }));
  return <LiveView real={real} />;
}
