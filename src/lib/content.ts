import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { hasSupabase } from "@/lib/supabase/env";
import { COURSE_COLUMNS, DEFAULT_CONTENT, SECTION_KEYS, cleanSection, type Course, type SiteContent } from "@/lib/content-schema";

// সাইটের লেখা আর প্রকাশিত কোর্স database থেকে। লগইন ছাড়া, সবার জন্য একই, তাই cache এ থাকে;
// অ্যাডমিন প্যানেলে সেভ করলে updateTag("site-content" / "courses") দিয়ে সাথে সাথে নতুন হয়
export async function getSiteContent(): Promise<SiteContent> {
  "use cache";
  cacheLife("hours");
  cacheTag("site-content");
  if (!hasSupabase()) return DEFAULT_CONTENT;
  const { data, error } = await createPublicClient().from("site_content").select("key, value");
  if (error || !data) return DEFAULT_CONTENT;
  const byKey = new Map(data.map((r: { key: string; value: unknown }) => [r.key, r.value]));
  return Object.fromEntries(
    SECTION_KEYS.map((k) => [k, byKey.has(k) ? cleanSection(k, byKey.get(k)) : DEFAULT_CONTENT[k]]),
  ) as SiteContent;
}

export async function getPublishedCourses(): Promise<Course[] | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("courses");
  if (!hasSupabase()) return null;
  const { data, error } = await createPublicClient()
    .from("courses")
    .select(COURSE_COLUMNS)
    .eq("is_published", true)
    .order("position")
    .order("id");
  return error ? null : (data as unknown as Course[]);
}

export async function getPublishedCourse(slug: string): Promise<Course | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("courses", `course:${slug}`);
  if (!hasSupabase()) return null;
  const { data } = await createPublicClient().from("courses").select(COURSE_COLUMNS).eq("slug", slug).eq("is_published", true).maybeSingle();
  return (data as unknown as Course | null) ?? null;
}

// ভর্তি বিজ্ঞপ্তি (সাইটের "ভর্তি পরীক্ষার বিজ্ঞপ্তি" পাতা): সবার জন্য একই, cache এ; অ্যাডমিন বদলালে updateTag("circulars")
export type Circular = { id: number; institution: string; title: string; body: string | null; apply_url: string | null; deadline: string | null; published_at: string };
export async function getCirculars(): Promise<Circular[] | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("circulars");
  if (!hasSupabase()) return null;
  const { data, error } = await createPublicClient().from("admission_circulars")
    .select("id, institution, title, body, apply_url, deadline, published_at").order("deadline", { ascending: true, nullsFirst: false }).order("id", { ascending: false });
  return error ? null : (data as Circular[]);
}
