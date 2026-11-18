"use client";

import { useState } from "react";

// কপির বোতাম: চাপলে "কপি হয়েছে" দেখায়। পুরনো ব্রাউজারে clipboard না থাকলে লেখাটা বেছে দেয়
export function CopyButton({ text, label = "কপি", className = "", compact = false }: { text: string; label?: string; className?: string; compact?: boolean }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = document.createElement("textarea");
      t.value = text;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  };
  return (
    <button type="button" onClick={copy} aria-label={`${label}: ${text}`}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
        done ? "border-primary bg-primary text-on-primary" : "border-outline-variant/50 hover:border-primary hover:text-primary dark:hover:text-primary-fixed"
      } ${className}`}>
      <span className="icon text-[16px]">{done ? "check" : "content_copy"}</span>
      {compact ? (done ? "কপি হয়েছে" : "কপি") : done ? "কপি হয়েছে" : label}
    </button>
  );
}
