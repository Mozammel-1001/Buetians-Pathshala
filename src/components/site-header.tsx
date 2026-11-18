import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { getAuth, isStaff } from "@/lib/auth";
import { ThemeToggle } from "./theme-toggle";

// উপরের বার: লোগো, মেনু, থিম। লগইনের অংশ cookie পড়ে, তাই আলাদা <Suspense> এ; বাকিটা আগেই তৈরি থাকে
export function SiteHeader() {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-outline-variant/20 bg-surface/90 backdrop-blur-md dark:border-outline-variant/10 dark:bg-on-background/90">
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between gap-3 px-margin-mobile md:px-margin-desktop">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/images/logo-light.jpg" alt="বুয়েটিয়ান'স পাঠশালা" width={56} height={56} className="h-14 w-auto object-contain mix-blend-multiply dark:hidden" priority />
          <Image src="/images/logo-dark.png" alt="বুয়েটিয়ান'স পাঠশালা" width={56} height={56} className="hidden h-14 w-auto object-contain dark:block" priority />
          <span className="hidden text-xl font-bold text-primary md:block dark:text-primary-fixed">বুয়েটিয়ান&apos;স পাঠশালা</span>
        </Link>
        <nav className="hidden items-center gap-6 font-bold md:flex">
          <Link href="/#courses" className="muted hover:text-primary dark:hover:text-primary-fixed">কোর্সসমূহ</Link>
          <Link href="/about" className="muted hover:text-primary dark:hover:text-primary-fixed">আমাদের সম্পর্কে</Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Suspense fallback={<span className="h-10 w-24 animate-pulse rounded-full bg-surface-container dark:bg-white/10" />}>
            <UserArea />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function UserArea() {
  const { uid, profile } = await getAuth();
  if (!profile) {
    if (uid) return <Link href="/onboarding" className="btn-primary rounded-full!">সাইন আপ শেষ করুন</Link>;
    return (
      <>
        <Link href="/sign-up" className="btn-ghost hidden rounded-full! sm:inline-flex">সাইন আপ</Link>
        <Link href="/sign-in" className="btn-primary rounded-full!">লগইন</Link>
      </>
    );
  }
  return (
    <>
    {isStaff(profile) && (
      <Link href="/admin" className="btn-ghost hidden rounded-full! px-3! sm:inline-flex" title={profile.role === "admin" ? "অ্যাডমিন প্যানেল" : "ম্যানেজার প্যানেল"}>
        <span className="icon text-[20px]">admin_panel_settings</span>
      </Link>
    )}
    <Link href="/dashboard" className="btn-ghost rounded-full! px-3!" title={`${profile.full_name} · ${profile.user_code}`}>
      <span className="icon text-[20px]">account_circle</span>
      <span className="hidden max-w-32 truncate sm:inline">{profile.full_name.split(" ")[0] || "প্রোফাইল"}</span>
    </Link>
    </>
  );
}
