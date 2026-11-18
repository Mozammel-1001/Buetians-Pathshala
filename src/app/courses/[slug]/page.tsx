import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPublishedCourse } from "@/lib/content";
import { bnDate, taka, type Course } from "@/lib/content-schema";
import { EnrollAction } from "./enroll-action";

// কোর্সের বিস্তারিত: সব তথ্য অ্যাডমিন প্যানেলের কোর্স সম্পাদনা থেকে। কোর্সের ঠিকানা আগে জানা নেই, তাই
// কাঠামো আগে তৈরি থাকে আর কোর্সের অংশ Suspense এ আসে (তথ্যটা নিজে cache এ)
export async function generateMetadata({ params }: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const course = await getPublishedCourse((await params).slug);
  return course ? { title: course.title, description: course.subtitle ?? course.description?.slice(0, 160) } : { title: "কোর্স পাওয়া যায়নি" };
}

export default function CoursePage({ params }: PageProps<"/courses/[slug]">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <Suspense fallback={<div className="card h-96 animate-pulse" />}>
        {params.then(({ slug }) => <CourseDetails slug={slug} />)}
      </Suspense>
    </main>
  );
}

async function CourseDetails({ slug }: { slug: string }) {
  const c = await getPublishedCourse(slug);
  if (!c) notFound();

  return (
    <>
      <nav className="mb-4 text-sm muted"><Link href="/#courses" className="hover:text-primary">কোর্সসমূহ</Link> / {c.title}</nav>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-8">
          <header>
            {c.batch_name && <p className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary dark:text-primary-fixed">{c.batch_name}</p>}
            <h1 className="mt-3 text-3xl font-bold leading-tight md:text-5xl">{c.title}</h1>
            {c.subtitle && <p className="mt-3 text-lg muted">{c.subtitle}</p>}
          </header>

          {c.thumbnail_url && (
            <div className="relative aspect-[16/9] overflow-hidden rounded-3xl">
              <Image src={c.thumbnail_url} alt="" fill unoptimized priority sizes="(min-width: 1024px) 700px, 100vw" className="object-cover" />
            </div>
          )}

          {c.description && (
            <section className="card p-6 md:p-8">
              <h2 className="text-xl font-bold">কোর্স সম্পর্কে</h2>
              <p className="mt-3 leading-relaxed whitespace-pre-line">{c.description}</p>
            </section>
          )}

          {c.key_points.length > 0 && (
            <section className="card p-6 md:p-8">
              <h2 className="text-xl font-bold">কোর্সে যা থাকছে</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {c.key_points.map((k) => (
                  <li key={k} className="flex gap-2"><span className="icon text-primary dark:text-primary-fixed">check_circle</span>{k}</li>
                ))}
              </ul>
            </section>
          )}

          {(c.routine.length > 0 || c.routine_url || c.syllabus_url) && (
            <section className="card p-6 md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold">ক্লাস রুটিন</h2>
                <div className="flex flex-wrap gap-2">
                  {c.routine_url && <a href={c.routine_url} target="_blank" rel="noopener noreferrer" className="btn-ghost py-2!"><span className="icon text-[18px]">download</span>রুটিন</a>}
                  {c.syllabus_url && <a href={c.syllabus_url} target="_blank" rel="noopener noreferrer" className="btn-ghost py-2!"><span className="icon text-[18px]">download</span>সিলেবাস</a>}
                </div>
              </div>
              {c.routine.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="muted">
                      <tr className="border-b border-outline-variant/40"><th className="py-2 pr-4">দিন / তারিখ</th><th className="py-2 pr-4">সময়</th><th className="py-2">বিষয়</th></tr>
                    </thead>
                    <tbody>
                      {c.routine.map((r, i) => (
                        <tr key={i} className="border-b border-outline-variant/20 last:border-0">
                          <td className="py-2.5 pr-4 font-bold whitespace-nowrap">{r.day}</td>
                          <td className="py-2.5 pr-4 whitespace-nowrap muted">{r.time}</td>
                          <td className="py-2.5">{r.topic}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {c.faqs.length > 0 && (
            <section className="card p-6 md:p-8">
              <h2 className="text-xl font-bold">সাধারণ প্রশ্ন</h2>
              <div className="mt-3 divide-y divide-outline-variant/30">
                {c.faqs.map((f, i) => (
                  <details key={i} className="group py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold">
                      {f.q}<span className="icon transition-transform group-open:rotate-180">expand_more</span>
                    </summary>
                    <p className="mt-2 text-sm whitespace-pre-line muted">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <EnrollCard c={c} />
        </aside>
      </div>
    </>
  );
}

function EnrollCard({ c }: { c: Course }) {
  const rows = [
    ["event", "ক্লাস শুরু", bnDate(c.starts_on)],
    ["schedule", "ক্লাসের সময়", c.class_schedule],
    ["hourglass_top", "মেয়াদ", c.duration_label],
    ["event_busy", "ভর্তির শেষ দিন", bnDate(c.enroll_deadline)],
  ].filter((r) => r[2]) as [string, string, string][];
  return (
    <div className="card p-6">
      <p>
        <span className="text-3xl font-bold">{Number(c.price) === 0 ? "ফ্রি" : taka(c.price)}</span>
        {c.price_before && <span className="ml-2 muted line-through">{taka(c.price_before)}</span>}
      </p>
      {rows.length > 0 && (
        <ul className="mt-5 space-y-3 text-sm">
          {rows.map(([icon, label, value]) => (
            <li key={label} className="flex items-start gap-3">
              <span className="icon text-[20px] text-primary dark:text-primary-fixed">{icon}</span>
              <span><span className="block text-xs muted">{label}</span><b>{value}</b></span>
            </li>
          ))}
        </ul>
      )}
      {/* প্রতিজনের অবস্থা (লগইন, ভর্তি, আবেদন বাকি) আলাদা: এই অংশ request এর সময় আসে, বাকি পাতা cache থেকে */}
      <Suspense fallback={<div className="mt-6 h-12 animate-pulse rounded-xl bg-surface-container dark:bg-white/5" />}>
        <EnrollAction course={c} />
      </Suspense>
    </div>
  );
}
