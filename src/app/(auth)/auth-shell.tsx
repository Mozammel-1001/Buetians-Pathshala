"use client";

import { startTransition, useEffect, useState, useTransition, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CLASS_LEVELS, cleanOtp, isEmail, normalizeBdPhone, normalizeUserCode, PASSWORD_MIN } from "@/lib/validation";
import {
  completeSignup, passwordLogin, resendSignupOtp, sendResetOtp, setNewPassword, signInWithGoogle, startSignup, verifyResetOtp,
  type AuthResult, type SignupInput,
} from "./actions";
import { GoogleLogo } from "./google-button";
import { bn } from "./otp-code";

// লগইন, পাসওয়ার্ড রিসেট আর সাইন আপ: ডেমোর (sign_in.html) মতো এক পাতায় তিনটা ফর্ম, বাঁয়ে সবুজ স্বাগত অংশ (লোগোসহ),
// ডানে ফর্ম; লিংকে চাপলে পাতা না বদলে ফর্ম বদলায় (ঠিকানাটা শুধু বদলে যায়)।
//   লগইন: আইডি বা মোবাইল + পাসওয়ার্ড
//   রিসেট: মোবাইল → OTP → নতুন পাসওয়ার্ড (৩ ধাপ)
//   সাইন আপ: নাম/ইমেইল/মোবাইল/পাসওয়ার্ড → অভিভাবক/প্রতিষ্ঠান/শ্রেণি (পরবর্তী চাপলে OTP যায়) → OTP (৩ মিনিটের ঘড়ি, ২ বার আবার)
export type AuthView = "login" | "forgot" | "signup";

const PATH: Record<AuthView, string> = { login: "/sign-in", forgot: "/forgot-password", signup: "/sign-up" };
const RESEND_SECONDS = 180;   // OTP আবার চাওয়ার আগে অপেক্ষা (Supabase এর OTP Expiry ও ১৮০ সেকেন্ড রাখুন)
const RESEND_MAX = 2;         // সর্বোচ্চ ২ বার আবার

