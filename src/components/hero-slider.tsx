"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// hero এর ছবি, হুবহু ডেমোর মতো: ভাসতে থাকা ফ্রেম, পেছনে সবুজ আভা, ৩ সেকেন্ড পরপর ছবি সরে যায়
// (আগে-পরে বোতাম আর বিন্দু দিয়েও), কোণে ছোট কার্ড
export function HeroSlider({ images, kicker, title }: { images: string[]; kicker: string; title: string }) {
  const [i, setI] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const n = images.length;

  const restart = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    if (n > 1) timer.current = setInterval(() => setI((x) => (x + 1) % n), 3000);
  }, [n]);
  useEffect(() => {
    restart();
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [restart]);
  const go = (to: number) => { setI(((to % n) + n) % n); restart(); };

  return (
    <>
      <div className="absolute z-0 h-[300px] w-[300px] animate-pulse rounded-full bg-primary/20 blur-[80px] md:h-[400px] md:w-[400px]" />
      <div className="relative z-10 mx-auto w-full max-w-[500px] animate-float rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-3 shadow-2xl transition-colors duration-300 md:max-w-[600px] md:p-4 dark:border-outline-variant/10 dark:bg-inverse-surface">
        <div className="relative h-[450px] w-full overflow-hidden rounded-2xl md:h-[600px]">
          <div className="flex h-full w-full" style={{ transform: `translateX(-${i * 100}%)`, transition: "transform 1.5s cubic-bezier(0.25, 1, 0.5, 1)" }}>
            {images.map((src, k) => (
              // eslint-disable-next-line @next/next/no-img-element -- ছবিগুলো আগেই ছোট করা (আপলোডের সময়), slider এ সাধারণ img ই দ্রুত
              <img key={src + k} src={src} alt="" className="h-full w-full shrink-0 object-cover" loading={k === 0 ? "eager" : "lazy"} fetchPriority={k === 0 ? "high" : "auto"} />
            ))}
          </div>
        </div>

        {(kicker || title) && (
          <div className="absolute -top-2 -left-2 z-20 flex max-w-[90%] animate-pulse-glow items-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-3 shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-colors duration-300 md:top-8 md:-left-6 md:max-w-none md:gap-3 dark:border-outline-variant/10 dark:bg-inverse-surface">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container shadow-[0_0_15px_rgba(16,185,129,0.4)] md:h-10 md:w-10">
              <span className="icon text-sm md:text-base">school</span>
            </div>
            <div>
              <div className="text-[9px] font-bold tracking-wider text-on-surface-variant uppercase md:text-[10px] dark:text-surface-variant">{kicker}</div>
              <div className="text-xs font-bold whitespace-nowrap text-on-surface md:text-sm dark:text-background">{title}</div>
            </div>
          </div>
        )}

        {n > 1 && (
          <div className="absolute right-6 -bottom-6 z-20 flex items-center gap-4 rounded-full border border-outline-variant/20 bg-surface-container-lowest px-5 py-3 shadow-xl dark:border-outline-variant/10 dark:bg-inverse-surface">
            <button type="button" aria-label="আগের ছবি" onClick={() => go(i - 1)} className="flex items-center text-on-surface-variant transition-colors hover:text-primary dark:text-surface-variant dark:hover:text-primary-fixed">
              <span className="icon text-sm font-bold">arrow_back_ios</span>
            </button>
            <div className="flex items-center gap-2">
              {images.map((_, k) => (
                <button key={k} type="button" aria-label={`ছবি ${k + 1}`} aria-current={k === i} onClick={() => go(k)}
                  className={`h-1.5 cursor-pointer rounded-full transition-all ${k === i ? "w-6 bg-primary dark:bg-primary-fixed" : "w-1.5 bg-outline-variant dark:bg-outline-variant/50"}`} />
              ))}
            </div>
            <button type="button" aria-label="পরের ছবি" onClick={() => go(i + 1)} className="flex items-center text-on-surface-variant transition-colors hover:text-primary dark:text-surface-variant dark:hover:text-primary-fixed">
              <span className="icon text-sm font-bold">arrow_forward_ios</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
