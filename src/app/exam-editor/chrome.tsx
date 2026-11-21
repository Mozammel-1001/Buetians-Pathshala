import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

// exam_editor.html এর উপরের বার: লোগো, "প্রশ্নপত্র", কে (নাম + ভূমিকা), ফিরে যান, থিম।
// সাইটের সাধারণ header/footer এই পাতায় লুকানো (শুধু এই পাতা খোলা থাকলে, তাই <style> এখানেই)
export function EdChrome({ name, admin }: { name: string; admin: boolean }) {
  return (
    <>
      <style>{`body > header, body > footer, #mouse-glow { display: none !important; }`}</style>
      <header className="fixed top-0 z-50 w-full border-b-2 border-outline-variant/40 bg-surface-container/95 backdrop-blur-md transition-colors duration-300 dark:border-outline-variant/10 dark:bg-on-background/90">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-margin-mobile md:h-[72px] md:px-margin-desktop">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image src="/images/logo-light.jpg" alt="বুয়েটিয়ান'স পাঠশালা" width={48} height={48} priority className="h-10 w-auto object-contain mix-blend-multiply md:h-12 dark:hidden" />
            <Image src="/images/logo-dark.png" alt="বুয়েটিয়ান'স পাঠশালা" width={48} height={48} priority className="hidden h-10 w-auto object-contain md:h-12 dark:block" />
            <span className="hidden truncate text-xl font-bold text-primary sm:block dark:text-primary-fixed">প্রশ্নপত্র</span>
          </Link>
          <div className="flex items-center gap-2 md:gap-3">
            <span className="hidden items-center gap-1 rounded-full border border-outline-variant/40 px-3 py-1 text-xs font-bold text-on-surface-variant md:inline-flex dark:text-surface-variant">{name} ({admin ? "অ্যাডমিন" : "শিক্ষক"})</span>
            <Link href={admin ? "/admin/exams" : "/teacher"} className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant/40 px-3 py-2 text-sm font-bold text-on-surface-variant transition-colors hover:border-primary hover:text-primary dark:text-surface-variant dark:hover:text-primary-fixed">
              <span className="icon text-[18px]">arrow_back</span><span className="hidden sm:inline">{admin ? "অ্যাডমিন প্যানেল" : "শিক্ষক ড্যাশবোর্ড"}</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>
    </>
  );
}
