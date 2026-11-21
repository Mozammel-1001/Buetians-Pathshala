import type { Metadata } from "next";
import { Suspense } from "react";
import { PanelShell } from "../admin/_components/panel-shell";

export const metadata: Metadata = { title: { default: "ম্যানেজার", template: "%s | ম্যানেজার" }, robots: { index: false } };

// ম্যানেজার প্যানেল (manager_dashboard.html): অ্যাডমিন প্যানেলের একই কাঠামো, শুধু ম্যানেজারের ১০টা view
export default function ManagerLayout({ children }: LayoutProps<"/manager">) {
  return (
    <Suspense fallback={<div className="mx-auto h-[70vh] max-w-[1440px] animate-pulse px-5 py-10"><div className="h-full rounded-3xl bg-surface-container-low dark:bg-white/5" /></div>}>
      <PanelShell panel="manager">{children}</PanelShell>
    </Suspense>
  );
}
