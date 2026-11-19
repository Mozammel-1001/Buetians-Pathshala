import Link from "next/link";

// এখনো তৈরি হয়নি এমন অংশের পাতা (মেনু ডেমোর মতো রাখতে)
export function ComingSoon({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <main className="mx-auto max-w-2xl px-margin-mobile py-10 text-center md:py-20 md:px-margin-desktop">
      <div className="reveal card p-10 md:p-14">
        <span className="icon mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl text-primary dark:bg-primary-fixed/10 dark:text-primary-fixed">{icon}</span>
        <h1 className="mt-3 text-headline-lg-mobile md:mt-6 text-on-background md:text-headline-lg dark:text-background">{title}</h1>
        <p className="mt-3 text-body-lg text-on-surface-variant dark:text-surface-variant">{text}</p>
        <Link href="/courses" className="mt-4 inline-flex md:mt-8 items-center gap-2 rounded-full bg-primary px-8 py-3 font-bold text-on-primary transition-all duration-300 hover:scale-105 hover:shadow-lg">
          কোর্স দেখুন <span className="icon text-sm">arrow_forward</span>
        </Link>
      </div>
    </main>
  );
}
