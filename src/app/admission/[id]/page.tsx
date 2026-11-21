import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { getCirculars } from "@/lib/content";

const dateBn = (d: string) => new Date(`${d}T00:00:00+06:00`).toLocaleDateString("bn-BD", { dateStyle: "long", timeZone: "Asia/Dhaka" });

export async function generateMetadata({ params }: PageProps<"/admission/[id]">): Promise<Metadata> {
  const id = Number((await params).id);
  const c = (await getCirculars())?.find((x) => x.id === id);
  return { title: c ? c.title : "বিজ্ঞপ্তি পাওয়া যায়নি" };
}

// একটা বিজ্ঞপ্তির বিস্তারিত, হুবহু admission_circular.html এর article: মাঝখানে শিরোনাম, অনুচ্ছেদ, সবুজ বিন্দুর তালিকা,
// বাঁয়ে সবুজ দাগের বিশেষ নোট, নিচে দাগ দেওয়া উপশিরোনাম। অ্যাডমিন যা লেখেন: "# " শিরোনাম, "- " তালিকা, "> " নোট, "! " লাল সতর্কতা
export default function CircularPage({ params }: PageProps<"/admission/[id]">) {
  return (
    <main className="px-margin-mobile pt-2.5 pb-5 md:px-margin-desktop md:pt-5 md:pb-xl">
      <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-[900px] animate-pulse rounded-3xl bg-surface-container md:mt-20 dark:bg-white/5" />}>
        {params.then(({ id }) => <Article id={Number(id)} />)}
      </Suspense>
    </main>
  );
}

async function Article({ id }: { id: number }) {
  const c = (await getCirculars())?.find((x) => x.id === id);
  if (!c) notFound();
  return (
    <article className="mx-auto mt-10 max-w-[900px] rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm md:mt-20 md:p-12 dark:border-outline-variant/10 dark:bg-inverse-surface">
      <div className="reveal mb-5 border-b border-outline-variant/20 pb-4 text-center md:mb-10 md:pb-8">
        <p className="mb-2 text-sm font-bold text-primary dark:text-primary-fixed">{c.institution}</p>
        <h1 className="mb-2 text-2xl font-bold text-on-background md:text-3xl dark:text-background">{c.title}</h1>
        {c.deadline && <p className="text-sm muted">আবেদনের শেষ তারিখ: <b>{dateBn(c.deadline)}</b></p>}
      </div>
      <div className="space-y-3 text-on-surface md:space-y-6 dark:text-background">{render(c.body ?? "")}</div>
      <div className="mt-6 flex flex-wrap justify-center gap-3 border-t border-outline-variant/20 pt-5 md:mt-12 md:pt-8">
        <Link href="/admission" className="btn-outline"><span className="icon text-[18px]">arrow_back</span> সব বিজ্ঞপ্তি</Link>
        {c.apply_url && <a href={c.apply_url} target="_blank" rel="noopener noreferrer" className="btn-primary"><span className="icon text-[18px]">open_in_new</span> আবেদন করুন</a>}
      </div>
    </article>
  );
}

// লেখাকে ডেমোর অংশে ভাগ করা: পাশাপাশি "- " লাইনগুলো একটা তালিকা, ফাঁকা লাইনে নতুন অনুচ্ছেদ
function render(body: string): ReactNode[] {
  const out: ReactNode[] = [];
  const blocks = body.replace(/\r/g, "").split(/\n\s*\n/);
  blocks.forEach((b, i) => {
    const lines = b.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    if (lines.every((l) => l.startsWith("- "))) {
      out.push(
        <ul key={i} className="list-none space-y-2 pl-4 md:space-y-4 md:pl-8">
          {lines.map((l, k) => <li key={k} className="reveal relative before:absolute before:top-2.5 before:-left-4 before:h-2 before:w-2 before:rounded-full before:bg-primary before:content-[''] md:before:-left-6">{l.slice(2)}</li>)}
        </ul>,
      );
      return;
    }
    const text = lines.join(" ");
    if (lines[0].startsWith("# ")) out.push(<h3 key={i} className="reveal border-b border-outline-variant/20 pt-3 pb-3 text-xl font-bold text-on-background md:pt-6 md:text-2xl dark:text-background">{text.slice(2)}</h3>);
    else if (lines[0].startsWith("> ")) out.push(<p key={i} className="reveal rounded-r-lg border-l-4 border-primary bg-surface-container-low p-4 font-medium text-on-background dark:bg-white/5 dark:text-background">{text.slice(2)}</p>);
    else if (lines[0].startsWith("! ")) out.push(<p key={i} className="reveal text-error dark:text-red-300">{text.slice(2)}</p>);
    else out.push(<p key={i} className="reveal leading-relaxed">{text}</p>);
  });
  return out;
}
