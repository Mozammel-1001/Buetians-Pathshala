import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPublishedCourse, getSiteContent } from "@/lib/content";
import { bn, bnDate, lines, taka, type Course } from "@/lib/content-schema";
import { CourseTabs } from "./course-tabs";
import { EnrollAction } from "./enroll-action";
import { Inquiries } from "./inquiries";

// কোর্সের বিস্তারিত, হুবহু ডেমোর (course_details.html) মতো: শিরোনাম আর ছোট তথ্য, তিন ট্যাব (বিস্তারিত / প্রশ্ন ও উত্তর / নোটিশ ও রুটিন),
// ডানে দাম আর ভর্তির কার্ড। সব তথ্য অ্যাডমিন প্যানেলের কোর্স সম্পাদনা আর সাইটের লেখা (ব্রাঞ্চ, যোগাযোগ) থেকে।
// কোর্সের ঠিকানা আগে জানা নেই, তাই কাঠামো আগে তৈরি থাকে আর কোর্সের অংশ Suspense এ আসে (তথ্যটা নিজে cache এ)
export async function generateMetadata({ params }: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const course = await getPublishedCourse((await params).slug);
  return course ? { title: course.title, description: course.subtitle ?? course.description?.slice(0, 160) } : { title: "কোর্স পাওয়া যায়নি" };
}

export default function CoursePage({ params }: PageProps<"/courses/[slug]">) {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-margin-mobile pt-2.5 pb-5 md:px-margin-desktop md:pt-5 md:pb-xl">
      <Suspense fallback={<div className="mt-10 h-96 animate-pulse rounded-2xl bg-surface-container md:mt-20 dark:bg-white/5" />}>
        {params.then(({ slug }) => <CourseDetails slug={slug} />)}
      </Suspense>
    </main>
  );
}

const box = "reveal rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm md:p-8 dark:border-outline-variant/10 dark:bg-inverse-surface";
const heading = "reveal mb-3 flex items-center gap-2 border-l-4 pl-3 text-xl font-bold text-on-background md:mb-6 md:text-2xl dark:text-background";
const chip = "flex items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container-low px-4 py-2 text-on-surface-variant dark:border-outline-variant/10 dark:bg-inverse-surface dark:text-surface-variant";

