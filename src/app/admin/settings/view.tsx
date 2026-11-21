"use client";

import { useState, type ReactNode } from "react";
import { Field, Modal, SampleNote, Switch, useToast } from "../_components/kit";
import { PageHead } from "../_components/ui";

function Card({ icon, tone, title, children, onSave }: { icon: string; tone: string; title: string; children: ReactNode; onSave: () => void }) {
  return (
    <div className="reveal card p-5 md:p-6">
      <h3 className="section-title mb-5 flex items-center gap-2"><span className={`icon ${tone}`}>{icon}</span>{title}</h3>
      {children}
      <button type="button" className="btn-primary mt-1" onClick={onSave}><span className="icon text-[18px]">save</span> সেভ করুন</button>
    </div>
  );
}

// সেটিংস (admin_dashboard.html এর settings): পেমেন্ট, SMS, লাইভ ক্লাস, সাইট, আমার প্রোফাইল। ধাপ ১: শুধু UI
// ম্যানেজার প্যানেলে (manager_dashboard.html) শুধু "আমার প্রোফাইল" আর পাসওয়ার্ড
export function SettingsView({ panel = "admin", name = "অ্যাডমিন", phone = "01700000001" }: { panel?: "admin" | "manager"; name?: string; phone?: string }) {
  const [toast, node] = useToast();
  const [bkash, setBkash] = useState("01700000000");
  const [note, setNote] = useState("bKash Send Money করে TrxID নিচে লিখুন।");
  const [months, setMonths] = useState("12");
  const [sw, setSw] = useState({ otp: true, result: true, payout: false, enroll: true, rec: true, chat: true });
  const [maint, setMaint] = useState(false);
  const [pw, setPw] = useState(false);
  const save = (what: string) => toast(`${what} সংরক্ষণ হয়েছে (নমুনা)`);
  const sws = (keys: [keyof typeof sw, string][]) => <div className="mb-5 space-y-3">{keys.map(([k, l]) => <div key={k} className="flex items-center justify-between gap-4"><span className="text-sm">{l}</span><Switch checked={sw[k]} onChange={(v) => setSw((s) => ({ ...s, [k]: v }))} /></div>)}</div>;
  return (
    <>
      {node}
      <PageHead title="সেটিংস" sub={panel === "manager" ? "আপনার প্রোফাইল আর পাসওয়ার্ড" : "পেমেন্ট, SMS, লাইভ ক্লাস আর সাইটের সাধারণ সেটিংস"} />
      <SampleNote />
      <div className="grid grid-cols-1 gap-3 md:gap-6 xl:grid-cols-2">
        {panel === "admin" && (<>
        <Card icon="account_balance_wallet" tone="text-pink-600" title="পেমেন্ট (bKash)" onSave={() => save("পেমেন্ট সেটিংস")}>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="set-bkash" label="bKash নম্বর"><input id="set-bkash" className="field trx" inputMode="numeric" maxLength={11} value={bkash} onChange={(e) => setBkash(e.target.value)} /></Field>
            <Field id="set-bkash-type" label="অ্যাকাউন্টের ধরন"><select id="set-bkash-type" className="field"><option>পার্সোনাল (Send Money)</option><option>মার্চেন্ট (Payment)</option></select></Field>
          </div>
          <div className="mb-4"><Field id="set-pay-note" label="শিক্ষার্থীদের জন্য নির্দেশনা"><textarea id="set-pay-note" className="field min-h-[90px] resize-y" value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
          <div className="mb-5"><Field id="set-enroll-months" label="অনুমোদনের পর কোর্সের মেয়াদ">
            <select id="set-enroll-months" className="field" value={months} onChange={(e) => setMonths(e.target.value)}><option value="6">৬ মাস</option><option value="12">১ বছর</option><option value="18">১৮ মাস</option><option value="0">আজীবন</option></select></Field></div>
          <div className="mb-5 rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container-low p-4 dark:bg-white/5">
            <div className="mb-2 text-xs font-bold">শিক্ষার্থী চেকআউটে যা দেখবে</div>
            <div className="text-sm">bKash নম্বর <b className="trx">{bkash || "—"}</b> এ Send Money করুন। {note}</div>
          </div>
        </Card>
        <Card icon="sms" tone="text-purple-600" title="SMS" onSave={() => save("SMS সেটিংস")}>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="set-sender" label="Sender ID / মাস্কিং নাম"><input id="set-sender" className="field" maxLength={11} defaultValue="BuetPathsala" /></Field>
            <Field id="set-sms-rate" label="প্রতি SMS খরচ (৳)"><input id="set-sms-rate" className="field" type="number" min={0} step={0.01} defaultValue={0.35} /></Field>
          </div>
          <div className="mb-3 text-xs font-bold">নিজে থেকে SMS যাবে যখন</div>
          {sws([["otp", "OTP (লগইন ও সাইন আপ)"], ["result", "পরীক্ষার ফল প্রকাশ হলে"], ["payout", "সম্মানী দেওয়া হলে"], ["enroll", "পেমেন্ট অনুমোদন হলে"]])}
        </Card>
        <Card icon="video_camera_front" tone="text-emerald-600" title="লাইভ ক্লাস" onSave={() => save("লাইভ ক্লাস সেটিংস")}>
          <div className="mb-5 rounded-2xl bg-surface-container-low p-4 dark:bg-white/5">
            <div className="mb-1 flex justify-between text-xs font-bold"><span>এই মাসের ব্যবহার</span><span className="text-primary dark:text-primary-fixed">৩২০ / ১,০০০ মিনিট</span></div>
            <div className="h-2 rounded-full bg-surface-container-highest dark:bg-on-surface-variant"><div className="h-2 w-[32%] rounded-full bg-primary dark:bg-primary-fixed" /></div>
          </div>
          {sws([["rec", "ক্লাসের রেকর্ডিং নিজে থেকে লেসনে যুক্ত হবে"], ["chat", "শিক্ষার্থীরা লাইভে কমেন্ট করতে পারবে"]])}
        </Card>
        <Card icon="language" tone="text-blue-600" title="সাইট" onSave={() => save("সাইট সেটিংস")}>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="set-support" label="সাপোর্ট নম্বর"><input id="set-support" className="field trx" maxLength={14} defaultValue="01800000000" /></Field>
            <Field id="set-fb" label="ফেসবুক পেজ"><input id="set-fb" className="field" placeholder="https://facebook.com/..." /></Field>
          </div>
          <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-error/30 bg-error/5 p-4">
            <div><div className="text-sm font-bold text-error">মেইনটেন্যান্স মোড</div><div className="mt-0.5 text-xs muted">চালু থাকলে অ্যাডমিন ছাড়া কেউ সাইটে ঢুকতে পারবে না</div></div>
            <Switch checked={maint} onChange={(v) => { setMaint(v); toast(v ? "মেইনটেন্যান্স মোড চালু (নমুনা)" : "মেইনটেন্যান্স মোড বন্ধ (নমুনা)", "info"); }} />
          </div>
        </Card>
        </>)}
        <Card icon="badge" tone="text-primary dark:text-primary-fixed" title="আমার প্রোফাইল" onSave={() => save("প্রোফাইল")}>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="set-name" label="নাম"><input id="set-name" className="field" maxLength={60} defaultValue={name} /></Field>
            <Field id="set-phone" label="ফোন (লগইন)"><input id="set-phone" className="field trx opacity-70" readOnly defaultValue={phone} /></Field>
          </div>
          <button type="button" className="btn-outline mb-3" onClick={() => setPw(true)}><span className="icon text-[18px]">key</span> পাসওয়ার্ড বদলান</button>
        </Card>
      </div>
      <Modal open={pw} onClose={() => setPw(false)} icon="key" title="পাসওয়ার্ড বদলান" sub="অন্তত ৮ অক্ষর"
        actions={[{ label: "বাতিল", kind: "ghost" }, { label: "বদলান", onClick: () => { setPw(false); toast("পাসওয়ার্ড বদলানো হয়েছে (নমুনা)"); } }]}>
        <div className="space-y-4">
          <Field id="pw-old" label="এখনকার পাসওয়ার্ড"><input id="pw-old" type="password" className="field" autoComplete="current-password" /></Field>
          <Field id="pw-new" label="নতুন পাসওয়ার্ড"><input id="pw-new" type="password" className="field" autoComplete="new-password" /></Field>
          <Field id="pw-new2" label="নতুন পাসওয়ার্ড আবার"><input id="pw-new2" type="password" className="field" autoComplete="new-password" /></Field>
        </div>
      </Modal>
    </>
  );
}
