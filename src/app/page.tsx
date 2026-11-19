import Link from "next/link";
import type { ReactNode } from "react";
import { getPublishedCourses, getSiteContent } from "@/lib/content";
import { lines, type Feature } from "@/lib/content-schema";
import { HeroSlider } from "@/components/hero-slider";
import { Counter } from "@/components/counter";
// import { CtaBanner } from "@/components/cta-banner";
// import { BranchesSection, PlatformSection } from "@/components/home-hidden-sections";
import { CourseGrid } from "@/components/course-grid";

// হোমপেজ, হুবহু ডেমোর (index.html) মতো: একই ক্রম, মাপ, নড়াচড়া আর hover। সব লেখা আর ছবি অ্যাডমিন প্যানেল
// (সাইটের লেখা) থেকে, কোর্স আসে কোর্স থেকে। cache এ থাকে, অ্যাডমিন সেভ করলে সাথে সাথে নতুন হয়
const H2 = "mb-3 text-headline-xl leading-tight text-on-background transition-colors duration-300 dark:text-background";
const green = "text-primary dark:text-primary-fixed";

// লিংক: সাইটের ভেতরে হলে Link, বাইরে হলে নতুন ট্যাবে
function Go({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  if (/^https?:\/\//.test(href)) return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
  return <Link href={href} className={className}>{children}</Link>;
}
const delay = (ms: number) => ({ transitionDelay: `${ms}ms` });

export default async function Home() {
  const [content, courses] = await Promise.all([getSiteContent(), getPublishedCourses()]);
  const { hero, stats, courses: cs, features } = content;
  // const { cta } = content;   // শেষের আহ্বান বন্ধ
  // const { platform, branches } = content;   // বন্ধ অংশ দুটোর জন্য

  return (
    <main className="grow">
      {/* ---------- Hero ---------- */}
      {/* overflow-hidden নেই: থাকলে ছবির পেছনের সবুজ আভা অংশের কিনারায় কেটে গিয়ে পাশে একটা সোজা রেখা দেখাত।
          পাতা পাশে সরে যাওয়া body এর overflow-x-hidden আটকায় */}
      <section className="relative mx-auto max-w-[1200px] px-margin-mobile py-10 md:px-margin-desktop md:py-20">
        <div className={`relative z-10 grid grid-cols-1 items-center gap-6 md:gap-12 ${hero.images.length ? "md:grid-cols-2" : ""}`}>
          <div className={`reveal order-2 text-center md:order-1 ${hero.images.length ? "md:text-left" : "mx-auto max-w-4xl"}`}>
            {hero.badge && (
              <span className={`mx-auto mb-3 inline-flex md:mb-6 w-fit items-center gap-2 rounded-full bg-secondary-container px-3 py-1 text-on-secondary-container transition-colors duration-300 ${hero.images.length ? "md:mx-0" : ""} dark:bg-secondary-fixed-dim dark:text-on-secondary-fixed`}>
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> {hero.badge}
              </span>
            )}
            <h1 className="mb-3 text-headline-lg-mobile leading-tight whitespace-pre-line md:mb-6 md:leading-[56px] text-on-background transition-colors duration-300 md:text-headline-xl dark:text-background">
              <span className={green}>{hero.title}</span> {hero.highlight}
            </h1>
            {hero.subtitle && (
              <p className="mx-auto mb-6 max-w-2xl text-body-md md:mb-12 whitespace-pre-line text-on-surface-variant md:text-body-lg dark:text-surface-variant">{hero.subtitle}</p>
            )}
            <div className={`flex flex-col flex-wrap justify-center gap-4 sm:flex-row ${hero.images.length ? "md:justify-start" : ""}`}>
              {hero.primary_label && hero.primary_href && (
                <Go href={hero.primary_href} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-12 py-6 text-label-md text-on-primary transition-all duration-300 sm:w-auto md:hover:scale-105">
                  {hero.primary_label}
                  <span className="icon text-sm">arrow_forward</span>
                </Go>
              )}
              {/* "ডেমো দেখুন" বোতাম আপাতত বন্ধ (ফেরাতে এই comment তুলে দিন)
              {hero.secondary_label && hero.secondary_href && (
                <Go href={hero.secondary_href} className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-primary bg-transparent px-12 py-6 text-label-md font-bold text-primary transition-all duration-300 sm:w-auto md:hover:scale-105 md:hover:bg-primary/10 md:hover:shadow-lg dark:border-primary-fixed dark:text-primary-fixed dark:md:hover:bg-primary-fixed/10">
                  <span className="icon text-[20px]">play_circle</span>
                  {hero.secondary_label}
                </Go>
              )}
              */}
            </div>
          </div>
          {hero.images.length > 0 && (
            <div className="reveal relative order-1 mt-4 flex w-full items-center justify-center md:order-2 md:mt-0 md:justify-end" style={delay(200)}>
              <HeroSlider images={hero.images} kicker={hero.card_kicker} title={hero.card_title} />
            </div>
          )}
        </div>
      </section>

      {/* ---------- পরিসংখ্যান ---------- */}
      {stats.items.length > 0 && (
        <section className="relative z-20 mx-auto -mt-5 max-w-[1200px] px-margin-mobile py-6 md:-mt-10 md:px-margin-desktop md:py-12">
          <div className="grid grid-cols-2 gap-3 text-center md:grid-cols-4 md:gap-6">
            {stats.items.map((s, i) => (
              <div key={i} style={delay(i * 100)}
                className="reveal flex flex-col items-center justify-center rounded-2xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-colors duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-outline-variant/10 dark:bg-inverse-surface">
                <div className="flex items-baseline justify-center gap-1 text-4xl font-extrabold text-on-background transition-colors duration-300 md:text-5xl dark:text-background">
                  <Counter target={s.value} /><span className={green}>{s.suffix}</span>
                </div>
                <div className="mt-2 tracking-wider text-on-surface-variant uppercase transition-colors duration-300 dark:text-surface-variant">{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- কোর্স ---------- */}
      <section id="courses" className="mx-auto mt-5 max-w-[1200px] scroll-mt-24 md:mt-10 rounded-[3rem] border border-outline-variant/40 bg-surface-container-low shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] px-margin-mobile py-10 transition-colors duration-300 md:px-margin-desktop md:py-20 dark:border-outline-variant/10 dark:bg-inverse-surface/30">
        <div className="reveal mb-10 text-center md:mb-20">
          <h2 className={H2}>{cs.title} {cs.highlight && <span className={green}>{cs.highlight}</span>}</h2>
          {cs.subtitle && <p className="mx-auto max-w-2xl text-body-lg text-on-surface-variant transition-colors duration-300 dark:text-surface-variant">{cs.subtitle}</p>}
        </div>
        {courses === null ? (
          <p className="card p-6 text-center text-sm muted">কোর্সের তালিকা আনা যায়নি। development এ .env.local এ Supabase এর ঠিকানা আর key দিন (README দেখুন)।</p>
        ) : courses.length === 0 ? (
          <p className="card p-6 text-center text-sm muted">এখনো কোনো কোর্স প্রকাশ হয়নি।</p>
        ) : (
          <CourseGrid courses={courses} allLabel={cs.all_label} limit={8} />
        )}
        {cs.button_label && (
          <div className="reveal mt-5 text-center md:mt-10" style={delay(500)}>
            <Link href="/courses" className="inline-block rounded-md bg-red-500 px-8 py-3 text-sm font-bold text-white shadow-md transition-all duration-300 hover:scale-105 hover:bg-red-600 hover:shadow-lg">
              {cs.button_label}
            </Link>
          </div>
        )}
      </section>

      {/* ---------- কেন আমরা (bento) ---------- */}
      {features.items.length > 0 && (
        <section className="mx-auto max-w-[1200px] px-margin-mobile pt-10 pb-5 transition-colors duration-300 md:px-margin-desktop md:pt-20 md:pb-10">
          <div className="reveal mb-10 text-center md:mb-20">
            <h2 className={H2}>{features.title} {features.highlight && <span className={green}>{features.highlight}</span>}</h2>
          </div>
          <div className="grid auto-rows-auto grid-cols-1 gap-3 md:auto-rows-[200px] md:gap-6 md:grid-cols-3">
            {features.items.map((f, i) => (
              <div key={i} className={`reveal h-full ${f.variant === "large" ? "md:row-span-2" : ""}`} style={delay((i + 1) * 100)}>
                <FeatureCard f={f} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* প্ল্যাটফর্ম ("কমপ্লিট ডিজিটাল একাডেমিক প্ল্যাটফর্ম") আর "আমাদের ব্রাঞ্চসমূহ" অংশ আপাতত বন্ধ।
          কোড আছে components/home-hidden-sections.tsx এ; ফেরাতে উপরের import আর নিচের দুই লাইনের comment তুলে দিন
      <PlatformSection platform={platform} />
      <BranchesSection branches={branches} />
      */}

      {/* শেষের সবুজ আহ্বান ("আপনার ভবিষ্যৎ পরিবর্তন করতে প্রস্তুত?") আপাতত বন্ধ; আমাদের সম্পর্কে পাতায় আছে।
          ফেরাতে: উপরের import আর `const { cta }` এর comment তুলুন, আর নিচের comment তুলুন
      {cta.title && (
        <section className="mx-auto max-w-[1200px] px-margin-mobile pt-10 pb-5 md:px-margin-desktop md:pt-20 md:pb-10">
          <CtaBanner cta={cta} />
        </section>
      )}
      */}
    </main>
  );
}

// "কেন আমরা" এর কার্ড: বড় (আইকন, দুই সারি জুড়ে), সাধারণ, রঙিন, ছবির উপর লেখা
function FeatureCard({ f }: { f: Feature }) {
  const points = lines(f.points);
  const base = "tilt-card h-full rounded-3xl";
  const plainBox = "border border-outline-variant/30 bg-surface-container-lowest dark:border-outline-variant/10 dark:bg-inverse-surface";
  const list = (gap: string) => points.length > 0 && (
    <ul className={`${gap} w-full text-left text-sm text-on-surface-variant dark:text-surface-variant`}>
      {points.map((p) => <li key={p} className="flex items-center gap-2"><span className={`icon text-sm ${green}`}>check_circle</span>{p}</li>)}
    </ul>
  );
  if (f.variant === "large") {
    return (
      <div className={`${base} ${plainBox} flex flex-col items-center justify-center p-8 text-center`}>
        {f.icon && <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-error/10 text-error"><span className="icon text-3xl">{f.icon}</span></div>}
        <h3 className="mb-4 text-2xl font-bold whitespace-pre-line text-on-background dark:text-background">{f.title}</h3>
        {f.text && <p className="mb-6 text-sm font-bold tracking-wider text-on-surface-variant uppercase dark:text-surface-variant">{f.text}</p>}
        {list("space-y-3")}
      </div>
    );
  }
  if (f.variant === "gradient") {
    return (
      <div className={`${base} flex flex-col justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-white`}>
        <h3 className="mb-2 text-2xl font-bold whitespace-pre-line">{f.title}</h3>
        {f.text && <p className="text-sm opacity-90">{f.text}</p>}
      </div>
    );
  }
  if (f.variant === "image") {
    return (
      <div className={`${base} ${plainBox} relative flex flex-col justify-end overflow-hidden p-6`}>
        {f.image_url && <div className="absolute inset-0 bg-cover bg-center opacity-20 dark:opacity-40" style={{ backgroundImage: `url("${f.image_url.replace(/"/g, "%22")}")` }} />}
        <div className="relative z-10">
          <h3 className="mb-1 text-lg font-bold whitespace-pre-line text-on-background dark:text-background">{f.title}</h3>
          {f.text && <p className="text-xs text-on-surface-variant dark:text-surface-variant">{f.text}</p>}
        </div>
      </div>
    );
  }
  return (
    <div className={`${base} ${plainBox} flex flex-col justify-center p-6`}>
      <h3 className="mb-3 text-lg font-bold whitespace-pre-line text-on-background dark:text-background">{f.title}</h3>
      {f.text && <p className="mb-2 text-sm text-on-surface-variant dark:text-surface-variant">{f.text}</p>}
      {list("space-y-2")}
    </div>
  );
}
