"use client";

import { useEffect, useRef, useState } from "react";
import { bn } from "@/lib/content-schema";

// সংখ্যা ০ থেকে বাড়তে বাড়তে target এ পৌঁছায় (১.২ সেকেন্ড), হুবহু admin_dashboard.html এর animateCounts।
// শুরুতে (server এর HTML এ) আসল সংখ্যাই থাকে, তাই JS ছাড়াও ঠিক দেখায়
export function CountUp({ target, prefix = "" }: { target: number; prefix?: string }) {
  const [value, setValue] = useState(target);
  const done = useRef(false);
  useEffect(() => {
    if (done.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    done.current = true;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 1200);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return <>{prefix}{bn(Math.round(value).toLocaleString("en-IN"))}</>;
}
