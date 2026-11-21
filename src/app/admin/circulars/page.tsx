import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SessionGuard } from "@/components/session-guard";
import { CircularsView, type Row } from "./view";

export const metadata: Metadata = { title: "ভর্তি বিজ্ঞপ্তি" };

// ভর্তি বিজ্ঞপ্তি (শুধু admin): সম্পাদনার জন্য সবসময় database এর এখনকার তালিকা (cache নয়)
export default function Page() {
  return <Suspense fallback={<div className="card h-64 animate-pulse" />}><Circulars /></Suspense>;
}

async function Circulars() {
  await requireAdmin("/admin/circulars");
  const supabase = await createClient();
  const { data } = await supabase.from("admission_circulars").select("id, institution, title, body, apply_url, deadline").order("deadline", { ascending: true, nullsFirst: false }).order("id", { ascending: false });
  return (<><SessionGuard /><CircularsView rows={(data ?? []) as Row[]} now={new Date().getTime()} /></>);
}
