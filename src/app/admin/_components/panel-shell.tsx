import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { bn } from "@/lib/content-schema";
import { signOut } from "../../(auth)/actions";
import { Bell, ChipNav, Clock, GlobalSearch, SideNav, type Alert, type NavEntry } from "./admin-nav";

// অ্যাডমিন আর ম্যানেজার প্যানেলের একই কাঠামো (পাশের মেনু, খোঁজা, ঘড়ি, ঘণ্টা), হুবহু admin_dashboard.html / manager_dashboard.html।
// দুই ডেমো একই ফাইল থেকে তৈরি; ম্যানেজারের ফাইলে যে view গুলো আছে শুধু সেগুলোই তাঁর মেনুতে
type Panel = "admin" | "manager";
type Item = { path: string; icon: string; label: string; panels: Panel[]; count?: "pay" | "qa" | "inq"; live?: boolean };
const BOTH: Panel[] = ["admin", "manager"], ADMIN: Panel[] = ["admin"];
const MENU: (Item | { group: string })[] = [
  { group: "মূল" },
  { path: "", icon: "dashboard", label: "ড্যাশবোর্ড", panels: BOTH },
  { path: "/payments", icon: "payments", label: "পেমেন্ট অনুমোদন", panels: BOTH, count: "pay" },
  { path: "/transactions", icon: "account_balance", label: "মাসিক লেনদেন", panels: ADMIN },
  { group: "শিক্ষার্থী" },
  { path: "/users", icon: "group", label: "ইউজার ও রোল", panels: ADMIN },
  { path: "/enrollments", icon: "how_to_reg", label: "এনরোলমেন্ট", panels: BOTH },
  { path: "/inquiries", icon: "contact_support", label: "ভর্তির প্রশ্ন", panels: BOTH, count: "inq" },
  { group: "শিক্ষক ও খাতা মূল্যায়ন" },
  { path: "/classes", icon: "assignment_ind", label: "ক্লাস অ্যাসাইন", panels: BOTH },
  { path: "/evaluators", icon: "rate_review", label: "খাতা মূল্যায়ন", panels: BOTH },
  { path: "/payouts", icon: "request_quote", label: "সম্মানী", panels: BOTH },
  { group: "কন্টেন্ট ও ক্লাস" },
  { path: "/courses", icon: "book", label: "কোর্স ম্যানেজমেন্ট", panels: ADMIN },
  { path: "/content", icon: "video_library", label: "ভিডিও ও ম্যাটেরিয়াল", panels: ADMIN },
  { path: "/live", icon: "video_camera_front", label: "লাইভ ক্লাস", panels: ADMIN, live: true },
  { path: "/exams", icon: "quiz", label: "পরীক্ষা", panels: ADMIN },
  { path: "/qa", icon: "forum", label: "পড়াশোনার প্রশ্ন", panels: BOTH, count: "qa" },
  { group: "যোগাযোগ ও সিস্টেম" },
  { path: "/circulars", icon: "article", label: "ভর্তি বিজ্ঞপ্তি", panels: ADMIN },
  { path: "/notices", icon: "campaign", label: "নোটিশ ও SMS", panels: BOTH },
  { path: "/audit", icon: "history", label: "অডিট লগ", panels: ADMIN },
  { path: "/site", icon: "web", label: "সাইটের লেখা", panels: ADMIN },
  { path: "/settings", icon: "settings", label: "সেটিংস", panels: BOTH },
];

