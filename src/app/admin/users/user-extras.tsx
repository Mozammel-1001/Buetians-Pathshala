"use client";

import { useState } from "react";
import { Field, Modal, SampleNote, useConfirm, useToast } from "../_components/kit";

// ধাপ ১ (শুধু UI): "শিক্ষক/ম্যানেজার যোগ" modal আর সারির "ব্লক" বোতাম। কাজ জোড়ার সময় আসল action এ বদলাবে
export function AddStaffButton() {
  const [open, setOpen] = useState(false);
  const [toast, node] = useToast();
  return (
    <>
      {node}
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}><span className="icon text-[18px]">person_add</span> শিক্ষক/ম্যানেজার যোগ</button>
      <Modal open={open} onClose={() => setOpen(false)} icon="person_add" title="শিক্ষক / ম্যানেজার যোগ" sub="তিনি এই নম্বরে OTP দিয়ে লগইন করবেন"
        actions={[{ label: "বাতিল", kind: "ghost" }, { label: "যোগ করুন", onClick: () => { setOpen(false); toast("যোগ হয়েছে (নমুনা, এখনো সংরক্ষণ হয় না)"); } }]}>
        <div className="space-y-4">
          <SampleNote />
          <Field id="st-name" label="পুরো নাম"><input id="st-name" className="field" placeholder="যেমন: রাফিউল ইসলাম" /></Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="st-phone" label="মোবাইল নম্বর"><input id="st-phone" className="field trx" inputMode="numeric" maxLength={11} placeholder="01XXXXXXXXX" /></Field>
            <Field id="st-role" label="রোল"><select id="st-role" className="field"><option>শিক্ষক</option><option>ম্যানেজার</option></select></Field>
          </div>
          <Field id="st-inst" label="প্রতিষ্ঠান ও ব্যাচ (ঐচ্ছিক)"><input id="st-inst" className="field" placeholder="যেমন: BUET CSE ’19" /></Field>
        </div>
      </Modal>
    </>
  );
}

export function BlockButton({ name }: { name: string }) {
  const [blocked, setBlocked] = useState(false);
  const [toast, node] = useToast();
  const [ask, askNode] = useConfirm();
  const go = async () => {
    const ok = await ask(blocked
      ? { title: "ইউজার আনব্লক", sub: name, icon: "lock_open", ok: "আনব্লক করুন", body: "আনব্লক করলে আবার লগইন করতে পারবে। আবার ঢুকতে ফোন নম্বর আর পাসওয়ার্ড লাগবে।" }
      : { title: "ইউজার ব্লক", sub: name, tone: "danger", icon: "block", ok: "ব্লক করুন", body: "ব্লক করলে আর লগইন করতে পারবে না, চলমান সেশনও বন্ধ হয়ে যাবে। (নমুনা: এখনো সংরক্ষণ হয় না)" });
    if (ok) { setBlocked(!blocked); toast(blocked ? "আনব্লক হয়েছে (নমুনা)" : "ব্লক হয়েছে (নমুনা)", "info"); }
  };
  return (
    <>
      {node}{askNode}
      <button type="button" className={`icon-btn ${blocked ? "" : "hover:text-error!"}`} title={blocked ? "আনব্লক" : "ব্লক"} aria-label={blocked ? "আনব্লক" : "ব্লক"}
        onClick={go}>
        <span className="icon text-[20px]">{blocked ? "lock_open" : "block"}</span>
      </button>
    </>
  );
}
