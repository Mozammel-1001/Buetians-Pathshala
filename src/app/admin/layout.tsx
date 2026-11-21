import type { Metadata } from "next";
import { Suspense } from "react";
import { PanelShell } from "./_components/panel-shell";

export const metadata: Metadata = { title: { default: "অ্যাডমিন", template: "%s | অ্যাডমিন" }, robots: { index: false } };

// অ্যাডমিন প্যানেল (admin_dashboard.html)। মেনু আর কাঠামো _components/panel-shell.tsx এ, ম্যানেজার প্যানেলের সাথে একই।
// ম্যানেজার এখানে এলে /manager এ চলে যান
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<div className="mx-auto h-[70vh] max-w-[1440px] animate-pulse px-5 py-10"><div className="h-full rounded-3xl bg-surface-container-low dark:bg-white/5" /></div>}>
      <PanelShell panel="admin">{children}</PanelShell>
    </Suspense>
  );
}