async function CourseDetails({ slug }: { slug: string }) {
  const [c, content] = await Promise.all([getPublishedCourse(slug), getSiteContent()]);
  if (!c) notFound();
  const { branches, contact } = content;
  const paragraphs = lines(c.description ?? "");
  const facts = [
    ["calendar_today", c.starts_on && `শুরু: ${bnDate(c.starts_on)}`],
    ["schedule", c.class_schedule],
    ["hourglass_top", c.duration_label && `মেয়াদ: ${c.duration_label}`],
    ["language", c.medium && `মাধ্যম: ${c.medium}`],
  ].filter((f) => f[1]) as [string, string][];

  const details = (
    <>
      {(paragraphs.length > 0 || c.subtitle) && (
        <div className={box}>
          <h2 className={`${heading} border-[#f05a41]`}>বিস্তারিত কোর্স ওভারভিউ</h2>
          <div className="space-y-2 text-sm leading-relaxed text-on-surface-variant md:space-y-4 md:text-base dark:text-surface-variant">
            {paragraphs.length === 0 && <p className="reveal">{c.subtitle}</p>}
            {paragraphs.map((p, i) => <p key={i} className="reveal">{p}</p>)}
            {/* ▶ চিহ্নের হাইলাইট তালিকা (ডেমোর মতো বিবরণের নিচে) */}
            {(c.highlights ?? []).length > 0 && (
              <div className="mt-3 space-y-2 md:mt-6">
                {c.highlights.map((h, i) => <p key={i} className="reveal flex items-start gap-2"><span className="icon text-[20px] text-primary dark:text-primary-fixed">play_arrow</span>{h}</p>)}
              </div>
            )}
            {/* পুরস্কারের অংশ: "🏆 মাসিক মেগা পুরষ্কার", "🎁 সাপ্তাহিক সারপ্রাইজ গিফট" ইত্যাদি */}
            {(c.prizes ?? []).map((g, i) => (
              <div key={i} className="mt-4 border-t border-outline-variant/20 pt-3 md:mt-8 md:pt-6 dark:border-outline-variant/10">
                <h3 className="reveal mb-2 flex items-center gap-2 text-lg font-bold text-on-background md:mb-4 dark:text-background">{g.title}</h3>
                <ul className="space-y-2">{g.items.map((it, k) => <li key={k} className="reveal flex items-center gap-2">• {it}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      )}
      {c.key_points.length > 0 && (
        <div className="reveal rounded-2xl border border-outline-variant/20 bg-surface-container-low/50 p-4 md:p-8 dark:border-outline-variant/10 dark:bg-inverse-surface/50">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-on-background md:mb-6 dark:text-background">
            <span className="icon text-primary dark:text-primary-fixed">verified</span> অন্তর্ভুক্ত সুবিধাসমূহ
          </h3>
          <div className="grid grid-cols-1 gap-2 text-sm font-bold text-on-surface-variant md:grid-cols-2 md:gap-4 dark:text-surface-variant">
            {c.key_points.map((k) => (
              <div key={k} className="flex items-center gap-3">
                <span className="icon rounded-full bg-blue-500/10 p-1 text-blue-500">check</span>{k}
              </div>
            ))}
          </div>
        </div>
      )}
      {branches.items.length > 0 && (
        <div className={box}>
          <h2 className={`${heading} border-primary !text-lg md:!text-xl`}>আমাদের অফলাইন ব্রাঞ্চসমূহ</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 md:gap-4">
            {branches.items.map((b, i) => (
              <div key={i} className="flex flex-col gap-1 rounded-xl border border-outline-variant/20 p-4 transition-colors hover:border-primary dark:border-outline-variant/10">
                <span className="text-sm font-bold text-on-background dark:text-background">{b.name}</span>
                {b.phone && <span className="text-xs font-bold text-[#f05a41]">{b.phone}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const qa = (
    <>
    <Suspense fallback={<div className="h-56 animate-pulse rounded-2xl bg-surface-container dark:bg-white/5" />}>
      <Inquiries courseId={c.id} slug={c.slug} />
    </Suspense>
    {c.faqs.length > 0 && (
    <div className={box}>
      <h2 className="mb-1 text-xl font-bold text-on-background md:text-2xl dark:text-background">সাধারণ প্রশ্ন</h2>
      {(
        <div className="mt-3 divide-y divide-outline-variant/30">
          {c.faqs.map((f, i) => (
            <details key={i} className="group py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-on-background dark:text-background">
                {f.q}<span className="icon transition-transform group-open:rotate-180">expand_more</span>
              </summary>
              <p className="mt-2 text-sm whitespace-pre-line text-on-surface-variant dark:text-surface-variant">{f.a}</p>
            </details>
          ))}
        </div>
      )}
    </div>
    )}
    </>
  );

  const docs = [
    { title: "এক্সাম রুটিন পিডিএফ", sub: "এক্সাম রুটিন ডাউনলোড করুন", href: c.routine_url, tone: "bg-red-500/10 text-red-500" },
    { title: "সিলেবাস পিডিএফ", sub: "সিলেবাস ডাউনলোড করুন", href: c.syllabus_url, tone: "bg-blue-500/10 text-blue-500" },
  ].filter((d) => d.href);
  const notice = (
    <>
      {docs.map((d) => (
        <div key={d.title} className="reveal flex flex-col justify-between gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm transition-colors hover:border-primary sm:flex-row sm:items-center md:gap-4 dark:border-outline-variant/10 dark:bg-inverse-surface">
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${d.tone}`}><span className="icon text-2xl">description</span></div>
            <div>
              <h4 className="mb-1 text-base font-bold text-on-background dark:text-background">{d.title}</h4>
              <p className="text-xs text-on-surface-variant dark:text-surface-variant">{d.sub}</p>
            </div>
          </div>
          <a href={d.href!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-bold text-blue-500 hover:text-blue-400">
            ডাউনলোড <span className="icon text-lg">download</span>
          </a>
        </div>
      ))}
      {c.routine.length > 0 && (
        <div className={`${box} overflow-x-auto`}>
          <table className="w-full min-w-[480px] text-left text-sm text-on-surface-variant dark:text-surface-variant">
            <thead><tr className="border-b border-outline-variant/40"><th className="py-2 pr-4">দিন / তারিখ</th><th className="py-2 pr-4">সময়</th><th className="py-2">বিষয়</th></tr></thead>
            <tbody>
              {c.routine.map((r, i) => (
                <tr key={i} className="border-b border-outline-variant/20 last:border-0">
                  <td className="py-2.5 pr-4 font-bold whitespace-nowrap text-on-background dark:text-background">{r.day}</td>
                  <td className="py-2.5 pr-4 whitespace-nowrap">{r.time}</td>
                  <td className="py-2.5">{r.topic}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {docs.length === 0 && c.routine.length === 0 && <p className={`${box} text-sm text-on-surface-variant dark:text-surface-variant`}>এখনো কোনো নোটিশ বা রুটিন দেওয়া হয়নি।</p>}
    </>
  );

  return (
    <>
      <div className="reveal mt-10 mb-4 md:mt-20 md:mb-8">
        <h1 className="mb-3 text-3xl font-bold text-on-background md:mb-6 md:text-4xl dark:text-background">{c.title}{c.batch_name && ` ${c.batch_name}`}</h1>
        {facts.length > 0 && (
          <div className="flex flex-wrap gap-2 text-sm font-bold md:gap-4">
            {facts.map(([icon, text]) => <span key={text} className={chip}><span className="icon text-[18px]">{icon}</span>{text}</span>)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-8 lg:grid-cols-12">
        <div className="space-y-4 md:space-y-8 lg:col-span-8">
          <CourseTabs tabs={[
            { id: "details", label: "কোর্সের বিস্তারিত", panel: details },
            { id: "qa", label: "প্রশ্ন ও উত্তর", panel: qa },
            { id: "routine", label: "নোটিশ ও রুটিন", panel: notice },
          ]} />
        </div>

        <div className="lg:col-span-4">
          <div className="reveal space-y-3 md:space-y-6 lg:sticky lg:top-[100px]" style={{ transitionDelay: "100ms" }}>
            {(c.thumbnail_url || c.promo_video_url) && (() => {
              const card = (
                <>
                  {c.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.thumbnail_url} alt={c.title} className="h-[200px] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : <div className="h-[200px] w-full bg-gradient-to-br from-primary to-emerald-500" />}
                  {c.promo_video_url && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
                      <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.6)] transition-transform group-hover:scale-110"><span className="icon ml-1 text-3xl">play_arrow</span></div>
                      <span className="text-sm font-bold text-white">প্রোমো ভিডিও</span>
                    </div>
                  )}
                </>
              );
              const cls = "group relative block overflow-hidden rounded-2xl border border-outline-variant/20 shadow-lg dark:border-outline-variant/10";
              return c.promo_video_url
                ? <a href={c.promo_video_url} target="_blank" rel="noopener noreferrer" className={`${cls} cursor-pointer`} aria-label="প্রোমো ভিডিও দেখুন">{card}</a>
                : <div className={cls}>{card}</div>;
            })()}
            <PriceCard c={c} helpline={contact.phone} />
            {contact.whatsapp && (
              <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500 py-3 font-bold text-white shadow-md transition-colors hover:bg-blue-600">
                <span className="icon text-lg">chat</span> সাপোর্টে যোগাযোগ করুন
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function PriceCard({ c, helpline }: { c: Course; helpline: string }) {
  const free = Number(c.price) === 0;
  const off = c.price_before && Number(c.price_before) > Number(c.price) ? Math.round((1 - Number(c.price) / Number(c.price_before)) * 100) : 0;
  const rows = [
    ["শুরুর তারিখ", bnDate(c.starts_on)],
    ["ক্লাসের সময়", c.class_schedule],
    ["মেয়াদ", c.duration_label],
    ["ভর্তির শেষ দিন", bnDate(c.enroll_deadline)],
    ["মোট আসন", c.total_seats ? bn(c.total_seats) : null],
    ["মাধ্যম", c.medium],
  ].filter((r) => r[1]) as [string, string][];
  const line = "flex items-center justify-between border-b border-outline-variant/20 pb-3 dark:border-outline-variant/10";
  return (
    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-lg dark:border-outline-variant/10 dark:bg-inverse-surface">
      <div className="mb-3 text-center md:mb-6">
        {off > 0 && <span className="mb-2 inline-block animate-pulse rounded bg-red-100 px-2 py-1 text-xs font-bold text-red-600">{bn(off)}% ছাড়</span>}
        <div className="mb-1 text-sm text-on-surface-variant dark:text-surface-variant">কোর্স ফি</div>
        <div className="flex items-end justify-center gap-3">
          <span className="text-3xl font-bold text-on-background dark:text-background">{free ? "ফ্রি" : taka(c.price)}</span>
          {c.price_before && <span className="text-lg text-on-surface-variant line-through decoration-red-500 dark:text-surface-variant">{taka(c.price_before)}</span>}
        </div>
      </div>
      {/* প্রতিজনের অবস্থা (লগইন, ভর্তি, আবেদন বাকি) আলাদা: এই অংশ request এর সময় আসে, বাকি পাতা cache থেকে */}
      <Suspense fallback={<div className="h-12 animate-pulse rounded-lg bg-surface-container dark:bg-white/5" />}>
        <EnrollAction course={c} />
      </Suspense>
      <div className="mt-3 space-y-2 text-sm text-on-surface-variant md:mt-6 md:space-y-4 dark:text-surface-variant">
        {rows.map(([k, v], i) => (
          <div key={k} className={i === rows.length - 1 && !helpline ? "flex items-center justify-between pb-2" : line}>
            <span>{k}</span><span className="font-bold text-on-background dark:text-background">{v}</span>
          </div>
        ))}
        {helpline && <div className="flex items-center justify-between pb-2"><span>হেল্পলাইন</span><span className="font-bold text-[#f05a41]">{helpline}</span></div>}
      </div>
    </div>
  );
}
