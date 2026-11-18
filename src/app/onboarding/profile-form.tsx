"use client";

import { useActionState } from "react";
import { CLASS_LEVELS } from "@/lib/validation";
import { saveProfile } from "../(auth)/actions";

type Values = { full_name: string; institute: string; guardian_phone: string; class_level: string };

// পুরনো বা হাতে বানানো অ্যাকাউন্টে নাম ইত্যাদি বাকি থাকলে: ভুল হলে ঘরের নিচে লাল লেখা, লেখা থেকে যায়
export function ProfileForm({ next, values }: { next: string; values: Values }) {
  const [state, action, pending] = useActionState(saveProfile, undefined);
  const v = { ...values, ...state?.values } as Values;
  const fe = state?.fieldErrors ?? {};
  const input = (name: keyof Values, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} defaultValue={v[name]} aria-invalid={fe[name] ? true : undefined} className="field" {...props} />
      {fe[name] && <p className="mt-1 text-xs font-bold text-error dark:text-red-300">{fe[name]}</p>}
    </div>
  );
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {input("full_name", "পুরো নাম", { autoComplete: "name", autoFocus: true })}
      {input("institute", "শিক্ষাপ্রতিষ্ঠান", { autoComplete: "organization" })}
      {input("guardian_phone", "অভিভাবকের মোবাইল নম্বর", { type: "tel", inputMode: "tel", placeholder: "০১XXXXXXXXX" })}
      <div>
        <label className="label" htmlFor="class_level">শ্রেণি</label>
        <select id="class_level" name="class_level" defaultValue={v.class_level} className="field">
          <option value="">বেছে নিন</option>
          {CLASS_LEVELS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {fe.class_level && <p className="mt-1 text-xs font-bold text-error dark:text-red-300">{fe.class_level}</p>}
      </div>
      {state?.error && <p className="text-sm font-bold text-error dark:text-red-300" role="alert">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full py-3!">{pending ? "সেভ হচ্ছে…" : "শুরু করুন"}</button>
    </form>
  );
}
