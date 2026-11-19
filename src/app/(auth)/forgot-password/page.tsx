import type { Metadata } from "next";
import { Suspense } from "react";
import { safeNext } from "@/lib/auth";
import { AuthShell } from "../auth-shell";

export const metadata: Metadata = { title: "পাসওয়ার্ড রিসেট" };

// পাসওয়ার্ড ভুলে গেলে: শুধু মোবাইল নম্বর → OTP → নতুন পাসওয়ার্ড
export default function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  return (
    <Suspense fallback={<div className="login-page-wrapper"><div className="login-container h-[560px] animate-pulse" /></div>}>
      <Shell searchParams={searchParams} />
    </Suspense>
  );
}

async function Shell({ searchParams }: { searchParams: PageProps<"/forgot-password">["searchParams"] }) {
  const sp = await searchParams;
  return <AuthShell initialView="forgot" next={safeNext(typeof sp.next === "string" ? sp.next : null)} />;
}
