import Image from "next/image";
import Link from "next/link";
import { getPublishedCourses, getSiteContent } from "@/lib/content";
import { CourseCard } from "@/components/course-card";

// হোমপেজ: সব লেখা আর ছবি অ্যাডমিন প্যানেল থেকে (সাইটের লেখা → hero, কেন আমরা, ব্রাঞ্চ, শেষের আহ্বান)।
// cache এ থাকে, অ্যাডমিন সেভ করলে সাথে সাথে নতুন হয়
export default async function Home() {
  const [content, courses] = await Promise.all([getSiteContent(), getPublishedCourses()]);
  const { hero, features, branches, cta } = content;

  return (
    <main className="mx-auto max-w-7xl px-4 md:px-8">
      <section className={`grid items-center gap-10 py-14 md:py-20 ${hero.image_url ? "lg:grid-cols-[1.1fr_1fr]" : ""}`}>
        <div>
          {hero.badge && (
            <p className="inline-flex rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-sm font-bold text-primary dark:text-primary-fixed">{hero.badge}</p>
          )}
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
            {hero.title} {hero.highlight && <span className="text-primary dark:text-primary-fixed">{hero.highlight}</span>}
          </h1>
          {hero.subtitle && <p className="mt-5 max-w-2xl text-lg whitespace-pre-line muted">{hero.subtitle}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            {hero.primary_label && hero.primary_href && <Link href={hero.primary_href} className="btn-primary px-7! py-3!">{hero.primary_label}</Link>}
            {hero.secondary_label && hero.secondary_href && <Link href={hero.secondary_href} className="btn-ghost px-7! py-3!">{hero.secondary_label}</Link>}
          </div>
        </div>
        {hero.image_url && (
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-xl">
            <Image src={hero.image_url} alt="" fill unoptimized priority sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
          </div>
        )}
      </section>

      <section id="courses" className="scroll-mt-24">
        <h2 className="text-3xl font-bold">কোর্সসমূহ</h2>
        {courses === null ? (
          <p className="card mt-6 p-6 text-sm muted">কোর্সের তালিকা আনা যায়নি। development এ .env.local এ Supabase এর ঠিকানা আর key দিন (README দেখুন)।</p>
        ) : courses.length === 0 ? (
          <p className="card mt-6 p-6 text-sm muted">এখনো কোনো কোর্স প্রকাশ হয়নি।</p>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {courses.map((c) => <CourseCard key={c.id} c={c} />)}
          </div>
        )}
      </section>

      {features.items.length > 0 && (
        <section className="mt-20">
          <h2 className="text-3xl font-bold">{features.title}</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.items.map((f, i) => (
              <div key={i} className="card p-6">
                <span className="icon grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary dark:text-primary-fixed">{f.icon}</span>
                <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
                {f.text && <p className="mt-1 text-sm muted">{f.text}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {branches.items.length > 0 && (
        <section className="mt-20">
          <h2 className="text-3xl font-bold">{branches.title}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {branches.items.map((b, i) => (
              <div key={i} className="card flex gap-3 p-5">
                <span className="icon text-primary dark:text-primary-fixed">location_on</span>
                <div className="text-sm">
                  <h3 className="text-base font-bold">{b.name}</h3>
                  {b.address && <p className="mt-0.5 whitespace-pre-line muted">{b.address}</p>}
                  {b.phone && <a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`} className="mt-1 block font-bold">{b.phone}</a>}
                  {b.map_url && <a href={b.map_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-bold text-primary dark:text-primary-fixed">ম্যাপে দেখুন</a>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {cta.title && (
        <section className="mt-20 rounded-3xl bg-primary px-6 py-12 text-center text-on-primary md:px-12">
          <h2 className="text-3xl font-bold">{cta.title}</h2>
          {cta.text && <p className="mx-auto mt-3 max-w-2xl opacity-90">{cta.text}</p>}
          {cta.button_label && cta.button_href && (
            <Link href={cta.button_href} className="btn mt-6 bg-white px-7! py-3! text-primary hover:-translate-y-px">{cta.button_label}</Link>
          )}
        </section>
      )}
    </main>
  );
}