export async function PanelShell({ panel, children }: { panel: Panel; children: React.ReactNode }) {
  const root = panel === "admin" ? "/admin" : "/manager";
  // প্যানেল শুধু admin আর manager এর: লগইন না থাকলে লগইনে, অন্য কেউ হলে ৪০৪ (নমুনা পাতাগুলোও এতে ঢাকা)
  const role = (await requireStaff(root)).role;
  // ম্যানেজারের নিজের প্যানেল আছে: /admin এ এলে /manager এ। প্রতিটা পাতা নিজেও অনুমতি দেখে (database ও দেখে)
  if (panel === "admin" && role === "manager") redirect("/manager");
  const supabase = await createClient();
  const staff = role === "admin" || role === "manager";
  const now = new Date().getTime();
  const [pay, qa, live, inq, soon] = staff
    ? await Promise.all([
        supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("qa_questions").select("id", { count: "exact", head: true }).eq("kind", "study").is("answered_at", null),
        supabase.from("live_sessions").select("id", { count: "exact", head: true }).eq("status", "live"),
        supabase.from("qa_questions").select("id", { count: "exact", head: true }).eq("kind", "enrollment").is("answered_at", null),
        supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("status", "active").gte("expires_at", new Date(now).toISOString()).lte("expires_at", new Date(now + 7 * 86400000).toISOString()),
      ])
    : [null, null, null, null, null];
  // ঘণ্টার তালিকা (ডেমোর attentionItems)
  const n = (x: { count: number | null } | null) => x?.count ?? 0;
  const alerts: Alert[] = [
    n(pay) && { icon: "pending_actions", color: "text-error", text: `${bn(n(pay))}টি পেমেন্ট যাচাই বাকি`, href: `${root}/payments` },
    panel === "admin" && n(live) && { icon: "sensors", color: "text-error", text: `${bn(n(live))}টি ক্লাস এখন লাইভ`, href: "/admin/live" },
    n(inq) && { icon: "contact_support", color: "text-amber-500", text: `${bn(n(inq))}টি ভর্তির প্রশ্নের উত্তর বাকি`, href: `${root}/inquiries` },
    n(qa) && { icon: "forum", color: "text-amber-500", text: `${bn(n(qa))}টি পড়াশোনার প্রশ্নের উত্তর দেওয়া বাকি`, href: `${root}/qa` },
    n(soon) && { icon: "timer", color: "text-amber-500", text: `${bn(n(soon))}টি এনরোলমেন্টের মেয়াদ ৭ দিনে শেষ`, href: `${root}/enrollments?status=soon` },
  ].filter(Boolean) as Alert[];

  // এই প্যানেলের মেনুই আসে; ফাঁকা হয়ে যাওয়া দলের নাম বাদ
  const shown = MENU.filter((m) => !("panels" in m) || m.panels.includes(panel));
  const entries = shown
    .filter((m, i) => "panels" in m || (shown[i + 1] && "panels" in shown[i + 1]))
    .map((m): NavEntry =>
      "panels" in m
        ? { href: root + m.path, icon: m.icon, label: m.label, count: m.count === "pay" ? n(pay) : m.count === "qa" ? n(qa) : m.count === "inq" ? n(inq) : undefined, live: m.live ? (live?.count ?? 0) > 0 : undefined }
        : m);

  return (
    <div className="mx-auto grid max-w-[1440px] grid-cols-1 lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-16 z-40 hidden h-[calc(100vh-4rem)] flex-col self-start border-r border-outline-variant/20 bg-background px-5 pt-6 pb-6 md:top-[72px] md:h-[calc(100vh-72px)] lg:flex dark:border-outline-variant/10 dark:bg-on-background">
        <div className="mx-1 mb-4 flex items-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 py-2 dark:bg-white/5">
          <span className="icon text-primary dark:text-primary-fixed">admin_panel_settings</span>
          <span className="text-sm font-bold text-on-background dark:text-background">{panel === "manager" ? "ম্যানেজার প্যানেল" : "অ্যাডমিন প্যানেল"}</span>
        </div>
        <SideNav entries={entries} />
        <form action={signOut} className="pt-4">
          <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-on-primary transition-all duration-300 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,108,73,0.3)]">
            <span className="icon text-sm">logout</span> লগআউট
          </button>
        </form>
      </aside>

      <main className="relative z-40 w-full min-w-0 px-5 pt-5 pb-5 md:px-10 md:pt-10 md:pb-8">
        <div className="relative z-[60] mb-3 flex items-center gap-3 md:mb-6">
          <GlobalSearch canUsers={panel === "admin" && staff} root={root} />
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <div className="hidden items-center gap-2 text-xs font-bold muted md:flex">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <Clock />
            </div>
            {staff && <Bell items={alerts} />}
          </div>
        </div>
        <ChipNav entries={entries} />
        {children}
      </main>
    </div>
  );
}
