import type { Metadata } from "next";
import { getSiteContent } from "@/lib/content";
import { lines, type Tone } from "@/lib/content-schema";
import { Counter } from "@/components/counter";
import { CtaBanner } from "@/components/cta-banner";

export const metadata: Metadata = { title: "আমাদের সম্পর্কে" };

// আমাদের সম্পর্কে, হুবহু ডেমোর (about_us.html) মতো: একই লেখা, ক্রম, সাজ, নড়াচড়া (ভেসে ওঠা, হেলে পড়া কার্ড, সংখ্যা গোনা,
// ভাসমান মাউস)। সব লেখা অ্যাডমিন প্যানেল → সাইটের লেখা → আমাদের সম্পর্কে থেকে; শেষের আহ্বান "শেষের আহ্বান" অংশ থেকে।
// ফাঁক: অংশের মাঝে laptop এ ৯৬px, মোবাইলে অর্ধেক (৪৮px); শেষের আহ্বান থেকে footer পর্যন্ত ১২০px / ৬০px

// রঙ: ক্লাসগুলো পুরো লেখা (Tailwind নাম জোড়া লাগালে খুঁজে পায় না)
const TONE: Record<Tone, { chip: string; plus: string }> = {
  green: { chip: "bg-primary/10 text-primary dark:bg-primary-fixed/10 dark:text-primary-fixed", plus: "text-primary dark:text-primary-fixed" },
  blue: { chip: "bg-blue-500/10 text-blue-600 dark:text-blue-400", plus: "text-blue-500" },
  purple: { chip: "bg-purple-500/10 text-purple-600 dark:text-purple-400", plus: "text-purple-500" },
  emerald: { chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", plus: "text-emerald-500" },
  orange: { chip: "bg-orange-500/10 text-orange-600 dark:text-orange-400", plus: "text-orange-500" },
  pink: { chip: "bg-pink-500/10 text-pink-600 dark:text-pink-400", plus: "text-pink-500" },
  yellow: { chip: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400", plus: "text-yellow-500" },
};
const delay = (ms: number) => ({ transitionDelay: `${ms}ms` });
const green = "text-primary dark:text-primary-fixed";

// লক্ষ্য আর রূপকল্পের কার্ড: প্রথমটা সবুজ ঘরানার, দ্বিতীয়টা লালচে (tertiary)
const BLOCKS = [
  { key: "mission", icon: "rocket_launch", delay: 100,
    iconBox: "bg-primary/10 text-primary dark:bg-primary-fixed/10 dark:text-primary-fixed",
    label: "bg-secondary-container text-on-secondary-container dark:bg-secondary-fixed-dim dark:text-on-secondary-fixed" },
  { key: "vision", icon: "visibility", delay: 200,
    iconBox: "bg-tertiary/10 text-tertiary dark:bg-tertiary-fixed-dim/20 dark:text-tertiary-fixed-dim",
    label: "bg-tertiary/10 text-tertiary dark:bg-tertiary-fixed-dim/20 dark:text-tertiary-fixed-dim" },
] as const;

export default async function AboutPage() {
  const { about, cta } = await getSiteContent();
  const { stats, why } = about;

  return (
    <main className="mx-auto flex w-full flex-col gap-12 pt-6 md:gap-24 md:pt-12">
      {/* ---------- শুরু ---------- */}
      <section className="reveal mx-auto max-w-[900px] px-margin-mobile text-center md:px-margin-desktop">
        {about.badge && (
          <span className="mx-auto mb-3 flex w-fit md:mb-6 items-center justify-center gap-2 rounded-full bg-secondary-container px-4 py-1.5 text-on-secondary-container transition-colors duration-300 dark:bg-secondary-fixed-dim dark:text-on-secondary-fixed">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> {about.badge}
          </span>
        )}
        <h1 className="mb-3 md:mb-6 text-headline-lg-mobile leading-tight text-on-background transition-colors duration-300 md:text-headline-xl md:leading-[56px] dark:text-background">
          {about.title} {about.highlight && <span className={green}>{about.highlight}</span>}
        </h1>
        {about.subtitle && (
          <p className="mx-auto mb-4 max-w-2xl text-body-lg md:mb-8 text-on-surface-variant transition-colors duration-300 dark:text-surface-variant">{about.subtitle}</p>
        )}
        <div className="animate-float text-on-surface-variant dark:text-surface-variant">
          <span className="icon text-3xl">mouse</span>
        </div>
      </section>

      {/* ---------- লক্ষ্য আর রূপকল্প ---------- */}
      <section className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-4 px-margin-mobile md:grid-cols-2 md:gap-8 md:px-margin-desktop">
        {BLOCKS.map((b) => {
          const v = about[b.key];
          return (
            <div key={b.key} className="reveal h-full" style={delay(b.delay)}>
              <div className="tilt-card flex h-full flex-col items-start rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-8 transition-colors duration-300 dark:border-outline-variant/10 dark:bg-inverse-surface">
                <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-xl ${b.iconBox}`}>
                  <span className="icon">{b.icon}</span>
                </div>
                {v.label && <span className={`mb-4 inline-block rounded-md px-3 py-1 text-[10px] font-bold tracking-wider uppercase ${b.label}`}>{v.label}</span>}
                <h3 className="mb-4 text-2xl font-bold text-on-background dark:text-background">{v.title}</h3>
                <p className="mb-8 grow text-sm leading-relaxed text-on-surface-variant dark:text-surface-variant">{v.text}</p>
                {lines(v.tags).length > 0 && (
                  <div className="flex w-full flex-wrap gap-3 border-t border-outline-variant/20 pt-6 dark:border-outline-variant/10">
                    {lines(v.tags).map((t) => (
                      <span key={t} className="rounded-full border border-outline-variant/30 px-4 py-1.5 text-[11px] font-bold text-on-surface-variant dark:text-surface-variant">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* ---------- পরিসংখ্যান ---------- */}
      {stats.length > 0 && (
        <section className="relative z-20 mx-auto w-full max-w-[1200px] px-margin-mobile md:px-margin-desktop">
          <div className="reveal flex flex-col items-center justify-around gap-8 divide-y divide-outline-variant/20 rounded-[2rem] border border-outline-variant/20 bg-surface-container-lowest px-6 py-10 shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-colors duration-300 md:flex-row md:gap-4 md:divide-x md:divide-y-0 dark:divide-outline-variant/10 dark:border-outline-variant/10 dark:bg-inverse-surface">
            {stats.map((s, i) => (
              <div key={i} className={`flex w-full flex-col items-center md:pt-0 ${i === 0 ? "pt-4" : "pt-8"}`}>
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${TONE[s.tone].chip}`}>
                  <span className="icon">{s.icon}</span>
                </div>
                <div className="flex items-baseline justify-center gap-1 text-4xl font-extrabold text-on-background transition-colors duration-300 md:text-5xl dark:text-background">
                  <Counter target={s.value} /><span className={TONE[s.tone].plus}>{s.suffix}</span>
                </div>
                <div className="mt-1 tracking-wider text-on-surface-variant uppercase dark:text-surface-variant">{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- আমরা কেন আলাদা ---------- */}
      {why.items.length > 0 && (
        <section className="mx-auto w-full max-w-[1200px] px-margin-mobile transition-colors duration-300 md:px-margin-desktop">
          <div className="reveal mb-10 text-center md:mb-20">
            {why.chip && (
              <span className="mb-4 inline-block rounded-full border border-outline-variant/30 px-4 py-1.5 text-[10px] tracking-wider text-on-surface-variant uppercase dark:text-surface-variant">{why.chip}</span>
            )}
            <h2 className="mb-3 text-headline-xl leading-tight text-on-background dark:text-background">
              {why.title} {why.highlight && <span className={green}>{why.highlight}</span>}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
            {why.items.map((it, i) => (
              <div key={i} className="reveal h-full" style={delay((i + 1) * 100)}>
                <div className="tilt-card flex h-full flex-col gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 dark:border-outline-variant/10 dark:bg-inverse-surface">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${TONE[it.tone].chip}`}>
                    <span className="icon text-lg">{it.icon}</span>
                  </div>
                  <h4 className="text-lg font-bold text-on-background dark:text-background">{it.title}</h4>
                  {it.text && <p className="text-sm leading-relaxed text-on-surface-variant dark:text-surface-variant">{it.text}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- শেষের আহ্বান ---------- */}
      {cta.title && (
        <section className="mx-auto w-full max-w-[1200px] px-margin-mobile pt-3 pb-5 md:px-margin-desktop md:pt-6 md:pb-10">
          <CtaBanner cta={cta} />
        </section>
      )}
    </main>
  );
}
