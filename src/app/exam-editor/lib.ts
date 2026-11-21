// প্রশ্নপত্র সম্পাদকের (exam_editor.html) শেয়ার করা ধরন আর হিসাব: server আর browser দুই জায়গাতেই চলে
// সময় সবসময় বাংলাদেশের (UTC+৬, দিনের আলো বদলের নিয়ম নেই), তাই server আর browser একই সময় দেখায়

export type Kind = "mcq" | "written" | "mixed";
export type QKind = "mcq" | "written";
export type Pick = Record<string, number>;

export type ExamRow = {
  id: number; courseId: number; courseName: string; title: string; kind: Kind; minutes: number; neg: number;
  opens: number | null; closes: number | null; pick: Pick; shuffle: boolean; submitOnHide: boolean;
  moderation: number; recheckDays: number; published: boolean; by: string;
};
// server থেকে আসা প্রশ্ন: ছবি = Storage এর path + দেখার signed URL
export type QImg = { path: string; url: string };
export type QRow = {
  id: number; kind: QKind; section: string; body: string; image: QImg | null; options: string[]; optionImages: (QImg | null)[];
  key: number | null; exp: string; scheme: string; chapterId: number | null; marks: number; lock: boolean;
};
export type Chapter = { id: number; title: string };
export type Course = { id: number; name: string };

// ---------- সংখ্যা ----------
const BN = "০১২৩৪৫৬৭৮৯";
export const bn = (v: string | number) => String(v).replace(/\d/g, (d) => BN[+d]);
export const num = (n: number) => bn(Number.isInteger(+n) ? +n : String(+(+n).toFixed(2)));
export const toNum = (v: string | number | null | undefined) => Number(String(v ?? "").trim().replace(/[০-৯]/g, (d) => String(BN.indexOf(d))));
export const L = ["ক", "খ", "গ", "ঘ", "ঙ", "চ"];

// ---------- সময় (বাংলাদেশ) ----------
const BD = 6 * 3600e3;
const MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const two = (n: number) => String(n).padStart(2, "0");
const bd = (ts: number) => new Date(ts + BD);
export const clock = (ts: number) => { const d = bd(ts), h = d.getUTCHours(); return bn((h % 12 || 12) + ":" + two(d.getUTCMinutes())) + (h < 12 ? " এএম" : " পিএম"); };
const dayKey = (ts: number) => Math.floor((ts + BD) / 864e5);
export const when = (ts: number | null, now: number) => {
  if (ts == null) return "ঠিক হয়নি";
  const k = dayKey(ts), t = dayKey(now), d = bd(ts);
  const day = k === t ? "আজ" : k === t + 1 ? "আগামীকাল" : bn(d.getUTCDate()) + " " + MONTHS[d.getUTCMonth()];
  return day + ", " + clock(ts);
};
// datetime-local এর মান (YYYY-MM-DDTHH:mm) <-> ms
export const toInput = (ms: number | null) => (ms == null ? "" : bd(ms).toISOString().slice(0, 16));
export const fromInput = (v: string) => (v ? Date.parse(v + ":00+06:00") : null);

// ---------- অবস্থা ----------
export type State = "draft" | "scheduled" | "running" | "closed";
export const stateOf = (e: Pick2, now: number): State => (!e.published ? "draft" : e.opens == null || now < e.opens ? "scheduled" : e.closes != null && now < e.closes ? "running" : "closed");
type Pick2 = { published: boolean; opens: number | null; closes: number | null };

// ---------- সারাংশ ----------
export type Stat = { mcq: number; mcqMarks: number; written: number; secs: Record<string, number[]>; wTotal: number };
export function stats(qs: { kind: QKind; section: string; marks: number }[], pick: Pick): Stat {
  const mq = qs.filter((q) => q.kind === "mcq"), wq = qs.filter((q) => q.kind === "written");
  const secs: Record<string, number[]> = {};
  wq.forEach((q) => { (secs[q.section] = secs[q.section] || []).push(q.marks); });
  // লিখিত: "যেকোনো N টি" হলে বেশি নম্বরের N টি ধরে সর্বোচ্চ
  const wTotal = Object.entries(secs).reduce((t, [sec, ms]) => t + ms.slice().sort((a, b) => b - a).slice(0, pick[sec] || ms.length).reduce((x, y) => x + y, 0), 0);
  return { mcq: mq.length, mcqMarks: mq.reduce((t, q) => t + q.marks, 0), written: wq.length, secs, wTotal };
}

