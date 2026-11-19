"use client";

import { useEffect } from "react";

// ডেমোর (index.html) নড়াচড়া, পুরো সাইটে একবার:
//   .reveal   দৃশ্যে এলে ভেসে ওঠে (active), বাইরে গেলে আবার লুকায়, যাতে পরের বার আবার ওঠে
//   (পরিসংখ্যানের সংখ্যা গোনা components/counter.tsx এ: সংখ্যা React এর state, তাই এখানে DOM এর লেখায় হাত দেওয়া হয় না)
//   .tilt-card মাউসের দিকে হেলে পড়ে আর একটু বড় হয় (শুধু মাউসে, মোবাইলে চাপলে একটু দেবে যায়: CSS)
//   #mouse-glow মাউসের পেছনে হালকা আলো
// পরে আসা অংশও (অন্য পাতায় যাওয়া, ফিল্টার) নিজে ধরে (MutationObserver)
export function MotionEffects() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) {
          el.classList.add("active");
        } else {
          el.classList.remove("active");
        }
      }
    }, { threshold: 0.1 });

    const watch = (root: ParentNode) => root.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    watch(document);
    const mo = new MutationObserver((muts) => {
      for (const m of muts) m.addedNodes.forEach((n) => {
        if (!(n instanceof HTMLElement)) return;
        if (n.classList.contains("reveal")) io.observe(n);
        watch(n);
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // card হেলে পড়া (ডেমোর মতো ১০ ডিগ্রি পর্যন্ত, ১.১ গুণ বড়)
    let tilted: HTMLElement | null = null;
    const untilt = (el: HTMLElement | null) => {
      if (el) el.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
    };
    const onMove = (e: MouseEvent) => {
      const glow = document.getElementById("mouse-glow");
      if (glow && fine) {
        glow.style.setProperty("--x", e.clientX + "px");
        glow.style.setProperty("--y", e.clientY + "px");
      }
      const card = (e.target as Element | null)?.closest?.<HTMLElement>(".tilt-card") ?? null;
      if (tilted && tilted !== card) untilt(tilted);
      tilted = card;
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const cx = r.width / 2, cy = r.height / 2;
      const rx = ((y - cy) / cy) * -10, ry = ((x - cx) / cx) * 10;
      card.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1.1, 1.1, 1.1)`;
    };
    const onLeaveWindow = () => { untilt(tilted); tilted = null; };
    if (!reduce) {
      document.addEventListener("mousemove", onMove);
      document.documentElement.addEventListener("mouseleave", onLeaveWindow);
    }

    // মোবাইলে back এ ফিরে এলে (bfcache) চাপা অবস্থা থেকে যায়: ঠিক করা
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      document.querySelectorAll<HTMLElement>(".tilt-card").forEach((c) => {
        untilt(c);
        c.style.removeProperty("box-shadow");
        c.classList.remove("mobile-pressed");
      });
    };
    window.addEventListener("pageshow", onShow);

    return () => {
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeaveWindow);
      window.removeEventListener("pageshow", onShow);
    };
  }, []);

  return null;
}
