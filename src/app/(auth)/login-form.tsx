"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { LoginState } from "./actions";
import { CodeStep, bn } from "./otp-code";

// লগইন: আইডি বা মোবাইল নম্বর → SMS এর কোড
export function LoginForm({ send, verify, next }: {
  send: (prev: LoginState, fd: FormData) => Promise<LoginState>;
  verify: (prev: LoginState, fd: FormData) => Promise<LoginState>;
  next: string;
}) {
  const [state, action, pending] = useActionState(async (prev: LoginState, fd: FormData): Promise<LoginState> => {
    const intent = fd.get("intent");
    if (intent === "edit") return { step: "id", identifier: prev.viaId ? prev.identifier : prev.display };
    return intent === "verify" ? verify(prev, fd) : send(prev, fd);
  }, { step: "id" });

  if (state.step === "code") {
    return (
      <CodeStep
        action={action} pending={pending} sentAt={state.sentAt} error={state.error} fieldError={state.fieldError} next={next}
        verifyLabel="লগইন করুন" editLabel="আইডি / নম্বর বদলান"
        sentTo={
          state.viaId ? (
            <p><b>{state.identifier}</b> আইডির মোবাইল নম্বরে (<b dir="ltr">{bn(state.display ?? "")}</b>) কোড পাঠানো হয়েছে।</p>
          ) : (
            <p><b>{bn(state.display ?? "")}</b> নম্বরে কোড পাঠানো হয়েছে।</p>
          )
        }
      />
    );
  }

  const err = state.fieldError;
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="identifier">আইডি বা মোবাইল নম্বর</label>
        <div className="relative">
          <span className="icon pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[20px] muted">badge</span>
          <input
            id="identifier" name="identifier" type="text" inputMode="text" autoComplete="username" autoCapitalize="characters"
            placeholder="BP-1001 বা ০১XXXXXXXXX" defaultValue={state.identifier ?? ""} autoFocus
            aria-invalid={err ? true : undefined} aria-describedby={err ? "identifier-err" : "identifier-hint"}
            className="field pl-10! text-base tracking-wide"
          />
        </div>
        {err ? (
          <p id="identifier-err" className="mt-1 text-xs font-bold text-error dark:text-red-300">
            {err}
            {state.noAccount && <> · <Link href={`/sign-up?next=${encodeURIComponent(next)}`} className="underline">সাইন আপ করুন</Link></>}
          </p>
        ) : (
          <p id="identifier-hint" className="mt-1 text-xs muted">সাইন আপের সময় পাওয়া আইডি, নয়তো অ্যাকাউন্টের মোবাইল নম্বর। কোড যাবে সেই নম্বরে।</p>
        )}
      </div>
      {state.error && <p className="text-sm font-bold text-error dark:text-red-300" role="alert">{state.error}</p>}
      <button type="submit" name="intent" value="send" disabled={pending} className="btn-primary w-full py-3!">
        {pending ? "পাঠানো হচ্ছে…" : "কোড পাঠান"}
      </button>
    </form>
  );
}