// প্রকাশের আগে যা ঠিক থাকা দরকার (database এর exam_publish_check এর নিয়ম); খালি = প্রকাশ করা যায়
export function publishIssues(e: { kind: Kind; minutes: number; opens: number | null; closes: number | null; pick: Pick }, qs: { kind: QKind; section: string }[], now: number, checkPast = true) {
  const out: string[] = [];
  if (e.opens == null || e.closes == null) out.push("প্রকাশের আগে পরীক্ষা শুরু আর শেষের সময় দিন");
  else {
    if (checkPast && e.closes <= now) out.push("শেষের সময় পেরিয়ে গেছে, নতুন সময় দিন");
    if (e.closes < e.opens + e.minutes * 60e3) out.push(`শেষের সময় অন্তত শুরু + ${bn(e.minutes)} মিনিট হতে হবে, নইলে কেউ পুরো সময় পাবে না`);
  }
  const nm = qs.filter((q) => q.kind === "mcq").length, nw = qs.filter((q) => q.kind === "written").length;
  if ((e.kind === "mcq" && !nm) || (e.kind === "written" && !nw) || (e.kind === "mixed" && (!nm || !nw)))
    out.push(e.kind === "mixed" ? "মিশ্র পরীক্ষায় MCQ আর লিখিত দুই ধরনের প্রশ্নই লাগবে" : "প্রশ্ন ছাড়া প্রকাশ করা যায় না");
  Object.entries(e.pick).forEach(([sec, n]) => {
    const have = qs.filter((q) => q.kind === "written" && q.section === sec).length;
    if (!(Number.isInteger(n) && n >= 1 && n <= have)) out.push(`"${sec}" সেকশনে ${bn(have)}টি প্রশ্ন আছে, "যেকোনো" সংখ্যা ১ থেকে ${bn(have)} এর মধ্যে দিন`);
  });
  return out;
}

// ---------- একসাথে অনেক MCQ ----------
export const LOCKWORDS = /সবগুলো|সবকটি|কোনোটিই নয়|কোনটিই নয়|উপরের সব|উপরের কোনোটি|ক ও খ|খ ও গ|ক, খ ও গ|all of the above|none of the above/i;
export type NewQ = {
  id?: number; kind: QKind; section: string; body: string; image: string | null; options: string[]; optionImages: (string | null)[] | null;
  key: number | null; exp: string; scheme: string; chapterId: number | null; marks: number; lock: boolean;
};
const letterIdx = (c: string) => { const i = L.indexOf(c); if (i >= 0) return i; if (/^[a-f]$/i.test(c)) return c.toLowerCase().charCodeAt(0) - 97; const n = toNum(c); return n >= 1 ? n - 1 : -1; };
// ফাঁকা লাইন দিয়ে আলাদা প্রশ্ন; "ক)"/"(ক)"/"ক."/"a)" অপশন; "উত্তর: খ"; "ব্যাখ্যা:"; "অধ্যায়:"; "নম্বর:"
export function parseBulk(text: string, chapters: Chapter[]) {
  return text.replace(/\r/g, "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).map((b, bi) => {
    const q: NewQ = { kind: "mcq", section: "", body: "", image: null, options: [], optionImages: null, key: null, exp: "", scheme: "", chapterId: null, marks: 1, lock: false };
    const errs: string[] = [], body: string[] = [];
    let mode = "body";
    b.split("\n").map((l) => l.trim()).filter(Boolean).forEach((l) => {
      let m: RegExpMatchArray | null;
      if ((m = l.match(/^(?:\(\s*([কখগঘঙচa-fA-F])\s*\)|([কখগঘঙচa-fA-F])\s*[).:।])\s*(.*)$/)) && mode !== "exp") { q.options.push(m[3]); mode = "opt"; return; }
      if ((m = l.match(/^(?:সঠিক উত্তর|উত্তর|ans(?:wer)?)\s*[:：-]\s*\(?\s*([কখগঘঙচa-fA-F১-৬1-6])/i))) { q.key = letterIdx(m[1]); mode = "key"; return; }
      if ((m = l.match(/^(?:ব্যাখ্যা|সমাধান|explanation)\s*[:：-]\s*(.*)$/i))) { q.exp = m[1]; mode = "exp"; return; }
      if ((m = l.match(/^(?:অধ্যায়|chapter)\s*[:：-]\s*(.*)$/i))) { const c = chapters.find((x) => x.title === m![1].trim()); if (c) q.chapterId = c.id; else errs.push(`অধ্যায় "${m[1].trim()}" এই কোর্সে নেই`); return; }
      if ((m = l.match(/^(?:নম্বর|marks?)\s*[:：-]\s*([\d০-৯.]+)/i))) { q.marks = toNum(m[1]); return; }
      if (mode === "body") body.push(body.length ? l : l.replace(/^(?:প্রশ্ন\s*[:：-]?|Q\s*[.:]?|[\d০-৯]+\s*[.)।:])\s*/i, ""));
      else if (mode === "exp") q.exp += "\n" + l;
      else if (mode === "opt") q.options[q.options.length - 1] += " " + l;
    });
    q.body = body.join("\n");
    q.lock = q.options.some((o) => LOCKWORDS.test(o));
    if (!q.body) errs.push("প্রশ্ন নেই");
    if (q.options.length < 2) errs.push("অন্তত ২টি অপশন লাগবে (ক) ... খ) ...)");
    if (q.options.length > 6) errs.push("৬টির বেশি অপশন");
    if (q.key === null || q.key < 0 || q.key >= q.options.length) errs.push('"উত্তর: ক" এর মতো সঠিক উত্তর দিন');
    return { no: bi + 1, q, errs };
  });
}
export const SAMPLE = `প্রশ্ন: $x^2 - 5x + 6 = 0$ এর মূলদ্বয় কী?
ক) $2, 3$
খ) $-2, -3$
গ) $1, 6$
ঘ) $-1, -6$
উত্তর: ক
ব্যাখ্যা: $(x - 2)(x - 3) = 0$

প্রশ্ন: নিচের কোনটি মৌলিক সংখ্যা?
ক) ৯
খ) ১৫
গ) ১৭
ঘ) ২১
উত্তর: গ`;
