"use client";

import { useState } from "react";
import { bn, taka } from "@/lib/content-schema";
import { SampleNote, Tabs, useConfirm, useToast } from "../_components/kit";
import { Badge, PageHead, type Tone } from "../_components/ui";

const AUDIENCE = [["all", "সব শিক্ষার্থী", 3035], ["course1", "জুনিয়র স্কলারশিপ ব্যাচ", 412], ["course2", "প্রগ্রেসিভ এইচএসসি ২৮", 886], ["teachers", "সব শিক্ষক", 50]] as const;
const HISTORY = [
  { t: "আগামীকালের ক্লাসের সময় পরিবর্তন", a: "জুনিয়র স্কলারশিপ ব্যাচ", n: 412, time: "আজ, ১০:১৫ এএম", ch: "both" },
  { t: "মডেল টেস্ট ০৩ এর ফল প্রকাশ", a: "সব শিক্ষার্থী", n: 3035, time: "গতকাল", ch: "site" },
  { t: "শুক্রবারের ক্লাস স্থগিত", a: "প্রগ্রেসিভ এইচএসসি ২৮", n: 886, time: "৩ দিন আগে", ch: "sms" },
];
const PURPOSE: Record<string, [string, Tone]> = { otp: ["OTP", "blue"], notice: ["নোটিশ", "purple"], result: ["ফলাফল", "green"], payout: ["সম্মানী", "amber"] };
const LOGS = [
  { p: "01711111111", k: "otp", ok: true, prov: "bulksmsbd", time: "২ মিনিট আগে" },
  { p: "01822222222", k: "notice", ok: true, prov: "bulksmsbd", time: "১০ মিনিট আগে" },
  { p: "01933333333", k: "otp", ok: false, prov: "bulksmsbd", time: "১ ঘণ্টা আগে" },
  { p: "01644444444", k: "result", ok: true, prov: "bulksmsbd", time: "গতকাল" },
  { p: "01555555555", k: "payout", ok: true, prov: "bulksmsbd", time: "গতকাল" },
];
const RATE = 0.35;

