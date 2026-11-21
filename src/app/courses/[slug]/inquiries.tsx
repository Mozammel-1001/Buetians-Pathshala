import { getAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InquiryBox, type Inquiry } from "./inquiry-box";

const when = (iso: string) => new Date(iso).toLocaleDateString("bn-BD", { dateStyle: "medium", timeZone: "Asia/Dhaka" });

// ভর্তির প্রশ্নের তালিকা: উত্তর পাওয়া সব প্রশ্ন + নিজের অপেক্ষমাণ প্রশ্ন (database এর RLS ঠিক এটুকুই দেখায়)।
// লগইনের cookie পড়ে, তাই <Suspense> এর ভেতরে আসে
export async function Inquiries({ courseId, slug }: { courseId: number; slug: string }) {
  const [{ uid, profile }, supabase] = await Promise.all([getAuth(), createClient()]);
  const { data } = await supabase.from("qa_questions")
    .select("id, body, user_id, created_at, answers:qa_answers(body, created_at)")
    .eq("course_id", courseId).eq("kind", "enrollment")
    .order("created_at", { ascending: false }).limit(50);
  type Row = { id: number; body: string; user_id: string; created_at: string; answers: { body: string; created_at: string }[] | null };
  const list: Inquiry[] = ((data ?? []) as Row[]).map((r) => ({
    id: r.id, body: r.body, when: when(r.created_at), mine: !!uid && r.user_id === uid,
    answers: (r.answers ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((a) => ({ body: a.body, when: when(a.created_at) })),
  }));
  return <InquiryBox courseId={courseId} slug={slug} list={list} loggedIn={!!uid} who={profile ? `${profile.full_name} (${profile.user_code})` : null} />;
}
