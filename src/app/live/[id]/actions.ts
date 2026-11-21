"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSessionReplaced } from "@/lib/auth";
import { UUID, loadComments, loadPeople, loadSession, toComment, type LiveComment, type LiveStatus, type People } from "./data";

// লাইভ ক্লাসের কাজ: কমেন্ট, pin/সমাধান/মুছুন, লাইভ শুরু ও শেষ, উপস্থিতি।
// অনুমতি database দেখে (RLS, live_comment_guard, can_host_live), এখানে শুধু ডাকা আর বার্তা সাজানো
export type LiveResult = { ok?: boolean; error?: string };

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/sign-in");
  return supabase;
}
// database এর বার্তা বাংলায় থাকে (raise exception), সেটাই দেখানো; বাকিগুলোতে সাধারণ বার্তা
const msg = (e: { code?: string; message?: string }, fallback: string) => {
  if (isSessionReplaced(e)) redirect("/auth/replaced");
  if (e.code === "23505") return "এই কোর্সে আরেকটা লাইভ ক্লাস এখন চলছে";
  return e.message && /[ঀ-৿]/.test(e.message) ? e.message : fallback;
};

export async function postLiveComment(sessionId: string, body: string): Promise<LiveResult & { comment?: LiveComment }> {
  const text = body.trim().slice(0, 300);
  if (!UUID.test(sessionId) || !text) return { error: "কমেন্ট ফাঁকা রাখা যাবে না" };
  const supabase = await me();
  const { data, error } = await supabase.from("live_comments").insert({ session_id: sessionId, body: text })
    .select("id, user_id, body, is_pinned, is_resolved, deleted_at, created_at").single();
  if (error) return { error: msg(error, "কমেন্ট পাঠানো যায়নি, আবার চেষ্টা করুন") };
  return { ok: true, comment: toComment(data) };
}

export async function moderateLive(commentId: number, action: "pin" | "unpin" | "resolve" | "unresolve" | "delete"): Promise<LiveResult> {
  const supabase = await me();
  const { error } = await supabase.rpc("moderate_comment", { p_comment_id: commentId, p_action: action });
  return error ? { error: msg(error, "কাজটা করা যায়নি") } : { ok: true };
}

export async function setLive(sessionId: string, on: boolean): Promise<LiveResult> {
  if (!UUID.test(sessionId)) return { error: "সেশন পাওয়া যায়নি" };
  const supabase = await me();
  const { error } = await supabase.rpc(on ? "start_live" : "end_live", { p_session_id: sessionId });
  return error ? { error: msg(error, on ? "লাইভ শুরু করা যায়নি" : "লাইভ শেষ করা যায়নি") } : { ok: true };
}

// প্লেয়ার নিয়মিত ডাকে: উপস্থিতি জমা হয়, এখন কতজন দেখছে ফেরত আসে
export async function liveHeartbeat(sessionId: string): Promise<number> {
  if (!UUID.test(sessionId)) return 0;
  const supabase = await me();
  const { data } = await supabase.rpc("live_heartbeat", { p_session_id: sessionId });
  return Number(data) || 0;
}

// নতুন কেউ কমেন্ট করলে তাঁর নাম
export async function livePeople(sessionId: string): Promise<People> {
  if (!UUID.test(sessionId)) return {};
  return loadPeople(await me(), sessionId);
}

// Realtime না চললে (বা আবার যুক্ত হলে) পুরো অবস্থা নতুন করে
export async function pollLive(sessionId: string, moderator: boolean): Promise<{ status: LiveStatus; startedAt: number | null; peak: number; comments: LiveComment[]; people: People } | null> {
  if (!UUID.test(sessionId)) return null;
  const supabase = await me();
  const [s, comments, people] = await Promise.all([loadSession(supabase, sessionId), loadComments(supabase, sessionId, moderator), loadPeople(supabase, sessionId)]);
  if (!s) return null;
  return { status: s.status, startedAt: s.started_at ? Date.parse(s.started_at) : null, peak: s.peak_viewers ?? 0, comments, people };
}