// নোটিশ ও SMS (admin_dashboard.html এর notices): নোটিশ লেখা, SMS ব্যালেন্স, পাঠানো নোটিশ, SMS লগ। ধাপ ১: শুধু UI
export function NoticesView() {
  const [channel, setChannel] = useState<"site" | "sms" | "both">("site");
  const [aud, setAud] = useState("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("all");
  const [toast, node] = useToast();
  const [ask, askNode] = useConfirm();
  const count = AUDIENCE.find((a) => a[0] === aud)?.[2] ?? 0;
  const sms = channel !== "site";
  const rows = LOGS.filter((l) => tab === "all" || l.k === tab);
  const send = async () => {
    if (!title.trim() && channel !== "sms") return setErr("শিরোনাম লিখুন");
    if (!body.trim()) return setErr("বার্তা লিখুন");
    setErr("");
    const parts = Math.max(1, Math.ceil(body.length / 160));
    const ok = await ask({ title: "নোটিশ পাঠাবেন?", icon: "campaign", ok: "পাঠান", body: <><b>{AUDIENCE.find((a) => a[0] === aud)?.[1]}</b> · {bn(count.toLocaleString("en-IN"))} জন{sms ? <> · SMS খরচ হবে প্রায় <b>{taka(Math.round(count * parts * RATE))}</b></> : null}</> });
    if (!ok) return;
    setTitle(""); setBody("");
    toast("নোটিশ পাঠানো হয়েছে (নমুনা)");
  };
  return (
    <>
      {node}{askNode}
      <PageHead title="নোটিশ ও SMS" sub="শিক্ষার্থী বা শিক্ষকদের নোটিশ পাঠান, SMS খরচ আর লগ দেখুন" />
      <SampleNote />
      <div className="mb-4 grid grid-cols-1 gap-3 md:mb-6 md:gap-6 xl:grid-cols-3">
        <div className="reveal card p-5 md:p-6 xl:col-span-2">
          <h3 className="section-title mb-5 flex items-center gap-2"><span className="icon text-primary dark:text-primary-fixed">campaign</span> নতুন নোটিশ</h3>
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div><label className="label" htmlFor="nt-audience">কাকে পাঠাবেন</label>
              <select id="nt-audience" className="field" value={aud} onChange={(e) => setAud(e.target.value)}>{AUDIENCE.map((a) => <option key={a[0]} value={a[0]}>{a[1]} ({bn(a[2])})</option>)}</select></div>
            <div><span className="label">কোথায় পাঠাবেন</span>
              <div className="tabs w-full">{([["site", "ওয়েবসাইট"], ["sms", "SMS"], ["both", "দুটোই"]] as const).map(([k, l]) => <button key={k} type="button" aria-current={channel === k ? "page" : undefined} className="tab flex-1" onClick={() => setChannel(k)}>{l}</button>)}</div></div>
          </div>
          <div className="mb-4"><label className="label" htmlFor="nt-title">শিরোনাম</label>
            <input id="nt-title" className="field" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="যেমন: আগামীকালের ক্লাসের সময় পরিবর্তন" aria-invalid={err.includes("শিরোনাম")} /></div>
          <div className="mb-3"><label className="label" htmlFor="nt-body">বার্তা</label>
            <textarea id="nt-body" className="field min-h-[120px] resize-y" maxLength={600} value={body} onChange={(e) => setBody(e.target.value)} placeholder="বার্তা লিখুন..." aria-invalid={err.includes("বার্তা")} /></div>
          {err && <p className="mb-3 text-sm font-bold text-error" role="alert">{err}</p>}
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <Badge tone="blue" icon="group">{bn(count.toLocaleString("en-IN"))} জন</Badge>
              <Badge tone="gray" icon="text_fields">{bn(body.length)}/৬০০</Badge>
              {sms && <Badge tone="amber" icon="sms">{bn(Math.max(1, Math.ceil(body.length / 160)))} SMS, আনুমানিক {taka(Math.round(count * Math.max(1, Math.ceil(body.length / 160)) * RATE))}</Badge>}
            </div>
            <button type="button" className="btn-primary" onClick={send}><span className="icon text-[18px]">send</span> পাঠান</button>
          </div>
        </div>
        <div className="space-y-3 md:space-y-6">
          <div className="reveal tilt-card relative overflow-hidden rounded-3xl bg-primary p-6 text-on-primary shadow-md">
            <div className="absolute top-0 right-0 h-28 w-28 -translate-y-1/2 translate-x-1/4 rounded-full bg-white/10 blur-2xl" />
            <div className="mb-1 text-sm font-bold text-primary-fixed">SMS ব্যালেন্স</div>
            <div className="mb-1 text-3xl font-bold">{taka(1240)}</div>
            <div className="mb-5 text-xs text-primary-fixed">প্রায় {bn("3,542")}টি SMS · এই মাসে {bn("3,420")}টি গেছে</div>
            <button type="button" onClick={() => toast("SMS প্রোভাইডারের প্যানেল থেকে রিচার্জ করুন", "info")} className="w-full rounded-lg bg-on-primary py-2 text-sm font-bold text-primary transition-transform hover:scale-[1.02]">রিচার্জ করুন</button>
          </div>
          <div className="reveal card p-5 md:p-6">
            <h3 className="section-title mb-4">পাঠানো নোটিশ</h3>
            <div className="custom-scrollbar max-h-[320px] space-y-3 overflow-y-auto pr-1">
              {HISTORY.map((n) => (
                <div key={n.t} className="rounded-xl border border-outline-variant/20 p-3">
                  <div className="text-sm font-bold">{n.t}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs muted">{n.a} · {bn(n.n.toLocaleString("en-IN"))} জন · {n.time} <Badge tone={n.ch === "site" ? "blue" : n.ch === "sms" ? "amber" : "purple"}>{n.ch === "site" ? "ওয়েবসাইট" : n.ch === "sms" ? "SMS" : "দুটোই"}</Badge></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="reveal card p-4 md:p-6">
        <div className="mb-3 flex flex-col justify-between gap-3 md:mb-5 md:flex-row md:items-center">
          <h3 className="section-title">SMS লগ</h3>
          <Tabs value={tab} onChange={setTab} items={[{ key: "all", label: "সব", count: bn(LOGS.length) }, ...Object.entries(PURPOSE).map(([k, v]) => ({ key: k, label: v[0], count: bn(LOGS.filter((l) => l.k === k).length) }))]} />
        </div>
        <div className="custom-scrollbar -mx-2 overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead><tr className="border-b border-outline-variant/20"><th className="th">নম্বর</th><th className="th">ধরন</th><th className="th">স্ট্যাটাস</th><th className="th">প্রোভাইডার ID</th><th className="th">সময়</th></tr></thead>
            <tbody className="divide-y divide-outline-variant/10">
              {rows.map((l, i) => (
                <tr key={i} className="row-in" style={{ "--i": i } as React.CSSProperties}>
                  <td className="td trx">{l.p.slice(0, 5)}****{l.p.slice(-2)}</td>
                  <td className="td"><Badge tone={PURPOSE[l.k][1]}>{PURPOSE[l.k][0]}</Badge></td>
                  <td className="td">{l.ok ? <Badge tone="green" icon="done">পাঠানো হয়েছে</Badge> : <Badge tone="red" icon="error">ব্যর্থ</Badge>}</td>
                  <td className="td trx text-xs muted">{l.prov}</td>
                  <td className="td text-xs muted">{l.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 flex items-center gap-1 text-xs muted"><span className="icon text-[16px]">lock</span> নিরাপত্তার জন্য OTP কোড লগে রাখা হয় না, শুধু পাঠানো হয়েছে কিনা সেটা থাকে।</p>
      </div>
    </>
  );
}
