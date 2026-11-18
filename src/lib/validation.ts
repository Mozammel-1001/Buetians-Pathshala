// ফর্মের লেখা পরিষ্কার আর যাচাই (server এ; browser এর যাচাই শুধু সুবিধার জন্য)
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export const toAsciiDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));

// বাংলাদেশের মোবাইল: 01XXXXXXXXX, +8801..., 8801... সব একই ধাঁচে 8801XXXXXXXXX (Supabase যেভাবে ফোন রাখে)
export function normalizeBdPhone(input: string): string | null {
  const d = toAsciiDigits(input).replace(/[\s\-()+]/g, "");
  const local = d.startsWith("880") ? d.slice(2) : d.startsWith("80") ? d.slice(1) : d;
  return /^01[3-9]\d{8}$/.test(local) ? "88" + local : null;
}

// Supabase এর auth API তে ফোন যায় + সহ (E.164)
export const e164 = (phone: string) => "+" + phone;

// দেখানোর জন্য: 8801712345678 → 01712-345678
export const displayPhone = (phone: string | null | undefined) =>
  phone && /^8801\d{9}$/.test(phone) ? `${phone.slice(2, 7)}-${phone.slice(7)}` : phone ?? "";

// গোপন রেখে দেখানো: 8801712345678 → 017•••••678 (আইডি দিয়ে লগইনে কোন নম্বরে কোড গেল)
export const maskPhone = (phone: string) => (/^8801\d{9}$/.test(phone) ? `${phone.slice(2, 5)}•••••${phone.slice(-3)}` : "•••");

// আইডি: "BP-1001", "bp 1001", "BP1001", "১০০১", "1001" সব → "BP-1001"। মোবাইল নম্বর (০১ দিয়ে শুরু, ১১ অঙ্ক) আইডি নয়
export function normalizeUserCode(input: string): string | null {
  const s = toAsciiDigits(input).toUpperCase().replace(/[\s\-_]/g, "");
  const m = /^(?:BP)?(\d{4,7})$/.exec(s);
  if (!m || (!s.startsWith("BP") && m[1].startsWith("0"))) return null;
  return "BP-" + m[1];
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

// সাইন আপের শ্রেণি (database এ লেখা হিসেবে থাকে; তালিকা বদলালে পুরনোগুলোও দেখানো যায়)
export const CLASS_LEVELS = [
  "ষষ্ঠ শ্রেণি", "সপ্তম শ্রেণি", "অষ্টম শ্রেণি", "নবম শ্রেণি", "দশম শ্রেণি", "SSC পরীক্ষার্থী",
  "একাদশ শ্রেণি", "দ্বাদশ শ্রেণি", "HSC পরীক্ষার্থী", "বিশ্ববিদ্যালয় ভর্তি পরীক্ষার্থী", "অন্যান্য",
];

// OTP: বাংলা অঙ্কে লিখলেও চলে
export const cleanOtp = (input: string) => toAsciiDigits(input).replace(/\D/g, "");

export const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
