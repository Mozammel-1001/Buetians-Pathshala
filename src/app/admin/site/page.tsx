import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SessionGuard } from "@/components/session-guard";
import { DEFAULT_CONTENT, SECTION_KEYS, cleanSection, type SiteContent } from "@/lib/content-schema";
import { SiteEditor } from "../_components/site-editor";

export const metadata: Metadata = { title: "সাইটের লেখা" };

const JUMP = [["payment", "bKash"], ["hero", "Hero"], ["stats", "পরিসংখ্যান"], ["courses", "কোর্স অংশ"], ["features", "কেন আমরা"], ["cta", "শেষের আহ্বান"], ["contact", "যোগাযোগ"], ["about", "আমাদের সম্পর্কে"]];

export default function AdminSite() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-on-background md:text-3xl dark:text-background">সাইটের লেখা</h2>
        <p className="mt-1 text-sm muted">প্রতিটি অংশ আলাদা সেভ হয়। সেভের সাথে সাথে সাইটে দেখা যায়। কোর্সের তথ্য <Link href="/admin/courses" className="font-bold text-primary dark:text-primary-fixed">কোর্স</Link> পাতায়।</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {JUMP.map(([k, l]) => <a key={k} href={`#${k}`} className="rounded-full border border-outline-variant/40 px-3 py-1 text-xs font-bold muted hover:border-primary hover:text-primary">{l}</a>)}
        </div>
      </div>
      <Suspense fallback={<div className="card h-96 animate-pulse" />}>
        <Editor />
      </Suspense>
    </div>
  );
}

// সম্পাদনার জন্য সবসময় database এর এখনকার লেখা (cache নয়)
async function Editor() {
  await requireAdmin("/admin/site");
  const supabase = await createClient();
  const { data } = await supabase.from("site_content").select("key, value");
  const byKey = new Map((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
  const content = Object.fromEntries(
    SECTION_KEYS.map((k) => [k, byKey.has(k) ? cleanSection(k, byKey.get(k)) : DEFAULT_CONTENT[k]]),
  ) as SiteContent;
  return (
    <>
      <SessionGuard />
      <SiteEditor content={content} />
    </>
  );
}
