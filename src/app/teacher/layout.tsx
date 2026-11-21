import { Suspense, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";
import { remainingCount } from "../evaluator/data";
import { loadCourses, loadReminders, pendingQa, tMe } from "./data";
import { TBell, TChips, TSideNav } from "./nav";
import { TeacherTools } from "./tools";

// শিক্ষকের ড্যাশবোর্ড (teacher_dashboard.html): বাঁয়ে মেনু, ডানে পাতা। শুধু শিক্ষক (নিজের কোর্সের তথ্য)।
// ড্যাশবোর্ড, কোর্সের কন্টেন্ট, লাইভ, প্রশ্নোত্তর; পরীক্ষার সম্পাদক আর খাতা মূল্যায়ন আলাদা পাতায় (লিংক)
export const metadata = { title: { default: "শিক্ষক ড্যাশবোর্ড", template: "%s | শিক্ষক" }, robots: { index: false } };

export default function TeacherLayout({ children }: LayoutProps<"/teacher">) {
  return (
    <Suspense fallback={<div className="mx-auto h-[70vh] max-w-[1440px] animate-pulse px-5 py-10"><div className="h-full rounded-3xl bg-surface-container-low dark:bg-white/5" /></div>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: ReactNode }) {
  const me = await tMe("/teacher");
  const sb = await createClient();
  const courses = await loadCourses(sb, me.id);
  const [qa, mark, reminders] = await Promise.all([pendingQa(sb, courses.map((c) => c.id)), remainingCount(sb), loadReminders(sb)]);
  const now = new Date().getTime();
  return (
    <TeacherTools courses={courses.map((c) => ({ id: c.id, title: c.title, batch: c.batch, chapters: c.chapters }))}>
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 lg:grid-cols-[16rem_1fr]">
        <aside className="sticky top-16 z-40 mt-4 hidden h-[calc(100vh-5rem)] flex-col border-r border-outline-variant/20 bg-background px-6 py-6 md:top-[72px] md:h-[calc(100vh-88px)] lg:flex dark:border-outline-variant/10 dark:bg-on-background">
          <TSideNav qa={qa} mark={mark} />
          <form action={signOut} className="mt-auto pt-4">
            <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-on-primary transition-all duration-300 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,108,73,0.3)]">
              <span className="icon text-sm">logout</span> লগআউট
            </button>
          </form>
        </aside>
        <main className="relative z-40 min-w-0 px-5 pt-5 pb-5 md:px-10 md:pt-8 md:pb-8">
          <div className="mb-2 flex justify-end md:mb-0"><TBell reminders={reminders} pending={qa} nowMs={now} /></div>
          <TChips qa={qa} mark={mark} />
          {children}
        </main>
      </div>
    </TeacherTools>
  );
}
