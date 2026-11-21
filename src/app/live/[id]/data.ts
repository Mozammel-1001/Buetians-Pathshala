import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// লাইভ ক্লাসের কমেন্ট আর লেখকের নাম (page আর server action দুই জায়গাতেই লাগে)
export type LiveRole = "teacher" | "admin" | "student";
export type LiveComment = { id: number; user: string; text: string; at: number; pinned: boolean; resolved: boolean; deleted: boolean };
export type People = Record<string, { name: string; role: LiveRole }>;
export type LiveStatus = "scheduled" | "live" | "ended";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const roleOf = (r: string | null | undefined): LiveRole => (r === "teacher" ? "teacher" : r === "admin" ? "admin" : "student");

type Row = { id: number; user_id: string; body: string; is_pinned: boolean; is_resolved: boolean; deleted_at: string | null; created_at: string };
export const toComment = (r: Row): LiveComment => ({
  id: r.id, user: r.user_id, text: r.deleted_at ? "" : r.body, at: Date.parse(r.created_at),
  pinned: r.is_pinned && !r.deleted_at, resolved: r.is_resolved, deleted: !!r.deleted_at,
});

// শেষ ৩০০টা কমেন্ট (মুছে ফেলা কমেন্ট RLS শুধু শিক্ষক বা admin কে দেখায়; শিক্ষার্থীর জন্য এখানেও বাদ)
export async function loadComments(supabase: SupabaseClient, sessionId: string, moderator: boolean) {
  const { data } = await supabase.from("live_comments")
    .select("id, user_id, body, is_pinned, is_resolved, deleted_at, created_at")
    .eq("session_id", sessionId).order("created_at", { ascending: false }).limit(300);
  return ((data ?? []) as Row[]).filter((r) => moderator || !r.deleted_at).reverse().map(toComment);
}

// নাম আর ভূমিকা: live_people() (শিক্ষার্থী অন্যের profile দেখে না, তাই function)
export async function loadPeople(supabase: SupabaseClient, sessionId: string): Promise<People> {
  const { data } = await supabase.rpc("live_people", { p_session_id: sessionId });
  const out: People = {};
  for (const p of (data ?? []) as { id: string; full_name: string; role: string }[]) out[p.id] = { name: p.full_name || "শিক্ষার্থী", role: roleOf(p.role) };
  return out;
}

export async function loadSession(supabase: SupabaseClient, sessionId: string) {
  const { data } = await supabase.from("live_sessions").select("status, started_at, peak_viewers").eq("id", sessionId).maybeSingle();
  return data as { status: LiveStatus; started_at: string | null; peak_viewers: number } | null;
}
