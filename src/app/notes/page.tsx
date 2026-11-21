import type { Metadata } from "next";
import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SessionGuard } from "@/components/session-guard";
import { NotesView, type Note } from "./view";

export const metadata: Metadata = { title: "নোটসমূহ" };

const bnDigits = (s: string) => s.replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);
// "০৭-০৭-২৬" (দিন-মাস-বছর, ঢাকার সময়), ডেমোর মতো
const shortDate = (iso: string) => {
  const d = new Date(Date.parse(iso) + 6 * 3600 * 1000).toISOString();
  return bnDigits(`${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(2, 4)}`);
};

// সকল নোটসমূহ (notes.html): নিজের নোট, সবশেষে বদলানোটা আগে
export default function NotesPage() {
  return (
    <Suspense fallback={<main className="grow"><div className="mx-auto mt-10 h-64 max-w-[1200px] animate-pulse rounded-3xl bg-surface-container dark:bg-white/5" /></main>}>
      <Notes />
    </Suspense>
  );
}

async function Notes() {
  const me = await requireProfile("/notes");
  const supabase = await createClient();
  const { data } = await supabase.from("student_notes").select("id, title, updated_at").eq("user_id", me.id).order("updated_at", { ascending: false }).limit(300);
  const notes: Note[] = ((data ?? []) as { id: number; title: string; updated_at: string }[]).map((n) => ({ id: n.id, title: n.title, date: shortDate(n.updated_at) }));
  return (<><SessionGuard /><NotesView name={me.full_name.split(" ")[0] || me.full_name} notes={notes} /></>);
}
