"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSessionReplaced } from "@/lib/auth";

// নিজের বুকমার্ক মোছা আর ট্যাগ বদলানো (bookmarks_own policy নিজেরটাই ধরতে দেয়)
export type BmResult = { ok: boolean; error?: string };

export async function deleteBookmark(lessonId: number): Promise<BmResult> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) redirect("/sign-in?next=/bookmarks");
  const { data: hit, error } = await supabase.from("bookmarks").delete().eq("user_id", uid).eq("lesson_id", lessonId).select();
  if (isSessionReplaced(error)) redirect("/auth/replaced");
  if (error || !hit?.length) return { ok: false, error: "বুকমার্ক মোছা যায়নি" };
  refresh();
  return { ok: true };
}

export async function setBookmarkTag(lessonId: number, tag: string): Promise<BmResult> {
  const t = String(tag ?? "").trim().slice(0, 12) || null;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) redirect("/sign-in?next=/bookmarks");
  const { data: hit, error } = await supabase.from("bookmarks").update({ tag: t }).eq("user_id", uid).eq("lesson_id", lessonId).select();
  if (isSessionReplaced(error)) redirect("/auth/replaced");
  if (error || !hit?.length) return { ok: false, error: "ট্যাগ বদলানো যায়নি" };
  refresh();
  return { ok: true };
}
