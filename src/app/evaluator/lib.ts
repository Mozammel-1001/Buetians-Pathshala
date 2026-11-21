// খাতা মূল্যায়নের পাতার (evaluator_dashboard.html) শেয়ার করা ধরন আর হিসাব: server আর browser দুই জায়গাতেই চলে
// সময় সবসময় বাংলাদেশের (UTC+৬), তাই server আর browser একই সময় দেখায়

export type EvRole = "evaluator" | "teacher" | "admin";
export const ROLE_LABEL: Record<EvRole, string> = { evaluator: "খাতা মূল্যায়নকারী", teacher: "শিক্ষক", admin: "অ্যাডমিন" };

export type Kind = "mcq" | "mixed" | "written";
// একটা পরীক্ষার (বা এক প্রশ্নের) খাতার অগ্রগতি
export type Prog = { scripts: number; marked: number; inHand: number; returned: number; remaining: number; modLeft: number; flagged: number };
export type ExamItem = {
  id: number; title: string; course: string; kind: Kind; closesAt: number; published: boolean; prog: Prog;
};
export type QItem = { id: number; no: number; section: string; body: string; marks: number; solution: string; scheme: string; imageUrl: string | null };
export type QProg = Prog & { id: number; no: number; section: string; marks: number; refs: number };
export type Settings = { tolerance: number; modPercent: number; recheckDays: number; pick: Record<string, number>; kind: Kind };

export const emptyProg = (): Prog => ({ scripts: 0, marked: 0, inHand: 0, returned: 0, remaining: 0, modLeft: 0, flagged: 0 });
export const sumProg = (rows: Prog[]): Prog => rows.reduce((t, r) => ({
  scripts: t.scripts + r.scripts, marked: t.marked + r.marked, inHand: t.inHand + r.inHand, returned: t.returned + r.returned,
  remaining: t.remaining + r.remaining, modLeft: t.modLeft + r.modLeft, flagged: t.flagged + r.flagged,
}), emptyProg());

// ---------- সংখ্যা ----------
const BN = "০১২৩৪৫৬৭৮৯";
export const bn = (v: string | number) => String(v).replace(/\d/g, (d) => BN[+d]);
export const num = (n: number) => bn(Number.isInteger(+n) ? +n : String(+(+n).toFixed(2)));
export const toNum = (v: string | number | null | undefined) => Number(String(v ?? "").trim().replace(/[০-৯]/g, (d) => String(BN.indexOf(d))));
// ভারতীয় ধাঁচে হাজার-লাখ (১২,৩৪,৫০০), যাতে server আর browser একই লেখে
const group = (n: number) => { const s = String(Math.trunc(Math.abs(n))); return s.length <= 3 ? s : s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + s.slice(-3); };
export const taka = (n: number) => {
  const r = Math.round(n * 100) / 100, f = Math.round((Math.abs(r) % 1) * 100);
  return "৳" + bn((r < 0 ? "-" : "") + group(r) + (f ? "." + String(f).padStart(2, "0").replace(/0$/, "") : ""));
};
// প্রশ্নের নাম: "প্রশ্ন ২" (সেকশন থাকলে "সৃজনশীল · প্রশ্ন ২")
export const qLabel = (no: number, section?: string | null) => (section ? `${section} · ` : "") + `প্রশ্ন ${bn(no)}`;
// ০.৫ এর ঘরে (শুধু দশমিক .০ বা .৫), বাংলা সংখ্যাও চলে
export const validMarks = (v: number, max: number) => Number.isFinite(v) && v >= 0 && v <= max && v * 2 === Math.trunc(v * 2);

// ---------- সময় (বাংলাদেশ) ----------
const BD = 6 * 3600e3;
export const MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const two = (n: number) => String(n).padStart(2, "0");
const bd = (ts: number) => new Date(ts + BD);
export const fmtDate = (ts: number) => { const d = bd(ts), h = d.getUTCHours(); return bn(d.getUTCDate()) + " " + MONTHS[d.getUTCMonth()].slice(0, 4) + ", " + bn(two(h % 12 || 12) + ":" + two(d.getUTCMinutes())) + (h < 12 ? " এএম" : " পিএম"); };
export const span = (ms: number) => ms < 60e3 ? "এইমাত্র" : ms < 3600e3 ? bn(Math.floor(ms / 60e3)) + " মিনিট" : ms < 864e5 ? bn(Math.floor(ms / 3600e3)) + " ঘণ্টা" : bn(Math.floor(ms / 864e5)) + " দিন";
export const ago = (ts: number, now: number) => (now - ts < 60e3 ? "এইমাত্র" : span(now - ts) + " আগে");
// মাসের চাবি "YYYY-MM" (বাংলাদেশের মাস) আর মাসের ১ তারিখ (database এর p_period)
export const monthKey = (ts: number) => { const d = bd(ts); return d.getUTCFullYear() + "-" + two(d.getUTCMonth() + 1); };
export const monthLabel = (mk: string) => { const [y, m] = mk.split("-"); return MONTHS[+m - 1] + " " + bn(y); };
export const monthStart = (mk: string) => mk + "-01";
// এখন থেকে পিছনে n মাস (প্রথমটা এই মাস)
export const lastMonths = (now: number, n = 12) => { const d = bd(now); let y = d.getUTCFullYear(), m = d.getUTCMonth(); const out: string[] = []; for (let i = 0; i < n; i++) { out.push(y + "-" + two(m + 1)); if (--m < 0) { m = 11; y--; } } return out; };

// ---------- নোটিশ দেখা হয়েছে কিনা (প্রতি browser এ) ----------
export const SEEN_EVENT = "ev-notices-seen";
export const seenKey = (uid: string) => `ev-seen-${uid}`;