// ---------- ছোট অংশ ----------
function Group({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className={`input-group${error ? " has-error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      <p className="error-text" id={`${id}-err`} role={error ? "alert" : undefined}>{error}</p>
    </div>
  );
}

const EYE = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
const EYE_OFF = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

function PasswordGroup({ id, label, value, onChange, error, placeholder, autoComplete }: {
  id: string; label: string; value: string; onChange: (v: string) => void; error?: string; placeholder: string; autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <Group id={id} label={label} error={error}>
      <div className="password-wrapper">
        <input id={id} type={show ? "text" : "password"} value={value} placeholder={placeholder} autoComplete={autoComplete}
          aria-invalid={error ? true : undefined} aria-describedby={`${id}-err`} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="eye-btn" aria-label={show ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"} onClick={() => setShow((s) => !s)}>
          {show ? EYE_OFF : EYE}
        </button>
      </div>
    </Group>
  );
}

function TextGroup({ id, label, value, onChange, error, ...rest }: {
  id: string; label: string; value: string; onChange: (v: string) => void; error?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "id">) {
  return (
    <Group id={id} label={label} error={error}>
      <input id={id} value={value} aria-invalid={error ? true : undefined} aria-describedby={`${id}-err`} onChange={(e) => onChange(e.target.value)} {...rest} />
    </Group>
  );
}

function Steps({ text, percent }: { text: string; percent: number }) {
  return (
    <div className="step-indicator">
      <span>{text}</span>
      <div className="progress-bar"><div className="progress-fill" style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

function GoogleForm({ next, label }: { next: string; label: string }) {
  return (
    <>
      <div className="divider"><span>অথবা</span></div>
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button type="submit" className="btn-social"><GoogleLogo />{label}</button>
      </form>
    </>
  );
}

// ৩ মিনিটের ঘড়ি: start() ডাকলে ৩ মিনিট গোনা শুরু (শেষ হওয়ার সময় আর "এখন" একসাথে বসে, তাই প্রথম মুহূর্তেও ঠিক সময় দেখায়)
function useCountdown(seconds: number) {
  const [t, setT] = useState<{ deadline: number; now: number } | null>(null);
  const deadline = t?.deadline ?? null;
  useEffect(() => {
    if (deadline === null) return;
    const id = setInterval(() => setT((x) => (x ? { ...x, now: Date.now() } : x)), 250);
    return () => clearInterval(id);
  }, [deadline]);
  const start = () => { const n = Date.now(); setT({ deadline: n + seconds * 1000, now: n }); };
  return { remaining: t ? Math.max(0, Math.ceil((t.deadline - t.now) / 1000)) : 0, start };
}
const clock = (s: number) => `${bn(String(Math.floor(s / 60)).padStart(2, "0"))}:${bn(String(s % 60).padStart(2, "0"))}`;

// ---------- লগইন ----------
function LoginView({ next, go, notice }: { next: string; go: (v: AuthView) => void; notice: ReactNode }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, start] = useTransition();
  const clear = (k: string) => setErrors((e) => (e[k] ? { ...e, [k]: "" } : e));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!id.trim()) err.identifier = "আইডি বা মোবাইল নম্বর আবশ্যক।";
    else if (!normalizeUserCode(id) && !normalizeBdPhone(id)) err.identifier = "অনুগ্রহ করে একটি সঠিক আইডি বা মোবাইল নম্বর দিন।";
    if (!pw) err.password = "পাসওয়ার্ড আবশ্যক।";
    setErrors(err);
    setFormError("");
    if (Object.keys(err).length) return;
    start(async () => {
      const r = await passwordLogin({ identifier: id, password: pw, remember, next });
      if (r?.fieldErrors) setErrors(r.fieldErrors);
      if (r?.error) setFormError(r.error);
    });
  };

  return (
    <div className="login-form-box" id="loginFormContainer">
      <h2>লগইন করুন</h2>
      <p className="subtitle">চালিয়ে যেতে অনুগ্রহ করে আপনার তথ্য দিন।</p>
      {notice}
      {formError && <p className="form-alert error" role="alert">{formError}</p>}
      <form onSubmit={submit} noValidate>
        <TextGroup id="identifier" label="আইডি বা মোবাইল নম্বর" value={id} error={errors.identifier} placeholder="আপনার আইডি (BP-1001) বা মোবাইল নম্বর দিন"
          autoComplete="username" autoCapitalize="characters" spellCheck={false} onChange={(v) => { setId(v); clear("identifier"); }} />
        <PasswordGroup id="password" label="পাসওয়ার্ড" value={pw} error={errors.password} placeholder="আপনার পাসওয়ার্ড দিন" autoComplete="current-password"
          onChange={(v) => { setPw(v); clear("password"); }} />
        <div className="login-actions">
          <label className="remember-me">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>আমাকে মনে রাখুন</span>
          </label>
          <button type="button" className="forgot-password" onClick={() => go("forgot")}>পাসওয়ার্ড ভুলে গেছেন?</button>
        </div>
        <button type="submit" className="login-submit-btn" disabled={pending}>{pending ? "লগইন হচ্ছে…" : "লগইন করুন"}</button>
      </form>
      <GoogleForm next={next} label="গুগল দিয়ে চালিয়ে যান" />
      <p className="signup-link">কোনো অ্যাকাউন্ট নেই? <button type="button" onClick={() => go("signup")}>সাইন আপ করুন</button></p>
    </div>
  );
}

// ---------- পাসওয়ার্ড রিসেট: শুধু মোবাইল নম্বর ----------
function ForgotView({ next, go }: { next: string; go: (v: AuthView) => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, start] = useTransition();
  const clear = (k: string) => setErrors((e) => (e[k] ? { ...e, [k]: "" } : e));
  const percent = step === 1 ? 33.33 : step === 2 ? 66.66 : 100;
  const subtitle = step === 1 ? "OTP পেতে আপনার মোবাইল নম্বর দিন।" : step === 2 ? "আমরা আপনার মোবাইলে একটি ভেরিফিকেশন কোড পাঠিয়েছি।" : "একটি সুরক্ষিত নতুন পাসওয়ার্ড তৈরি করুন।";

  const handle = (r: AuthResult | undefined, onOk: () => void) => {
    if (r?.fieldErrors) setErrors(r.fieldErrors);
    if (r?.error) setFormError(r.error);
    if (r?.step === 1) setStep(1);
    if (r?.ok) onOk();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    const err: Record<string, string> = {};
    if (step === 1) {
      if (!phone.trim()) err.phone = "অনুগ্রহ করে আপনার মোবাইল নম্বর দিন।";
      else if (!normalizeBdPhone(phone)) err.phone = "অনুগ্রহ করে একটি সঠিক মোবাইল নম্বর দিন।";
      setErrors(err);
      if (Object.keys(err).length) return;
      start(async () => handle(await sendResetOtp({ phone }), () => { setErrors({}); setCode(""); setStep(2); }));
    } else if (step === 2) {
      if (cleanOtp(code).length !== 6) err.code = "অনুগ্রহ করে সঠিক ৬-ডিজিটের কোড দিন।";
      setErrors(err);
      if (Object.keys(err).length) return;
      start(async () => handle(await verifyResetOtp({ phone, code }), () => { setErrors({}); setStep(3); }));
    } else {
      if (pw.length < PASSWORD_MIN) err.password = `পাসওয়ার্ড অন্তত ${bn(PASSWORD_MIN)} অক্ষরের হতে হবে।`;
      else if (pw !== confirm) err.confirm = "পাসওয়ার্ড মিলেনি।";
      setErrors(err);
      if (Object.keys(err).length) return;
      start(async () => handle(await setNewPassword({ password: pw, confirm, next }), () => {}));
    }
  };

  return (
    <div className="login-form-box" id="forgotPasswordContainer">
      <h2>পাসওয়ার্ড রিসেট করুন</h2>
      <p className="subtitle">{subtitle}</p>
      <Steps text={`ধাপ ${bn(step)}/৩`} percent={percent} />
      {formError && <p className="form-alert error" role="alert">{formError}</p>}
      <form onSubmit={submit} noValidate>
        {step === 1 && (
          <>
            <TextGroup id="resetContact" label="মোবাইল নম্বর" value={phone} error={errors.phone} placeholder="আপনার মোবাইল নম্বর দিন" type="tel" inputMode="tel"
              autoComplete="tel-national" onChange={(v) => { setPhone(v); clear("phone"); }} />
            <button type="submit" className="login-submit-btn" disabled={pending}>{pending ? "পাঠানো হচ্ছে…" : "OTP পাঠান"}</button>
            <p className="signup-link" style={{ marginTop: 20 }}>পাসওয়ার্ড মনে পড়েছে? <button type="button" onClick={() => go("login")}>লগইন করুন</button></p>
          </>
        )}
        {step === 2 && (
          <>
            <TextGroup id="fpOtpInput" label="ভেরিফিকেশন কোড (OTP) দিন" value={code} error={errors.code} placeholder="৬-ডিজিটের OTP দিন" maxLength={6} inputMode="numeric"
              autoComplete="one-time-code" onChange={(v) => { setCode(v); clear("code"); }} />
            <div className="form-actions-row">
              <button type="button" className="btn-back" onClick={() => { setErrors({}); setFormError(""); setStep(1); }}>পেছনে</button>
              <button type="submit" className="login-submit-btn" style={{ flex: 2 }} disabled={pending}>{pending ? "যাচাই হচ্ছে…" : "OTP যাচাই করুন"}</button>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <PasswordGroup id="newPassword" label="নতুন পাসওয়ার্ড" value={pw} error={errors.password} placeholder="নতুন পাসওয়ার্ড তৈরি করুন" autoComplete="new-password"
              onChange={(v) => { setPw(v); clear("password"); }} />
            <PasswordGroup id="confirmNewPassword" label="নতুন পাসওয়ার্ড নিশ্চিত করুন" value={confirm} error={errors.confirm} placeholder="নতুন পাসওয়ার্ড নিশ্চিত করুন" autoComplete="new-password"
              onChange={(v) => { setConfirm(v); clear("confirm"); }} />
            <div className="form-actions-row">
              <button type="submit" className="login-submit-btn" style={{ width: "100%" }} disabled={pending}>{pending ? "সেট হচ্ছে…" : "নতুন পাসওয়ার্ড সেট করুন"}</button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

// ---------- সাইন আপ: তিন ধাপ ----------
const EMPTY = { full_name: "", email: "", phone: "", password: "", confirm: "", guardian_phone: "", institute: "", class_level: "" };

function SignupView({ next, go }: { next: string; go: (v: AuthView) => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [v, setV] = useState(EMPTY);
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [resends, setResends] = useState(0);
  const [pending, start] = useTransition();
  const { remaining, start: startClock } = useCountdown(RESEND_SECONDS);
  const set = (k: keyof typeof EMPTY) => (val: string) => { setV((s) => ({ ...s, [k]: val })); setErrors((e) => (e[k] ? { ...e, [k]: "" } : e)); };
  const percent = step === 1 ? 33.33 : step === 2 ? 66.66 : 100;
  const subtitle = step === 3 ? "আপনার মোবাইল নম্বর যাচাই করে অ্যাকাউন্ট চালু করুন।" : "শুরু করতে আপনার বিস্তারিত তথ্য দিন।";

  const checkStep1 = () => {
    const e: Record<string, string> = {};
    if (!v.full_name.trim()) e.full_name = "পুরো নাম আবশ্যক।";
    if (!isEmail(v.email.trim())) e.email = "সঠিক ইমেইল আবশ্যক।";
    if (!normalizeBdPhone(v.phone)) e.phone = "সঠিক ফোন নম্বর আবশ্যক।";
    if (v.password.length < PASSWORD_MIN) e.password = `পাসওয়ার্ড অন্তত ${bn(PASSWORD_MIN)} অক্ষরের হতে হবে।`;
    else if (v.password !== v.confirm) e.confirm = "পাসওয়ার্ড মিলেনি।";
    return e;
  };
  const checkStep2 = () => {
    const e: Record<string, string> = {};
    const g = normalizeBdPhone(v.guardian_phone);
    if (!g) e.guardian_phone = "অভিভাবকের সঠিক মোবাইল নম্বর আবশ্যক।";
    else if (g === normalizeBdPhone(v.phone)) e.guardian_phone = "অভিভাবকের নম্বর আপনার নিজের নম্বর থেকে আলাদা হতে হবে।";
    if (v.institute.trim().length < 2) e.institute = "শিক্ষাপ্রতিষ্ঠানের নাম আবশ্যক।";
    if (!CLASS_LEVELS.includes(v.class_level)) e.class_level = "শ্রেণি বেছে নিন।";
    return e;
  };
  const input = (): SignupInput => ({ ...v });

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    setFormError("");
    if (step === 1) {
      const e = checkStep1();
      setErrors(e);
      if (!Object.keys(e).length) setStep(2);
    } else if (step === 2) {
      const e = checkStep2();
      setErrors(e);
      if (Object.keys(e).length) return;
      // "পরবর্তী": সব তথ্য সার্ভারে যাচাই হয়ে অ্যাকাউন্ট খোলে আর মোবাইলে OTP যায়
      start(async () => {
        const r = await startSignup(input());
        if (r.fieldErrors) { setErrors(r.fieldErrors); if (r.step) setStep(r.step); }
        if (r.error) setFormError(r.error);
        if (r.ok) { setErrors({}); setCode(""); setResends(0); startClock(); setStep(3); }
      });
    } else {
      if (cleanOtp(code).length !== 6) { setErrors({ code: "অনুগ্রহ করে সঠিক ৬-ডিজিটের কোড দিন।" }); return; }
      start(async () => {
        const r = await completeSignup({
          phone: v.phone, code, next,
          values: { full_name: v.full_name, phone: v.phone, email: v.email, guardian_phone: v.guardian_phone, institute: v.institute, class_level: v.class_level },
        });
        if (r?.fieldErrors) setErrors(r.fieldErrors);
        if (r?.error) setFormError(r.error);
      });
    }
  };

  const resend = () => {
    if (remaining > 0 || resends >= RESEND_MAX || pending) return;
    setFormError("");
    start(async () => {
      const r = await resendSignupOtp({ phone: v.phone });
      if (r.error) { setFormError(r.error); if (r.left === 0) setResends(RESEND_MAX); return; }
      setResends((n) => n + 1);
      setCode("");
      startClock();
    });
  };
  const exhausted = resends >= RESEND_MAX;

  return (
    <div className="login-form-box" id="signupFormContainer" style={{ maxWidth: 500 }}>
      <h2>অ্যাকাউন্ট তৈরি করুন</h2>
      <p className="subtitle">{subtitle}</p>
      <Steps text={`ধাপ ${bn(step)}/৩`} percent={percent} />
      {formError && <p className="form-alert error" role="alert">{formError}</p>}
      <form onSubmit={submit} noValidate>
        {step === 1 && (
          <>
            <TextGroup id="fullName" label="পুরো নাম" value={v.full_name} error={errors.full_name} placeholder="আপনার নাম" autoComplete="name" onChange={set("full_name")} />
            <div className="input-row">
              <TextGroup id="suEmail" label="ইমেইল ঠিকানা" value={v.email} error={errors.email} placeholder="উদাহরণ@email.com" type="email" inputMode="email" autoComplete="email" onChange={set("email")} />
              <TextGroup id="suPhone" label="ফোন নম্বর" value={v.phone} error={errors.phone} placeholder="০১XXXXXXXXX" type="tel" inputMode="tel" autoComplete="tel-national" onChange={set("phone")} />
            </div>
            <PasswordGroup id="suPassword" label="পাসওয়ার্ড" value={v.password} error={errors.password} placeholder="পাসওয়ার্ড তৈরি করুন" autoComplete="new-password" onChange={set("password")} />
            <PasswordGroup id="suConfirmPassword" label="পাসওয়ার্ড নিশ্চিত করুন" value={v.confirm} error={errors.confirm} placeholder="পাসওয়ার্ড নিশ্চিত করুন" autoComplete="new-password" onChange={set("confirm")} />
            <button type="submit" className="login-submit-btn">পরবর্তী</button>
          </>
        )}
        {step === 2 && (
          <>
            <TextGroup id="suGuardian" label="অভিভাবকের মোবাইল নম্বর" value={v.guardian_phone} error={errors.guardian_phone} placeholder="০১XXXXXXXXX" type="tel" inputMode="tel" onChange={set("guardian_phone")} />
            <div className="input-row">
              <TextGroup id="suInstitute" label="শিক্ষাপ্রতিষ্ঠান" value={v.institute} error={errors.institute} placeholder="স্কুল / কলেজের নাম" autoComplete="organization" onChange={set("institute")} />
              <Group id="suClass" label="শ্রেণি" error={errors.class_level}>
                <select id="suClass" value={v.class_level} aria-invalid={errors.class_level ? true : undefined} onChange={(e) => set("class_level")(e.target.value)}>
                  <option value="" disabled>বেছে নিন</option>
                  {CLASS_LEVELS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Group>
            </div>
            <div className="form-actions-row">
              <button type="button" className="btn-back" onClick={() => { setErrors({}); setFormError(""); setStep(1); }}>পেছনে</button>
              <button type="submit" className="login-submit-btn" style={{ flex: 2 }} disabled={pending}>{pending ? "OTP পাঠানো হচ্ছে…" : "পরবর্তী"}</button>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <TextGroup id="suOtp" label="ভেরিফিকেশন কোড (OTP) দিন" value={code} error={errors.code} placeholder="৬-ডিজিটের OTP দিন" maxLength={6} inputMode="numeric"
              autoComplete="one-time-code" autoFocus onChange={(val) => { setCode(val); setErrors((e) => (e.code ? { ...e, code: "" } : e)); }} />
            <div className="otp-meta">
              <span>আপনার মোবাইলে একটি OTP পাঠানো হয়েছে।</span>
              <span className="otp-side">
                <span className="otp-timer" aria-live="off" title="OTP আবার পাঠানোর আগে অপেক্ষা">{clock(remaining)}</span>
                <button type="button" className="otp-resend" onClick={resend} disabled={remaining > 0 || exhausted || pending}
                  title={exhausted ? "আবার পাঠানোর সীমা শেষ" : remaining > 0 ? "সময় শেষ হলে চালু হবে" : undefined}>
                  OTP আবার পাঠান
                </button>
              </span>
            </div>
            {exhausted && remaining === 0 && (
              <p className="form-alert warn">OTP আবার পাঠানোর সীমা (২ বার) শেষ। কোড না এলে পেছনে গিয়ে নম্বর ঠিক আছে কিনা দেখুন।</p>
            )}
            <div className="form-actions-row">
              <button type="button" className="btn-back" onClick={() => { setErrors({}); setFormError(""); setStep(2); }}>পেছনে</button>
              <button type="submit" className="login-submit-btn" style={{ flex: 2 }} disabled={pending}>{pending ? "যাচাই হচ্ছে…" : "অ্যাকাউন্ট তৈরি করুন"}</button>
            </div>
          </>
        )}
      </form>
      <GoogleForm next={next} label="গুগল দিয়ে সাইন আপ করুন" />
      <p className="signup-link">ইতিমধ্যেই অ্যাকাউন্ট আছে? <button type="button" onClick={() => go("login")}>লগইন করুন</button></p>
    </div>
  );
}

// ---------- পুরো পাতা ----------
export function AuthShell({ initialView, next, replaced, googleError }: { initialView: AuthView; next: string; replaced?: boolean; googleError?: boolean }) {
  const [view, setView] = useState<AuthView>(initialView);

  const router = useRouter();
  const go = (v: AuthView) => {
    setView(v);
    // ঠিকানা বদলায় (শেয়ার/রিলোডে একই ফর্ম); ?next= থাকে। history.replaceState নয়, Next এর router দিয়েই বদলাই, নইলে
    // OTP যাচাইয়ের পর (সেশন-কুকি বসলে) Next পাতা আবার আনে আর ফর্ম প্রথম ধাপে ফিরে যায়।
    startTransition(() => router.replace(PATH[v] + window.location.search, { scroll: false }));
  };

  const notice = (
    <>
      {replaced && <p className="form-alert warn">আপনার অ্যাকাউন্টে অন্য ডিভাইসে লগইন হওয়ায় এখানে লগআউট হয়েছিল। আবার লগইন করলে সেই ডিভাইস থেকে লগআউট হবে।</p>}
      {googleError && <p className="form-alert error" role="alert">Google দিয়ে লগইন হয়নি। আবার চেষ্টা করুন, নয়তো আইডি বা মোবাইল নম্বর দিয়ে লগইন করুন।</p>}
    </>
  );

  return (
    <main className="grow">
    <div className="login-page-wrapper">
      <div className="login-container">
        <div className="login-left">
          <div className="login-left-content">
            {/* লোগো: সবুজ পটভূমিতে সাদা রেখার সংস্করণ (ডেমোর স্কুলের আইকনের জায়গায়) */}
            <Image src="/images/logo-dark.png" alt="বুয়েটিয়ান'স পাঠশালা" width={80} height={80} priority />
            <h2>বুয়েটিয়ান&apos;স পাঠশালায় স্বাগতম!</h2>
            <p>আপনার ড্যাশবোর্ডে অ্যাক্সেস করুন, শেখার অগ্রগতি ট্র্যাক করুন এবং আপনার ক্যারিয়ার উন্নয়নের জন্য নতুন কোর্স আবিষ্কার করুন।</p>
          </div>
        </div>
        <div className="login-right">
          {view === "login" && <LoginView key="login" next={next} go={go} notice={notice} />}
          {view === "forgot" && <ForgotView key="forgot" next={next} go={go} />}
          {view === "signup" && <SignupView key="signup" next={next} go={go} />}
        </div>
      </div>
    </div>
    </main>
  );
}
