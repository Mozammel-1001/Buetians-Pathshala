"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSessionReplaced } from "@/lib/auth";
import { supabaseUrl } from "@/lib/supabase/env";
import { cleanCourse, cleanSection, SECTION_KEYS, type SectionKey } from "@/lib/content-schema";

// অ্যাডমিন প্যানেলের সেভ। প্রতিটায় আগে দেখা হয় admin কিনা; database এর RLS ও একই নিয়ম মানে।
// সেভের পর updateTag: হোমপেজ আর কোর্সের পাতা সাথে সাথে নতুন লেখা দেখায়

export type SaveState = { ok?: boolean; savedAt?: number; error?: string; fieldErrors?: Record<string, string> } | undefined;

async function adminClient() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) redirect("/sign-in?next=/admin");
  const { data, error } = await supabase.from("profiles").select("role").eq("id", uid).maybeSingle();
  if (isSessionReplaced(error)) redirect("/auth/replaced");
  if (data?.role !== "admin") throw new Error("শুধু অ্যাডমিন");
  return supabase;
}

function parsePayload(formData: FormData): Record<string, unknown> | null {
  try {
    const v = JSON.parse(String(formData.get("payload") ?? ""));
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

// পুরনো ছবি/PDF বদলালে Storage থেকে মুছে ফেলা (free plan এ জায়গা ১GB)। না মুছলেও ক্ষতি নেই, তাই ভুল হলে চুপ
const MEDIA_PREFIX = () => `${supabaseUrl()}/storage/v1/object/public/site-media/`;
function mediaUrls(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") { if (v.startsWith(MEDIA_PREFIX())) out.push(v); }
  else if (Array.isArray(v)) v.forEach((x) => mediaUrls(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => mediaUrls(x, out));
  return out;
}
async function removeUnused(supabase: SupabaseClient, before: unknown, after: unknown) {
  const keep = new Set(mediaUrls(after));
  const paths = mediaUrls(before).filter((u) => !keep.has(u)).map((u) => decodeURIComponent(u.slice(MEDIA_PREFIX().length)));
  if (paths.length) await supabase.storage.from("site-media").remove(paths).catch(() => {});
}

// ---------- কোর্স ----------
export async function saveCourse(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const supabase = await adminClient();
  const raw = parsePayload(formData);
  if (!raw) return { error: "ফর্ম পড়া যায়নি, পাতা রিলোড করে আবার চেষ্টা করুন" };
  const id = Number(formData.get("id")) || null;
  const { value, errors } = cleanCourse(raw);
  if (Object.keys(errors).length) return { fieldErrors: errors, error: "কয়েকটা ঘর ঠিক করতে হবে" };

  let before: unknown = null;
  if (id) {
    const { data } = await supabase.from("courses").select("thumbnail_url, routine_url, syllabus_url").eq("id", id).maybeSingle();
    before = data;
  }
  const res = id
    ? await supabase.from("courses").update(value).eq("id", id).select("id").maybeSingle()
    : await supabase.from("courses").insert(value).select("id").single();
  if (res.error) {
    if (res.error.code === "23505") return { fieldErrors: { slug: "এই ঠিকানায় আরেকটা কোর্স আছে" }, error: "কয়েকটা ঘর ঠিক করতে হবে" };
    if (isSessionReplaced(res.error)) redirect("/auth/replaced");
    return { error: "সেভ হয়নি: " + res.error.message };
  }
  if (!res.data) return { error: "কোর্সটা পাওয়া যায়নি (হয়তো মুছে ফেলা হয়েছে)" };
  await removeUnused(supabase, before, value);
  updateTag("courses");
  if (!id) redirect(`/admin/courses/${res.data.id}?created=1`);
  return { ok: true, savedAt: Date.now() };
}

export async function deleteCourse(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const supabase = await adminClient();
  const id = Number(formData.get("id"));
  const { data: before } = await supabase.from("courses").select("thumbnail_url, routine_url, syllabus_url").eq("id", id).maybeSingle();
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") return { error: "এই কোর্সে ভর্তি, পেমেন্ট বা পরীক্ষা আছে, তাই মোছা যায় না। \"প্রকাশিত\" বন্ধ করে লুকিয়ে রাখুন।" };
    return { error: "মোছা যায়নি: " + error.message };
  }
  await removeUnused(supabase, before, null);
  updateTag("courses");
  redirect("/admin/courses?deleted=1");
}

// ---------- সাইটের লেখা ----------
export async function saveSection(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const supabase = await adminClient();
  const key = String(formData.get("key")) as SectionKey;
  if (!SECTION_KEYS.includes(key)) return { error: "অজানা অংশ" };
  const raw = parsePayload(formData);
  if (!raw) return { error: "ফর্ম পড়া যায়নি, পাতা রিলোড করে আবার চেষ্টা করুন" };
  const value = cleanSection(key, raw);

  const { data: before } = await supabase.from("site_content").select("value").eq("key", key).maybeSingle();
  const { error } = await supabase.from("site_content").upsert({ key, value });
  if (error) {
    if (isSessionReplaced(error)) redirect("/auth/replaced");
    return { error: "সেভ হয়নি: " + error.message };
  }
  await removeUnused(supabase, before?.value, value);
  updateTag("site-content");
  return { ok: true, savedAt: Date.now() };
}
