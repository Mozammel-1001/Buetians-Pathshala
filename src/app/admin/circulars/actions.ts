"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSessionReplaced } from "@/lib/auth";

// ভর্তি বিজ্ঞপ্তি যোগ/বদল/মোছা (শুধু admin; database এর RLS ও দেখে, audit_logs এ লেখা হয়)।
// সেভের পর updateTag("circulars"): সাইটের বিজ্ঞপ্তির পাতা সাথে সাথে নতুন দেখায়
export type CircState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; at?: number } | undefined;

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function saveCircular(_p: CircState, f: FormData): Promise<CircState> {
  const id = Number(f.get("id")) || null;
  const v = {
    institution: txt(f, "institution").slice(0, 80),
    title: txt(f, "title").slice(0, 200),
    body: txt(f, "body").slice(0, 20000) || null,
    apply_url: txt(f, "apply_url") || null,
    deadline: txt(f, "deadline") || null,
  };
  const e: Record<string, string> = {};
  if (!v.institution) e.institution = "প্রতিষ্ঠানের নাম লিখুন";
  if (v.title.length < 3) e.title = "শিরোনাম লিখুন";
  if (v.apply_url && !/^https?:\/\/\S+$/.test(v.apply_url)) e.apply_url = "সঠিক লিংক দিন (https://...)";
  if (v.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(v.deadline)) e.deadline = "তারিখ ঠিক নেই";
  if (Object.keys(e).length) return { fieldErrors: e, error: "কয়েকটা ঘর ঠিক করতে হবে", at: Date.now() };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("admission_circulars").update({ ...v, updated_at: new Date().toISOString() }).eq("id", id)
    : await supabase.from("admission_circulars").insert(v);
  if (isSessionReplaced(error)) redirect("/auth/replaced");
  if (error) return { error: "সেভ করা যায়নি (শুধু অ্যাডমিন পারেন)", at: Date.now() };
  updateTag("circulars");
  return { ok: true, at: Date.now() };
}

export async function deleteCircular(_p: CircState, f: FormData): Promise<CircState> {
  const supabase = await createClient();
  const { data: hit, error } = await supabase.from("admission_circulars").delete().eq("id", Number(f.get("id"))).select();
  if (isSessionReplaced(error)) redirect("/auth/replaced");
  if (error || !hit?.length) return { error: "মোছা যায়নি", at: Date.now() };
  updateTag("circulars");
  return { ok: true, at: Date.now() };
}
