import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SessionGuard } from "@/components/session-guard";
import { bn } from "@/lib/content-schema";

const ACTION: Record<string, string> = {
  "courses.insert": "কোর্স তৈরি", "courses.update": "কোর্স বদল", "courses.delete": "কোর্স মোছা",
  "site_content.insert": "সাইটের লেখা", "site_content.update": "সাইটের লেখা বদল",
};
const SECTION: Record<string, string> = { hero: "hero", features: "কেন আমরা", branches: "ব্রাঞ্চ", cta: "শেষের আহ্বান", contact: "যোগাযোগ", about: "আমাদের সম্পর্কে" };

export default function AdminHome() {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse" />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const me = await requireStaff("/admin");
  const supabase = await createClient();
  const [{ count: pendingPays }, { data: courses }, { data: logs }] = await Promise.all([
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("courses").select("id, is_published"),
    supabase.from("audit_logs").select("id, action, entity, entity_id, meta, created_at, actor:profiles(full_name)")
      .in("entity", ["courses", "site_content"]).order("id", { ascending: false }).limit(15),
  ]);
  const published = (courses ?? []).filter((c) => c.is_published).length;
  const drafts = (courses ?? []).length - published;
  type Log = { id: number; action: string; entity: string; entity_id: string; meta: { fields?: string[]; title?: string; price_from?: number; price_to?: number } | null; created_at: string; actor: { full_name: string } | null };

  return (
    <div className="space-y-6">
      <SessionGuard />
      <h1 className="text-3xl font-bold">সারসংক্ষেপ</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon="hourglass_top" label="যাচাই বাকি পেমেন্ট" value={bn(pendingPays ?? 0)} href="/admin/payments" />
        {me.role === "admin" && (
          <>
            <Stat icon="public" label="প্রকাশিত কোর্স" value={bn(published)} href="/admin/courses" />
            <Stat icon="edit_note" label="খসড়া কোর্স" value={bn(drafts)} href="/admin/courses" />
            <Stat icon="web" label="সাইটের লেখা" value="সম্পাদনা" href="/admin/site" />
          </>
        )}
      </div>
      {me.role === "admin" && (
      <section className="card p-6">
        <h2 className="text-lg font-bold">সাম্প্রতিক বদল</h2>
        {(logs ?? []).length === 0 ? (
          <p className="mt-2 text-sm muted">এখনো কিছু বদলানো হয়নি।</p>
        ) : (
          <ul className="mt-3 divide-y divide-outline-variant/30 text-sm">
            {(logs as unknown as Log[]).map((l) => (
              <li key={l.id} className="flex flex-wrap justify-between gap-2 py-2.5">
                <span>
                  <b>{ACTION[l.action] ?? l.action}</b>{" "}
                  <span className="muted">
                    {l.entity === "site_content" ? SECTION[l.entity_id] ?? l.entity_id : l.meta?.title ?? `#${l.entity_id}`}
                    {l.meta?.price_from != null && ` · দাম ৳${bn(l.meta.price_from)} → ৳${bn(l.meta.price_to ?? 0)}`}
                  </span>
                </span>
                <span className="text-xs muted">{l.actor?.full_name ?? "SQL"} · {new Date(l.created_at).toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}
    </div>
  );
}

function Stat({ icon, label, value, href }: { icon: string; label: string; value: string; href: string }) {
  return (
    <Link href={href} className="card flex items-center gap-4 p-5 hover:shadow-md">
      <span className="icon grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary dark:text-primary-fixed">{icon}</span>
      <span><span className="block text-2xl font-bold">{value}</span><span className="text-sm muted">{label}</span></span>
    </Link>
  );
}
