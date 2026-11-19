import { bn, type Course } from "@/lib/content-schema";
import { DelayedLink } from "./delayed-link";

// কোর্সের কার্ড, হুবহু ডেমোর (index.html) মতো: ছবির উপর গাঢ় আভা আর সাদা নাম (দ্বিতীয় লাইন সবুজে ব্যাচ), কোণে ব্যাজ,
// ছোট বিবরণ, প্রথম দুটো মূল বিষয়, নিচে মূল্য আর তীরের বোতাম। মাউসে হেলে পড়ে, চাপলে দেবে গিয়ে পাতায় যায়
export function CourseCard({ c, delay = 0 }: { c: Course; delay?: number }) {
  const bg = c.thumbnail_url
    ? `linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.1)), url("${c.thumbnail_url.replace(/"/g, "%22")}")`
    : "linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0.05)), linear-gradient(135deg, #006c49, #10b981)";
  return (
    <DelayedLink href={`/courses/${c.slug}`} className="reveal block h-full" style={{ transitionDelay: `${delay}ms` }}>
      <div className="tilt-card group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm dark:border-outline-variant/10 dark:bg-inverse-surface">
        <div className="relative flex aspect-video items-end justify-start rounded-t-2xl bg-cover bg-center p-4" style={{ backgroundImage: bg }}>
          {c.badge && <span className="absolute top-2 left-2 rounded bg-white/20 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">{c.badge}</span>}
          <h3 className="text-left text-xl leading-tight font-bold text-white md:text-2xl md:leading-8">
            {c.title}
            {c.batch_name && <><br /><span className="text-lg text-primary-fixed md:text-xl">{c.batch_name}</span></>}
          </h3>
        </div>
        <div className="flex grow flex-col p-5">
          {(c.subtitle || c.description) && (
            <p className="mb-4 line-clamp-3 grow text-sm text-on-surface-variant transition-colors duration-300 dark:text-surface-variant">{c.subtitle || c.description}</p>
          )}
          {c.key_points.length > 0 && (
            <ul className="mb-4 space-y-2 text-sm text-on-surface-variant transition-colors duration-300 dark:text-surface-variant">
              {c.key_points.slice(0, 2).map((k) => (
                <li key={k} className="flex items-start gap-2"><span className="icon text-[16px] text-primary dark:text-primary-fixed">check_circle</span>{k}</li>
              ))}
            </ul>
          )}
          <div className="mt-auto flex items-center justify-between border-t-2 border-outline-variant/20 pt-4 transition-colors duration-300 dark:border-outline-variant/10">
            <div>
              <span className="block text-[10px] text-on-surface-variant uppercase transition-colors duration-300 dark:text-surface-variant">মূল্য</span>
              <span className="text-lg font-bold text-on-background transition-colors duration-300 dark:text-background">
                {Number(c.price) === 0 ? "ফ্রি" : `৳${bn(Number(c.price))}`}
              </span>
              {c.price_before && <span className="ml-1.5 text-xs text-on-surface-variant line-through dark:text-surface-variant">৳{bn(Number(c.price_before))}</span>}
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-on-primary hover:scale-110 dark:bg-primary-fixed/10 dark:text-primary-fixed">
              <span className="icon text-[18px]">arrow_forward</span>
            </span>
          </div>
        </div>
      </div>
    </DelayedLink>
  );
}
