import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getProfile } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "অ্যাডমিন", template: "%s | অ্যাডমিন" }, robots: { index: false } };

// কে কোনটা দেখেন: পেমেন্ট যাচাই admin আর manager; কোর্স আর সাইটের লেখা শুধু admin
const NAV = [
  { href: "/admin", icon: "space_dashboard", label: "সারসংক্ষেপ", roles: ["admin", "manager"] },
  { href: "/admin/payments", icon: "payments", label: "পেমেন্ট যাচাই", roles: ["admin", "manager"] },
  { href: "/admin/courses", icon: "school", label: "কোর্স", roles: ["admin"] },
  { href: "/admin/site", icon: "web", label: "সাইটের লেখা", roles: ["admin"] },
];

// প্যানেলের কাঠামো। অনুমতি প্রতিটি পাতা নিজে দেখে (requireAdmin / requireStaff), database ও দেখে
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto grid max-w-[1300px] gap-6 px-4 py-8 md:grid-cols-[220px_minmax(0,1fr)] md:px-8">
      <nav aria-label="প্যানেল" className="flex gap-2 overflow-x-auto md:sticky md:top-24 md:flex-col md:self-start">
        <Suspense fallback={<span className="h-40 w-full animate-pulse rounded-xl bg-surface-container-low dark:bg-white/5" />}>
          <NavItems />
        </Suspense>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

async function NavItems() {
  const role = (await getProfile())?.role ?? "";
  return (
    <>
      <p className="hidden px-3 pb-2 text-xs font-bold tracking-wide muted md:block">{role === "manager" ? "ম্যানেজার প্যানেল" : "অ্যাডমিন প্যানেল"}</p>
      {NAV.filter((n) => n.roles.includes(role)).map((n) => (
        <Link key={n.href} href={n.href} className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold muted hover:bg-surface-container-low hover:text-primary dark:hover:bg-white/5 dark:hover:text-primary-fixed">
          <span className="icon text-[20px]">{n.icon}</span>{n.label}
        </Link>
      ))}
    </>
  );
}
