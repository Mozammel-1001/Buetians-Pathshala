import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { safeNext } from "@/lib/auth";
import { SignupFlow } from "../signup-flow";
import { GoogleButton } from "../google-button";
import { sendSignupOtp, verifySignupOtp } from "../actions";

export const metadata: Metadata = { title: "সাইন আপ" };

export default function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="card p-7 md:p-9">
        <h1 className="text-2xl font-bold">নতুন অ্যাকাউন্ট</h1>
        <p className="mt-1 mb-6 text-sm muted">তথ্যগুলো দিন। মোবাইল নম্বরে কোড মিললে অ্যাকাউন্ট চালু হবে আর আপনার আইডি পাবেন।</p>
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-surface-container-low dark:bg-white/5" />}>
          <SignUp searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function SignUp({ searchParams }: { searchParams: PageProps<"/sign-up">["searchParams"] }) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  return (
    <>
      <SignupFlow send={sendSignupOtp} verify={verifySignupOtp} next={next} />
      <GoogleButton next={next} label="Google দিয়ে সাইন আপ" />
      <p className="mt-6 text-center text-sm muted">
        আগেই অ্যাকাউন্ট আছে? <Link href={`/sign-in${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-bold text-primary dark:text-primary-fixed">লগইন করুন</Link>
      </p>
    </>
  );
}
