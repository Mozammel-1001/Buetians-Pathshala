import Image from "next/image";
import Link from "next/link";
import { bnDate, taka, type Course } from "@/lib/content-schema";

// হোমপেজের কোর্সের কার্ড: ছবি, ব্যাচ, শুরুর তারিখ, মূল বিষয়, দাম (ছাড় থাকলে আগের দাম কেটে)
export function CourseCard({ c }: { c: Course }) {
  return (
    <Link href={`/courses/${c.slug}`} className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-lg">
      <div className="relative aspect-[16/9] bg-surface-container dark:bg-white/5">
        {c.thumbnail_url ? (
          // ছবি আপলোডের সময়েই ছোট করে WebP বানানো হয়, তাই Next এর image optimization লাগে না
          <Image src={c.thumbnail_url} alt="" fill unoptimized sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
        ) : (
          <span className="icon absolute inset-0 m-auto grid h-fit w-fit text-5xl text-primary/40 dark:text-primary-fixed/40">school</span>
        )}
        {c.batch_name && (
          <span className="absolute top-3 left-3 rounded-full bg-primary px-3 py-1 text-xs font-bold text-on-primary shadow">{c.batch_name}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-xl font-bold group-hover:text-primary dark:group-hover:text-primary-fixed">{c.title}</h3>
        {c.subtitle && <p className="mt-1 text-sm muted">{c.subtitle}</p>}
        {(c.starts_on || c.class_schedule) && (
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold muted">
            {c.starts_on && <span className="flex items-center gap-1"><span className="icon text-[16px]">event</span>শুরু {bnDate(c.starts_on)}</span>}
            {c.class_schedule && <span className="flex items-center gap-1"><span className="icon text-[16px]">schedule</span>{c.class_schedule}</span>}
          </p>
        )}
        {c.key_points.length > 0 && (
          <ul className="mt-4 space-y-1.5 text-sm">
            {c.key_points.slice(0, 4).map((k) => (
              <li key={k} className="flex gap-2"><span className="icon text-[18px] text-primary dark:text-primary-fixed">check_circle</span>{k}</li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <p>
            <span className="text-2xl font-bold">{Number(c.price) === 0 ? "ফ্রি" : taka(c.price)}</span>
            {c.price_before && <span className="ml-2 text-sm muted line-through">{taka(c.price_before)}</span>}
          </p>
          <span className="flex items-center gap-1 text-sm font-bold text-primary dark:text-primary-fixed">বিস্তারিত<span className="icon text-[18px]">arrow_forward</span></span>
        </div>
      </div>
    </Link>
  );
}
