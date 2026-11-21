"use client";

import { useRouter } from "next/navigation";

// মাস বদলালে ওই মাসের হিসাব (?month=YYYY-MM)
export function MonthSelect({ value, options }: { value: string; options: { value: string; label: string }[] }) {
  const router = useRouter();
  return (
    <select id="ev-month" className="ex-field md:w-56!" value={value} onChange={(e) => router.push(`/evaluator/earn?month=${e.target.value}`)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
