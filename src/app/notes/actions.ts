"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSessionReplaced } from "@/lib/auth";

// নিজের নোট মোছা আর নাম বদলানো (student_notes এর notes_own policy নিজেরটাই ধরতে দেয়)
export type NoteResult = { ok: boolean; error?: string };

export async function deleteNote(id: number): Promise<NoteResult> {
  const supabase = await createClient();
  const { data: hit, error } = await supabase.from("student_notes").delete().eq("id", id).select();
  if (isSessionReplaced(error)) redirect("/auth/replaced");
  if (error || !hit?.length) return { ok: false, error: "নোট মোছা যায়নি" };
  refresh();
  return { ok: true };
}

export async function renameNote(id: number, title: string): Promise<NoteResult> {
  const t = String(title ?? "").trim().slice(0, 150);
  if (!t) return { ok: false, error: "শিরোনাম লিখুন" };
  const supabase = await createClient();
  const { data: hit, error } = await supabase.from("student_notes").update({ title: t, updated_at: new Date().toISOString() }).eq("id", id).select();
  if (isSessionReplaced(error)) redirect("/auth/replaced");
  if (error || !hit?.length) return { ok: false, error: "সেভ করা যায়নি" };
  refresh();
  return { ok: true };
}
