import type { Metadata } from "next";
import { Suspense } from "react";
import { safeNext } from "@/lib/auth";
import { AuthShell } from "../auth-shell";

export const metadata: Metadata = { title: "সাইন আপ" };

// সাইন আপ: তিন ধাপ (তথ্য → অভিভাবক ও প্রতিষ্ঠান → মোবাইলের OTP)
export default function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  return (
    <Suspense fallback={<div className="login-page-wrapper"><div className="login-container h-[560px] animate-pulse" /></div>}>
      <Shell searchParams={searchParams} />
    </Suspense>
  );
}

async function Shell({ searchParams }: { searchParams: PageProps<"/sign-up">["searchParams"] }) {
  const sp = await searchParams;
  return <AuthShell initialView="signup" next={safeNext(typeof sp.next === "string" ? sp.next : null)} />;
}
