import type { Metadata } from "next";
import { Suspense } from "react";
import { safeNext } from "@/lib/auth";
import { AuthShell } from "../auth-shell";

export const metadata: Metadata = { title: "লগইন" };

// লগইন: আইডি বা মোবাইল + পাসওয়ার্ড (এই একই পাতায় সাইন আপ আর পাসওয়ার্ড রিসেটের ফর্মও আছে)
export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <Suspense fallback={<div className="login-page-wrapper"><div className="login-container h-[560px] animate-pulse" /></div>}>
      <Shell searchParams={searchParams} />
    </Suspense>
  );
}

async function Shell({ searchParams }: { searchParams: PageProps<"/sign-in">["searchParams"] }) {
  const sp = await searchParams;
  return <AuthShell initialView="login" next={safeNext(typeof sp.next === "string" ? sp.next : null)} replaced={!!sp.replaced} googleError={sp.error === "google"} />;
}
