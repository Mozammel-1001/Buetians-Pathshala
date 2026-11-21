"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// admin_dashboard.html আর manager_dashboard.html এর header এ "কোর্সসমূহ" এর পরে "লাইভ ক্লাস" থাকে।
// শুধু প্যানেলের পাতায় দেখায়: /admin → /admin/live, /manager → /manager/live
function Inner({ className, idleClassName, activeClassName }: { className: string; idleClassName: string; activeClassName: string }) {
  const p = usePathname();
  // ম্যানেজারের প্যানেলে লাইভ ক্লাসের পাতা নেই (ডেমোতেও বোতামটা কোথাও নেয় না), তাই শুধু /admin এ
  const base = p.startsWith("/admin") ? "/admin" : null;
  if (!base) return null;
  const href = `${base}/live`;
  const active = p === href;
  return <Link href={href} aria-current={active ? "page" : undefined} className={`${className} ${active ? activeClassName : idleClassName}`}>লাইভ ক্লাস</Link>;
}

export function PanelLiveLink(props: { className: string; idleClassName: string; activeClassName: string }) {
  return <Suspense fallback={null}><Inner {...props} /></Suspense>;
}
