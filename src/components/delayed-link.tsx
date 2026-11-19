"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

// ডেমোর navigateWithDelay: কার্ডে চাপলে আগে একটু দেবে যায় (চাপা ছায়া), ৩৫০ms পরে পাতায় যায়।
// Ctrl/নতুন ট্যাবে খোলা আগের মতোই চলে
export function DelayedLink({ href, className, children, style }: { href: string; className?: string; children: ReactNode; style?: React.CSSProperties }) {
  const router = useRouter();
  return (
    <a
      href={href} className={className} style={style}
      onMouseEnter={() => router.prefetch(href)}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        const card = e.currentTarget.querySelector<HTMLElement>(".tilt-card");
        if (card) {
          card.classList.add("mobile-pressed");
          card.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
        }
        setTimeout(() => router.push(href), 350);
      }}
    >
      {children}
    </a>
  );
}
