import Image from "next/image";
import Link from "next/link";
import { getSiteContent } from "@/lib/content";
import { SocialLogo, SOCIALS, type SocialKey } from "./social-logos";

// নিচের বার, হুবহু ডেমোর (index.html) লেখা আর সাজে: লোগোসহ নাম আর পরিচিতি | আমাদের সম্পর্কে, ক্যারিয়ার, প্রাইভেসি পলিসি,
// টার্মস অফ সার্ভিস (ডেমোর মাঝের দুই কলাম এক কলামে) | যোগাযোগ | Follow Us। যোগাযোগের তথ্য আর সামাজিক মাধ্যমের লিংক
// অ্যাডমিন প্যানেল → সাইটের লেখা → যোগাযোগ থেকে। বড় পর্দায় চার অংশের মাঝে সমান ফাঁক (justify-between: বাড়তি জায়গা সমান ভাগে),
// মাঝারি পর্দায় ২×২, মোবাইলে একটার নিচে একটা
const link = "w-fit font-bold text-on-surface-variant transition-colors hover:text-primary dark:text-surface-variant dark:hover:text-primary-fixed";

const LINKS = [
  { href: "/about", label: "আমাদের সম্পর্কে" },
  { href: "/careers", label: "ক্যারিয়ার" },
  { href: "/privacy", label: "প্রাইভেসি পলিসি" },
  { href: "/terms", label: "টার্মস অফ সার্ভিস" },
];

// ডেমোর আইকনের সারিতে ছিল Facebook, WhatsApp, YouTube, Instagram, Telegram; এখন চারটা (Instagram আপাতত বাদ)
const SOCIAL_ORDER: SocialKey[] = ["facebook", "youtube", "whatsapp", "telegram"];

export async function SiteFooter() {
  const { contact } = await getSiteContent();
  const wa = contact.whatsapp.replace(/\D/g, "");
  const hrefs: Record<SocialKey, string> = {
    facebook: contact.facebook,
    youtube: contact.youtube,
    whatsapp: wa ? `https://wa.me/${wa.startsWith("0") ? "88" + wa : wa}` : "",
    telegram: contact.telegram,
    // instagram: contact.instagram,   // আপাতত বন্ধ (ফেরাতে SOCIALS এ যোগ করে এখানকার comment তুলুন)
  };
  // আইকনের আকার: ডেমোর মতো ছোট, পাশে-পাশে; মাউস নিলে ব্র্যান্ডের নিজের রঙে ভরে ওঠে, একটু উঠে আসে আর বড় হয়
  const tile =
    "flex h-10 w-10 items-center justify-center rounded-full bg-on-surface/5 text-on-surface-variant transition-all duration-300 " +
    "hover:-translate-y-1 hover:scale-110 hover:bg-(--brand) hover:text-white hover:shadow-[0_8px_20px_-6px_var(--brand)] " +
    "focus-visible:-translate-y-1 focus-visible:bg-(--brand) focus-visible:text-white dark:bg-white/10 dark:text-surface-variant";

  return (
    <footer className="mt-10 w-full border-t border-outline-variant/40 bg-surface-container transition-colors duration-300 md:mt-20 dark:border-transparent dark:bg-inverse-surface">
      <div className="reveal mx-auto grid max-w-[1440px] grid-cols-1 gap-3 px-margin-mobile py-10 md:grid-cols-2 md:gap-gutter md:px-margin-desktop md:py-20 lg:flex lg:justify-between lg:gap-6">
        <div className="col-span-1 flex flex-col justify-between lg:max-w-72">
          <div>
            <Link href="/" className="mb-3 flex w-fit items-center gap-3 md:mb-6">
              {/* স্বচ্ছ-পটভূমির PNG (scripts/make-logo-transparent.mjs দিয়ে logo-light.jpg থেকে): footer এর অংশ ভেসে ওঠে
                  (transform), তাই header এর মতো mix-blend-multiply এখানে কাজ করে না */}
              <Image src="/images/logo-light-transparent.png" alt="" width={40} height={40} className="h-10 w-auto object-contain dark:hidden" />
              <Image src="/images/logo-dark.png" alt="" width={48} height={48} className="hidden h-10 w-auto object-contain dark:block" />
              <span className="text-xl font-bold text-on-surface dark:text-inverse-on-surface">বুয়েটিয়ান&apos;স পাঠশালা</span>
            </Link>
            {contact.footer_text && <p className="mb-6 text-body-md md:mb-12 whitespace-pre-line text-on-surface-variant dark:text-surface-variant">{contact.footer_text}</p>}
          </div>
        </div>

        <div className="col-span-1 flex flex-col gap-3 text-body-md">
          {LINKS.map((l) => <Link key={l.href} className={link} href={l.href}>{l.label}</Link>)}
        </div>

        <div className="col-span-1 flex flex-col gap-3 text-body-md lg:max-w-72">
          <span className="font-bold text-on-surface-variant dark:text-surface-variant">যোগাযোগ</span>
          <div className="mt-4 space-y-2 text-on-surface-variant dark:text-surface-variant">
            {contact.phone && (
              <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2 hover:text-primary dark:hover:text-primary-fixed">
                <span className="icon text-sm">call</span><span>{contact.phone}</span>
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-2 hover:text-primary dark:hover:text-primary-fixed">
                <span className="icon text-sm">mail</span><span>{contact.email}</span>
              </a>
            )}
            {contact.address && (
              <div className="flex items-start gap-2"><span className="icon text-sm">location_on</span><span className="whitespace-pre-line">{contact.address}</span></div>
            )}
          </div>
        </div>

        <div className="col-span-1 flex flex-col gap-3 text-body-md">
          <div className="mb-2 font-bold text-on-surface dark:text-inverse-on-surface">Follow Us</div>
          <div className="flex gap-4">
            {SOCIAL_ORDER.map((k) => {
              const s = SOCIALS[k];
              const style = { "--brand": s.color } as React.CSSProperties;
              const icon = <SocialLogo name={k} />;
              return hrefs[k] ? (
                <a key={k} href={hrefs[k]} target="_blank" rel="noopener noreferrer" aria-label={s.label} title={s.label} style={style} className={tile}>{icon}</a>
              ) : (
                // লিংক এখনো দেওয়া হয়নি (অ্যাডমিন প্যানেল → সাইটের লেখা → যোগাযোগ): আইকন থাকে, চাপলে কিছু হয় না
                <span key={k} role="img" aria-label={s.label} title={`${s.label}: লিংক এখনো দেওয়া হয়নি`} style={style} className={`${tile} cursor-default`}>{icon}</span>
              );
            })}
          </div>
        </div>
      </div>
      <div className="reveal border-t border-outline-variant/40 py-6 text-center text-body-md text-on-surface-variant dark:border-outline-variant/10 dark:text-surface-variant">
        © 2026 বুয়েটিয়ান&apos;স পাঠশালা। সর্বস্বত্ব সংরক্ষিত।
      </div>
    </footer>
  );
}
