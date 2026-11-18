"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const RESEND_WAIT_S = 60; // Supabase একই নম্বরে ৬০ সেকেন্ডের আগে আবার পাঠায় না
export const bn = (v: string | number) => String(v).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

type OtpCredential = Credential & { code: string };

// SMS এর কোড লেখার ধাপ (লগইন আর সাইন আপ দুটোতেই): কোড, যাচাই, আবার পাঠান (৬০ সেকেন্ড পরে), তথ্য/নম্বর বদলান।
// Android এর Chrome এ SMS এলে কোড নিজে বসে জমা হয় (WebOTP), iPhone এ কিবোর্ডের উপরে আসে (one-time-code)
export function CodeStep({ action, pending, sentTo, sentAt, error, fieldError, next, verifyLabel, editLabel, children }: {
  action: (fd: FormData) => void;
  pending: boolean;
  sentTo: ReactNode;
  sentAt?: number;
  error?: string;
  fieldError?: string;
  next: string;
  verifyLabel: string;
  editLabel: string;
  children?: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const wait = sentAt ? Math.max(0, RESEND_WAIT_S - Math.floor((now - sentAt) / 1000)) : 0;

  useEffect(() => {
    if (!sentAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sentAt]);

  useEffect(() => {
    if (!("OTPCredential" in window)) return;
    const ac = new AbortController();
    navigator.credentials
      .get({ otp: { transport: ["sms"] }, signal: ac.signal } as CredentialRequestOptions)
      .then((cred) => {
        const code = (cred as OtpCredential | null)?.code;
        if (!code || !codeRef.current || !formRef.current) return;
        codeRef.current.value = code;
        formRef.current.requestSubmit(formRef.current.querySelector<HTMLButtonElement>('button[value="verify"]'));
      })
      .catch(() => {});
    return () => ac.abort();
  }, [sentAt]);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl bg-primary/5 p-4 text-sm">
        <span className="icon text-primary dark:text-primary-fixed">sms</span>
        <div className="flex-1">
          {sentTo}
          {/* আলাদা ফর্ম: কোডের ঘরে Enter চাপলে যেন এটা না হয়ে যাচাই হয় */}
          <form action={action} className="mt-1">
            <button type="submit" name="intent" value="edit" className="font-bold text-primary underline-offset-2 hover:underline dark:text-primary-fixed">{editLabel}</button>
          </form>
        </div>
      </div>
      {children}
      <form ref={formRef} action={action} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="resend" value="1" />
        <div>
          <label className="label" htmlFor="code">SMS এ আসা ৬ অঙ্কের কোড</label>
          <input
            ref={codeRef} id="code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            placeholder="••••••" autoFocus
            aria-invalid={fieldError ? true : undefined} aria-describedby={fieldError ? "code-err" : undefined}
            className="field text-center text-2xl tracking-[0.5em]"
          />
          {fieldError && <p id="code-err" className="mt-1 text-xs font-bold text-error dark:text-red-300">{fieldError}</p>}
        </div>
        {error && <p className="text-sm font-bold text-error dark:text-red-300" role="alert">{error}</p>}
        <button type="submit" name="intent" value="verify" disabled={pending} className="btn-primary w-full py-3!">
          {pending ? "যাচাই হচ্ছে…" : verifyLabel}
        </button>
        <p className="text-center text-sm muted">
          কোড আসেনি?{" "}
          {wait > 0 ? (
            <span>{bn(wait)} সেকেন্ড পরে আবার চাইতে পারবেন</span>
          ) : (
            <button type="submit" name="intent" value="send" disabled={pending} className="font-bold text-primary hover:underline dark:text-primary-fixed">আবার পাঠান</button>
          )}
        </p>
      </form>
    </div>
  );
}
