import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { getAuth, isStaff } from "@/lib/auth";
import { ThemeToggle } from "./theme-toggle";
import { MobileMenu } from "./mobile-menu";
import { NavLink } from "./nav-link";
import { HideOnAuth } from "./hide-on-auth";

// "অনুশীলন" আপাতত মেনুতে নেই (পাতাটা আছে: /practice); ফেরাতে নিচের comment করা লাইন তুলে দিন
export const NAV_LINKS = [
  { href: "/courses", label: "কোর্সসমূহ" },
  // { href: "/practice", label: "অনুশীলন" },
  { href: "/admission", label: "ভর্তি পরীক্ষার বিজ্ঞপ্তি" },
  { href: "/about", label: "আমাদের সম্পর্কে" },
];

// উপরের বার: লোগো, মেনু (যে পাতায় আছেন সেটা সবুজ), থিম, "Log In" (লগইন থাকলে ড্যাশবোর্ড), মোবাইলে মেনু বোতাম। উচ্চতা প্রচলিত মাপে
// (মোবাইলে ৬৪px, বড় পর্দায় ৭২px), রং মূল পটভূমির চেয়ে গাঢ়।
// লগইনের অংশ cookie পড়ে, তাই আলাদা <Suspense> এ; বাকিটা আগেই তৈরি থাকে
export function SiteHeader() {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-outline-variant/40 bg-surface-container/95 backdrop-blur-md transition-colors duration-300 dark:border-outline-variant/10 dark:bg-on-background/90">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-margin-mobile md:h-[72px] md:px-margin-desktop">
        <Link href="/" className="flex items-center gap-2.5">
          {/* সাদা পটভূমির jpg: multiply এ off-white এর সাথে মিশে যায় */}
          <Image src="/images/logo-light.jpg" alt="বুয়েটিয়ান'স পাঠশালা" width={48} height={48} priority className="h-10 w-auto object-contain mix-blend-multiply md:h-12 dark:hidden" />
          <Image src="/images/logo-dark.png" alt="বুয়েটিয়ান'স পাঠশালা" width={48} height={48} priority className="hidden h-10 w-auto object-contain md:h-12 dark:block" />
          <span className="hidden text-xl font-bold text-primary md:block dark:text-primary-fixed">বুয়েটিয়ান&apos;স পাঠশালা</span>
        </Link>

        <nav className="hidden items-center gap-7 text-[15px] md:flex">
          {NAV_LINKS.map((l) => (
            <NavLink key={l.href} href={l.href} className="font-semibold transition-colors duration-200"
              idleClassName="text-on-surface-variant hover:text-primary dark:text-surface-variant dark:hover:text-primary-fixed"
              activeClassName="text-primary dark:text-primary-fixed">
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 md:gap-3">
          <ThemeToggle />
          <HideOnAuth>
            <Suspense fallback={<span className="hidden h-9 w-24 animate-pulse rounded-full bg-primary/30 md:block" />}>
              <DesktopAction />
            </Suspense>
          </HideOnAuth>
          <MobileMenu links={NAV_LINKS} action={<HideOnAuth><Suspense fallback={<span className="block h-12 w-full rounded-full bg-primary/30" />}><MobileAction /></Suspense></HideOnAuth>} />
        </div>
      </div>
    </header>
  );
}

// লগইন না থাকলে "Log In"; থাকলে ড্যাশবোর্ড (staff হলে প্যানেলের বোতামও)
async function DesktopAction() {
  const { uid, profile } = await getAuth();
  const pill = "rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary transition-all duration-300 md:hover:scale-105 md:hover:shadow-lg";
  if (!profile) {
    return (
      <Link href={uid ? "/onboarding" : "/sign-in"} className={`hidden md:block ${pill} animate-pulse-glow`}>
        {uid ? "সাইন আপ শেষ করুন" : "Log In"}
      </Link>
    );
  }
  return (
    <>
      {isStaff(profile) && (
        <Link href="/admin" title={profile.role === "admin" ? "অ্যাডমিন প্যানেল" : "ম্যানেজার প্যানেল"}
          className="hidden items-center justify-center rounded-full p-2 text-on-surface-variant transition-all duration-300 hover:bg-surface-container-low md:flex md:hover:scale-110 dark:text-surface-variant dark:hover:bg-inverse-surface">
          <span className="icon">admin_panel_settings</span>
        </Link>
      )}
      <Link href="/dashboard" title={`${profile.full_name} · ${profile.user_code}`} className={`hidden items-center gap-1.5 md:flex ${pill}`}>
        <span className="icon text-[18px]">account_circle</span>
        <span className="max-w-28 truncate">{profile.full_name.split(" ")[0] || "ড্যাশবোর্ড"}</span>
      </Link>
    </>
  );
}

async function MobileAction() {
  const { uid, profile } = await getAuth();
  const btn = "block w-full rounded-full bg-primary py-3 text-center font-bold text-on-primary";
  if (!profile) return <Link href={uid ? "/onboarding" : "/sign-in"} className={btn}>{uid ? "সাইন আপ শেষ করুন" : "Log In"}</Link>;
  return (
    <div className="space-y-3">
      {isStaff(profile) && <Link href="/admin" className="block w-full rounded-full border-2 border-primary py-3 text-center font-bold text-primary dark:border-primary-fixed dark:text-primary-fixed">প্যানেল</Link>}
      <Link href="/dashboard" className={btn}>ড্যাশবোর্ড</Link>
    </div>
  );
}
