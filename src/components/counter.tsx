"use client";

import { useEffect, useRef, useState } from "react";

// পরিসংখ্যানের সংখ্যা: দৃশ্যে এলে ০ থেকে target পর্যন্ত গোনে (২ সেকেন্ড), দৃশ্যের বাইরে গেলে আবার ০ (ডেমোর মতো)।
// সংখ্যাটা React এর নিজের state: আগে বাইরে থেকে DOM এর লেখা বদলানো হতো, তাতে পাতা hydrate হওয়ার আগে বদলালে
// React ভুল ধরত (hydration error #418) আর server এর HTML ফেলে নতুন করে আঁকত
export function Counter({ target }: { target: string }) {
  const end = Number(target) || 0;
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const stop = () => cancelAnimationFrame(raf);
    const io = new IntersectionObserver(([e]) => {
      stop();
      if (!e.isIntersecting) { setValue(0); return; }
      if (reduce) { setValue(end); return; }
      const step = end / (2000 / 16);
      let cur = 0;
      const tick = () => {
        cur += step;
        if (cur < end) { setValue(Math.ceil(cur)); raf = requestAnimationFrame(tick); }
        else setValue(end);
      };
      tick();
    }, { threshold: 0.1 });
    io.observe(el);
    return () => { io.disconnect(); stop(); };
  }, [end]);

  return <span ref={ref}>{value}</span>;
}
