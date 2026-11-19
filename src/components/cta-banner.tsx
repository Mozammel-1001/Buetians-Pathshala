import Link from "next/link";
import type { SiteContent } from "@/lib/content-schema";

// "আপনার ভবিষ্যৎ পরিবর্তন করতে প্রস্তুত?" সবুজ আহ্বানের কার্ড (লেখা: অ্যাডমিন প্যানেল → সাইটের লেখা → শেষের আহ্বান)।
// এখন শুধু আমাদের সম্পর্কে পাতায়; হোমপেজে বন্ধ (app/page.tsx এ comment)
export function CtaBanner({ cta }: { cta: SiteContent["cta"] }) {
  if (!cta.title) return null;
  const btn = "relative z-10 inline-block rounded-full bg-on-primary px-8 py-3 text-label-md font-bold whitespace-nowrap text-primary shadow-lg transition-transform duration-300 hover:scale-105 hover:shadow-xl md:px-20 md:py-4";
  return (
    <div className="reveal relative overflow-hidden rounded-[2rem] bg-primary px-6 py-12 text-center text-on-primary shadow-2xl md:p-20">
      <div className="absolute top-0 right-0 h-64 w-64 translate-x-1/4 -translate-y-1/2 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute bottom-0 left-0 h-80 w-80 translate-y-1/4 -translate-x-1/4 rounded-full bg-secondary-fixed/20 blur-3xl" />
      <h2 className="relative z-10 mb-4 text-headline-lg-mobile font-bold md:mb-6 md:text-headline-xl">{cta.title}</h2>
      {cta.text && <p className="relative z-10 mx-auto mb-8 max-w-2xl text-body-md text-primary-fixed md:mb-12 md:text-body-lg">{cta.text}</p>}
      {cta.button_label && cta.button_href && (
        /^https?:\/\//.test(cta.button_href)
          ? <a href={cta.button_href} target="_blank" rel="noopener noreferrer" className={btn}>{cta.button_label}</a>
          : <Link href={cta.button_href} className={btn}>{cta.button_label}</Link>
      )}
    </div>
  );
}
