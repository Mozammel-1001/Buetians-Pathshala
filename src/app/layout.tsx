import type { Metadata } from "next";
import { Hind_Siliguri } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WelcomeModal } from "@/components/welcome-modal";
import { MotionEffects } from "@/components/motion-effects";
import { BackToTop } from "@/components/back-to-top";
import { Suspense } from "react";
import "./globals.css";

const hind = Hind_Siliguri({
  variable: "--font-hind",
  subsets: ["bengali", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "বুয়েটিয়ান'স পাঠশালা", template: "%s | বুয়েটিয়ান'স পাঠশালা" },
  description: "HSC আর ভর্তি পরীক্ষার প্রস্তুতি: লাইভ ক্লাস, রেকর্ডেড লেকচার, পরীক্ষা আর খাতা দেখে মন্তব্য।",
};

// থিম: ডিফল্ট light; কেউ dark বেছে থাকলে প্রথম আঁকার আগেই বদলায় (ঝিলিক নয়)
const themeScript = `try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="bn" className={hind.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* আইকন ফন্ট (next/font এ variable আইকন ফন্ট নেই) */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&display=swap"
        />
      </head>
      <body className="flex min-h-screen flex-col overflow-x-hidden font-sans transition-colors duration-300">
        {/* JS বন্ধ থাকলে ভেসে ওঠার অপেক্ষায় লুকানো অংশও দেখা যাক */}
        <noscript><style>{`.reveal{opacity:1!important;transform:none!important}.kinetic-text>span{opacity:1!important;transform:none!important}`}</style></noscript>
        <div id="mouse-glow" aria-hidden="true" />
        <SiteHeader />
        {/* header এর নিচে জায়গা: header এর সমান (৬৪ / ৭২px) */}
        <div className="flex-1 pt-16 md:pt-[72px]">{children}</div>
        <SiteFooter />
        <MotionEffects />
        <BackToTop />
        {/* সাইন আপের পর ?welcome=BP-XXXX থাকলে স্বাগত বার্তা */}
        <Suspense fallback={null}>
          <WelcomeModal />
        </Suspense>
      </body>
    </html>
  );
}
