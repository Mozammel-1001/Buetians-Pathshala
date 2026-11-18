"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// একসাথে একটাই ডিভাইস: পাতা খোলার সময়, ফিরে এলে আর প্রতি মিনিটে session_status() দেখে। অন্য ডিভাইসে
// লগইন হয়ে থাকলে পুরো পাতা ঢেকে লগআউট দেখায় (database তখন এখান থেকে কিছুই পড়তে বা লিখতে দেয় না)
export function SessionGuard() {
  const [replacedBy, setReplacedBy] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    const check = async () => {
      const { data, error } = await supabase.rpc("session_status");
      if (!alive || error) return;
      const row = (data as { active: boolean; device: string | null }[] | null)?.[0];
      if (row && !row.active) setReplacedBy(row.device ?? "");
    };
    void check();
    const timer = setInterval(check, 60_000);
    const onShow = () => { if (document.visibilityState === "visible") void check(); };
    window.addEventListener("focus", onShow);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", onShow);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);

  if (replacedBy === null) return null;
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="sg-title" className="fixed inset-0 z-[100] grid place-items-center bg-on-background/70 p-4 backdrop-blur-sm">
      <div className="card max-w-md p-7">
        <span className="icon text-4xl text-error">devices</span>
        <h2 id="sg-title" className="mt-2 text-xl font-bold">অন্য ডিভাইসে লগইন হয়েছে</h2>
        <p className="mt-2 text-sm muted">
          আপনার অ্যাকাউন্টে আরেকটা ডিভাইসে{replacedBy ? ` (${replacedBy})` : ""} লগইন হয়েছে। একসাথে একটাই ডিভাইসে লগইন থাকা যায়,
          তাই এখানে লগআউট হয়ে গেছে। কোনো পরীক্ষা চলছিল থাকলে শেষ সেভ পর্যন্ত উত্তর নিয়ে জমা হয়ে গেছে। এটা আপনি না হলে
          সাথে সাথে আমাদের জানান।
        </p>
        {/* route handler: cookie মুছে সাইন ইনে পাঠায় */}
        <a href="/auth/replaced" className="btn-primary mt-5">এখানে আবার লগইন করুন</a>
      </div>
    </div>
  );
}
