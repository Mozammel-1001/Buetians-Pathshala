import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { safeNext } from "@/lib/auth";
import { LoginForm } from "../login-form";
import { GoogleButton } from "../google-button";
import { sendLoginOtp, verifyLoginOtp } from "../actions";

export const metadata: Metadata = { title: "লগইন" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="card p-7 md:p-9">
        <h1 className="text-2xl font-bold">লগইন</h1>
        <p className="mt-1 mb-6 text-sm muted">আইডি বা মোবাইল নম্বর দিন, অ্যাকাউন্টের নম্বরে SMS এ কোড যাবে।</p>
        <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-surface-container-low dark:bg-white/5" />}>
          <SignIn searchParams={searchParams} />
        </Suspense>
        <p className="mt-6 text-center text-xs muted">একসাথে একটাই ডিভাইসে লগইন থাকা যায়। এখানে লগইন করলে অন্য ডিভাইস থেকে লগআউট হবে।</p>
      </div>
    </main>
  );
}

async function SignIn({ searchParams }: { searchParams: PageProps<"/sign-in">["searchParams"] }) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  return (
    <>
      {sp.replaced && (
        <p className="mb-4 rounded-xl border border-amber-300/50 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          আপনার অ্যাকাউন্টে অন্য ডিভাইসে লগইন হওয়ায় এখানে লগআউট হয়েছিল। আবার লগইন করলে সেই ডিভাইস থেকে লগআউট হবে।
        </p>
      )}
      {sp.error === "google" && (
        <p className="mb-4 rounded-xl border border-error/30 bg-error-container/40 p-3 text-sm text-on-error-container dark:text-red-200" role="alert">
          Google দিয়ে লগইন হয়নি। আবার চেষ্টা করুন, নয়তো আইডি বা মোবাইল নম্বর দিয়ে লগইন করুন।
        </p>
      )}
      <LoginForm send={sendLoginOtp} verify={verifyLoginOtp} next={next} />
      <GoogleButton next={next} label="Google দিয়ে লগইন" />
      <p className="mt-6 text-center text-sm muted">
        অ্যাকাউন্ট নেই? <Link href={`/sign-up${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-bold text-primary dark:text-primary-fixed">সাইন আপ করুন</Link>
      </p>
    </>
  );
}
