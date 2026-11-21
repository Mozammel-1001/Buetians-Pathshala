"use client";

import type { ReactNode } from "react";
import { useToast } from "../admin/_components/kit";

// এখনো যুক্ত না হওয়া বোতাম (লাইভ ক্লাসে যোগ, শেখা চালিয়ে যান ইত্যাদি): চাপলে "শীঘ্রই আসছে" বার্তা
export function SoonButton({ className, children, text = "এই অংশটি শীঘ্রই আসছে", disabled }: { className: string; children: ReactNode; text?: string; disabled?: boolean }) {
  const [toast, node] = useToast();
  return (
    <>
      {node}
      <button type="button" disabled={disabled} onClick={() => toast(text, "info")} className={className}>{children}</button>
    </>
  );
}
