import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { evMe, loadNotices } from "../data";
import { NoticeList } from "./list";

export const metadata = { title: "নোটিশ" };

// নোটিশ (evaluator_dashboard.html এর notices): অ্যাডমিন মূল্যায়নকারীদের জন্য যা জানিয়েছেন (শিক্ষকের জন্য শিক্ষকদের নোটিশ)
export default function Page() {
  return (
    <Suspense fallback={<div className="h-60 animate-pulse rounded-3xl bg-surface-container dark:bg-white/5" />}>
      <Loaded />
    </Suspense>
  );
}

async function Loaded() {
  const me = await evMe("/evaluator/notices");
  const list = await loadNotices(await createClient(), me.role);
  return <NoticeList uid={me.id} list={list} />;
}
