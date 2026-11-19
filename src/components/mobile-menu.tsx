"use client";

import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "./nav-link";

// মোবাইলের মেনু (ডেমোর মতো): বোতামে ☰ ঘুরে ✕ হয়, মেনু নেমে আসে, আইটেমগুলো একে একে (৭৫ms পরপর) ভেসে ওঠে।
// স্ক্রল করলে বা কোনো লিংকে চাপলে বন্ধ। যে পাতায় আছেন সেটা সবুজ
export function MobileMenu({ links, action }: { links: { href: string; label: string }[]; action: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { passive: true });
    return () => window.removeEventListener("scroll", close);
  }, [open]);

  const icon = "icon absolute transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]";
  const item = (i: number) => ({
    className: `transition-all duration-300 ${open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`,
    style: { transitionDelay: open ? `${100 + i * 75}ms` : "0ms" },
  });

  return (
    <>
      <button
        type="button" aria-label={open ? "মেনু বন্ধ করুন" : "মেনু খুলুন"} aria-expanded={open} aria-controls="mobile-menu"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 w-10 items-center justify-center rounded-md text-on-surface-variant transition-colors duration-300 active:bg-surface-container-low md:hidden dark:text-surface-variant dark:active:bg-inverse-surface"
      >
        <span className={`${icon} ${open ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"}`}>menu</span>
        <span className={`${icon} ${open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"}`}>close</span>
      </button>

      <div
        id="mobile-menu"
        className={`absolute top-full left-0 z-40 flex w-full flex-col gap-6 border-b border-outline-variant/40 bg-surface-container px-4 py-6 shadow-xl transition-all duration-300 md:hidden dark:bg-on-background ${
          open ? "visible pointer-events-auto translate-y-0 opacity-100" : "invisible pointer-events-none -translate-y-4 opacity-0"
        }`}
      >
        {links.map((l, i) => (
          <NavLink key={l.href} href={l.href} onClick={() => setOpen(false)} style={item(i).style}
            className={`${item(i).className} text-lg font-bold`}
            idleClassName="text-on-surface-variant dark:text-surface-variant"
            activeClassName="text-primary dark:text-primary-fixed">
            {l.label}
          </NavLink>
        ))}
        <div {...item(links.length)} onClick={() => setOpen(false)} className={`${item(links.length).className} w-full`}>{action}</div>
      </div>
    </>
  );
}
