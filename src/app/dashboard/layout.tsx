import { Suspense } from "react";
import { signOut } from "../(auth)/actions";
import { StudentChips, StudentSideNav } from "./student-nav";

// ড্যাশবোর্ডের কাঠামো (dashboard.html): বাঁয়ে মেনু, ডানে পাতা। কে ঢুকতে পারবেন তা প্রতিটি পাতা নিজে দেখে (requireProfile)
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="mx-auto grid max-w-[1440px] grid-cols-1 lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-16 z-40 mt-4 hidden h-[calc(100vh-5rem)] flex-col border-r border-outline-variant/20 bg-background px-6 py-6 md:top-[72px] md:h-[calc(100vh-88px)] lg:flex dark:border-outline-variant/10 dark:bg-on-background">
        <Suspense fallback={<div className="grow" />}><StudentSideNav /></Suspense>
        <form action={signOut} className="mt-auto pt-4">
          <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-on-primary transition-all duration-300 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,108,73,0.3)]">
            <span className="icon text-sm">logout</span> লগআউট
          </button>
        </form>
      </aside>
      <main className="relative z-40 min-w-0 px-5 pt-5 pb-5 md:px-10 md:pt-8 md:pb-8">
        <Suspense fallback={null}><StudentChips /></Suspense>
        {children}
      </main>
    </div>
  );
}
