"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CLASS_LEVELS } from "@/lib/validation";
import type { SignupState, SignupValues } from "./actions";
import { CodeStep, bn } from "./otp-code";

const EMPTY: SignupValues = { full_name: "", phone: "", email: "", guardian_phone: "", institute: "", class_level: "" };

// সাইন আপ (আর Google এর পর সাইন আপ শেষ করা): সব তথ্য → মোবাইলে কোড → মিললে অ্যাকাউন্ট চালু, আইডিসহ স্বাগত বার্তা
export function SignupFlow({ send, verify, next, initial, lockedEmail, submitLabel = "কোড পাঠান", otp = true }: {
  send: (prev: SignupState, fd: FormData) => Promise<SignupState>;
  verify: (prev: SignupState, fd: FormData) => Promise<SignupState>;
  next: string;
  initial?: Partial<SignupValues>;
  lockedEmail?: string | null;   // Google: ইমেইল Google এর, বদলানো যায় না
  submitLabel?: string;
  otp?: boolean;   // false: SMS API পাওয়া পর্যন্ত কোড ছাড়া (জমা দিলেই অ্যাকাউন্ট চালু)
}) {
  const [state, action, pending] = useActionState(async (prev: SignupState, fd: FormData): Promise<SignupState> => {
    const intent = fd.get("intent");
    if (intent === "edit") return { step: "form", values: prev.values };
    return intent === "verify" ? verify(prev, fd) : send(prev, fd);
  }, { step: "form", values: { ...EMPTY, ...initial, ...(lockedEmail ? { email: lockedEmail } : {}) } });

  if (state.step === "code") {
    const v = state.values;
    return (
      <CodeStep
        action={action} pending={pending} sentAt={state.sentAt} error={state.error} fieldError={state.fieldErrors?.code} next={next}
        verifyLabel="যাচাই করে অ্যাকাউন্ট চালু করুন" editLabel="তথ্য বদলান"
        sentTo={<p><b>{bn("0" + (state.phone ?? "").slice(3))}</b> নম্বরে কোড পাঠানো হয়েছে। কোড মিললেই অ্যাকাউন্ট চালু হবে।</p>}
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-2xl border border-outline-variant/40 p-4 text-sm dark:border-outline-variant/20">
          {([["নাম", v.full_name], ["ইমেইল", v.email], ["অভিভাবক", v.guardian_phone], ["প্রতিষ্ঠান", v.institute], ["শ্রেণি", v.class_level]] as const).map(([k, val]) => (
            <div key={k} className="contents"><dt className="muted">{k}</dt><dd className="truncate font-bold">{val}</dd></div>
          ))}
        </dl>
      </CodeStep>
    );
  }

  const fe = state.fieldErrors ?? {};
  const v = state.values;
  const field = (name: keyof SignupValues, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, extra?: React.ReactNode) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      {extra ?? (
        <input id={name} name={name} defaultValue={v[name]} aria-invalid={fe[name] ? true : undefined}
          aria-describedby={fe[name] ? `${name}-err` : undefined} className="field" {...props} />
      )}
      {fe[name] && (
        <p id={`${name}-err`} className="mt-1 text-xs font-bold text-error dark:text-red-300">
          {fe[name]}
          {name === "phone" && state.exists && <> · <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="underline">লগইন করুন</Link></>}
        </p>
      )}
    </div>
  );

  return (
    // key: সার্ভার থেকে ফেরা মান দিয়ে ঘরগুলো নতুন করে (ভুল থাকলে লেখা থেকে যায়)
    <form key={JSON.stringify(v)} action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {field("full_name", "পুরো নাম", { autoComplete: "name", placeholder: "যেমন: রাফি আহমেদ", autoFocus: !v.full_name })}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("phone", "মোবাইল নম্বর", { type: "tel", inputMode: "tel", autoComplete: "tel-national", placeholder: "০১XXXXXXXXX" })}
        {field("guardian_phone", "অভিভাবকের মোবাইল নম্বর", { type: "tel", inputMode: "tel", placeholder: "০১XXXXXXXXX" })}
      </div>
      {field("email", "ইমেইল", lockedEmail
        ? { type: "email", readOnly: true, className: "field opacity-70", title: "Google অ্যাকাউন্টের ইমেইল" }
        : { type: "email", inputMode: "email", autoComplete: "email", placeholder: "you@example.com" })}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("institute", "শিক্ষাপ্রতিষ্ঠান", { autoComplete: "organization", placeholder: "স্কুল / কলেজের নাম" })}
        {field("class_level", "শ্রেণি", {}, (
          <select id="class_level" name="class_level" defaultValue={v.class_level} aria-invalid={fe.class_level ? true : undefined} className="field">
            <option value="" disabled>বেছে নিন</option>
            {CLASS_LEVELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        ))}
      </div>
      {state.error && !Object.keys(fe).length && <p className="text-sm font-bold text-error dark:text-red-300" role="alert">{state.error}</p>}
      <button type="submit" name="intent" value="send" disabled={pending} className="btn-primary w-full py-3!">
        {pending ? (otp ? "পাঠানো হচ্ছে…" : "চালু হচ্ছে…") : submitLabel}
      </button>
      <p className="text-center text-xs muted">{otp ? "মোবাইল নম্বরে একটা কোড যাবে। কোড মিললে অ্যাকাউন্ট চালু হবে আর আপনার আইডি দেখাবে।" : "জমা দিলেই অ্যাকাউন্ট চালু হবে আর আপনার আইডি দেখাবে।"}</p>
    </form>
  );
}
