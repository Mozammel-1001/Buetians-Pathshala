"use client";

import { useEffect, useState } from "react";

// ডান নিচের কোণে ভাসমান "উপরে যান" বোতাম: একটু নিচে নামলে (৩০০px) ভেসে ওঠে, চাপলে মসৃণভাবে পাতার শুরুতে।
// মাউস নিলে উঠে আসে, বড় হয়, সবুজ আভা ছড়ায় আর তীরটা একটু উপরে সরে।
// পাতা খোলার সময় লুকানো (server আর browser এর শুরুর অবস্থা এক, তাই hydration এ গোলমাল নেই)
export function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 300);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toTop = (e: React.MouseEvent<HTMLButtonElement>) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    e.currentTarget.blur();
  };

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="পাতার শুরুতে যান"
      title="উপরে যান"
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      className={`group fixed right-4 bottom-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg shadow-primary/30 transition-all duration-300 md:right-8 md:bottom-8 md:h-12 md:w-12 ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      } hover:-translate-y-1.5 hover:scale-110 hover:bg-primary-container hover:text-on-primary-container hover:shadow-[0_10px_28px_-4px_rgba(16,185,129,0.65)] active:scale-95 dark:bg-primary-fixed dark:text-on-primary-fixed dark:shadow-primary-fixed/20 dark:hover:bg-primary-fixed-dim dark:hover:shadow-[0_10px_28px_-4px_rgba(111,251,190,0.45)]`}
    >
      <span className="icon text-[26px] transition-transform duration-300 group-hover:-translate-y-0.5">arrow_upward</span>
    </button>
  );
}
