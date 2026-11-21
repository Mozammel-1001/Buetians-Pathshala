import type { Metadata } from "next";
import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { SessionGuard } from "@/components/session-guard";
import { PracticeApp } from "./practice-app";

export const metadata: Metadata = { title: "পরীক্ষা" };

// শিক্ষার্থীর পরীক্ষার পাতা (practice.html): লগইন লাগে। এখন নমুনা তথ্য; আসল rpc জোড়া পরে
export default function PracticePage() {
  return (
    <main className="mx-auto w-full max-w-[1280px] grow px-4 pt-2.5 pb-16 md:px-8 md:pt-5 md:pb-32">
      <Suspense fallback={<div className="mt-6 h-72 animate-pulse rounded-3xl bg-surface-container dark:bg-white/5" />}>
        <Practice />
      </Suspense>
    </main>
  );
}

async function Practice() {
  const me = await requireProfile("/practice");
  return (
    <>
      <SessionGuard />
      <PracticeApp me={me.full_name} />
    </>
  );
}
