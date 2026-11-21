import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";
import { evMe, remainingCount } from "./data";
import { ROLE_LABEL } from "./lib";
import { EvBell, EvChips, EvSideNav, type NavItem } from "./nav";

// খাতা মূল্যায়ন প্যানেল (evaluator_dashboard.html): মূল্যায়নকারী, শিক্ষক (নিজের কোর্সের) আর অ্যাডমিন।
// বাঁয়ে মেনু, ডানে পাতা। মান যাচাই শুধু শিক্ষক আর অ্যাডমিনের, সম্মানী অ্যাডমিনের নেই (তাঁর কাটা খাতার সম্মানী হয় না)
export const metadata = { title: { default: "খাতা মূল্যায়ন", template: "%s | খাতা মূল্যায়ন" }, robots: { index: false } };

export default function EvaluatorLayout({ children }: LayoutProps<"/evaluator">) {
  return (
    <Suspense fallback={<div className="mx-auto h-[70vh] max-w-[1440px] animate-pulse px-5 py-10"><div className="h-full rounded-3xl bg-surface-container-low dark:bg-white/5" /></div>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: ReactNode }) {
  const me = await evMe("/evaluator");
  const sb = await createClient();
  const [remaining, notices] = await Promise.all([
    remainingCount(sb),
    sb.from("notices").select("created_at").eq("audience", me.role === "teacher" ? "teachers" : "evaluators").neq("channel", "sms").order("created_at", { ascending: false }).limit(20),
  ]);
  const noticeTimes = ((notices.data ?? []) as { created_at: string }[]).map((x) => Date.parse(x.created_at));
  const items: NavItem[] = [
    { href: "/evaluator", icon: "dashboard", label: "ড্যাশবোর্ড" },
    { href: "/evaluator/mark", icon: "rate_review", label: "খাতা কাটা", badge: "mark" },
    ...(me.role !== "evaluator" ? [{ href: "/evaluator/quality", icon: "verified", label: "মান যাচাই" }] : []),
    ...(me.role !== "admin" ? [{ href: "/evaluator/earn", icon: "payments", label: "আমার সম্মানী" }] : []),
    { href: "/evaluator/notices", icon: "campaign", label: "নোটিশ", badge: "notices" },
  ];
  // ফেরার বোতাম: শিক্ষক ড্যাশবোর্ডে, অ্যাডমিন প্যানেলে
  const back: [string, string] | null = me.role === "teacher" ? ["/teacher", "শিক্ষক ড্যাশবোর্ডে ফিরুন"] : me.role === "admin" ? ["/admin/evaluators", "অ্যাডমিন প্যানেলে ফিরুন"] : null;

  return (
    <div className="mx-auto grid max-w-[1440px] grid-cols-1 lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-16 z-40 mt-4 hidden h-[calc(100vh-5rem)] flex-col border-r border-outline-variant/20 bg-background px-6 py-6 md:top-[72px] md:h-[calc(100vh-88px)] lg:flex dark:border-outline-variant/10 dark:bg-on-background">
        <div className="mb-5 rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 dark:bg-white/5">
          <div className="text-[11px] font-bold text-on-surface-variant dark:text-surface-variant">খাতা মূল্যায়ন প্যানেল</div>
          <div className="truncate font-bold text-on-background dark:text-background">{me.full_name}</div>
          <div className="text-xs font-bold text-primary dark:text-primary-fixed">{ROLE_LABEL[me.role]}</div>
        </div>
        <EvSideNav items={items} uid={me.id} remaining={remaining} noticeTimes={noticeTimes} />
        <div className="mt-6 space-y-3">
          {back && (
            <Link href={back[0]} className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/30 py-2.5 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container-low dark:text-surface-variant dark:hover:bg-white/10">
              <span className="icon text-[18px]">arrow_back</span><span>{back[1]}</span>
            </Link>
          )}
          <form action={signOut}>
            <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-on-primary transition-all duration-300 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,108,73,0.3)]">
              <span className="icon text-sm">logout</span> লগআউট
            </button>
          </form>
        </div>
      </aside>
      <main className="relative z-40 min-w-0 px-5 pt-5 pb-5 md:px-10 md:pt-8 md:pb-8">
        <div className="mb-2 flex justify-end md:mb-0"><EvBell uid={me.id} noticeTimes={noticeTimes} /></div>
        <EvChips items={items} uid={me.id} remaining={remaining} noticeTimes={noticeTimes} back={back} />
        {children}
      </main>
    </div>
  );
}
