// সাইটের লেখা আর কোর্সের তথ্য: ধরন, শুরুর মান, যাচাই আর দেখানোর সাহায্যকারী। browser আর server দুই জায়গাতেই
// চলে (অ্যাডমিনের ফর্মেও লাগে)। database থেকে পড়া content.ts এ
import { toAsciiDigits } from "@/lib/validation";

// ---------- ধরন ----------
export type Hero = {
  badge: string; title: string; highlight: string; subtitle: string; image_url: string;
  primary_label: string; primary_href: string; secondary_label: string; secondary_href: string;
};
export type Feature = { icon: string; title: string; text: string };
export type Branch = { name: string; address: string; phone: string; map_url: string };
export type AboutPoint = { title: string; text: string };
export type SiteContent = {
  hero: Hero;
  features: { title: string; items: Feature[] };
  branches: { title: string; items: Branch[] };
  cta: { title: string; text: string; button_label: string; button_href: string };
  contact: { phone: string; whatsapp: string; email: string; address: string; facebook: string; youtube: string; footer_text: string };
  about: { title: string; intro: string; mission: string; vision: string; image_url: string; points: AboutPoint[] };
  payment: { bkash_number: string; account_type: "personal" | "agent" | "merchant"; note: string; review_time: string };
};
export type SectionKey = keyof SiteContent;
export const SECTION_KEYS: SectionKey[] = ["hero", "features", "branches", "cta", "contact", "about", "payment"];

export type RoutineRow = { day: string; time: string; topic: string };
export type Faq = { q: string; a: string };
export type Course = {
  id: number; slug: string; title: string; subtitle: string | null; description: string | null;
  key_points: string[]; price: number; price_before: number | null; thumbnail_url: string | null;
  batch_name: string | null; starts_on: string | null; enroll_deadline: string | null;
  class_schedule: string | null; duration_label: string | null;
  routine: RoutineRow[]; faqs: Faq[]; routine_url: string | null; syllabus_url: string | null;
  is_published: boolean; position: number; updated_at: string;
};
export const COURSE_COLUMNS =
  "id, slug, title, subtitle, description, key_points, price, price_before, thumbnail_url, batch_name, starts_on, enroll_deadline, " +
  "class_schedule, duration_label, routine, faqs, routine_url, syllabus_url, is_published, position, updated_at";

// ---------- শুরুর মান (database এ কিছু না থাকলে বা কোনো ঘর বাদ পড়লে) ----------
export const DEFAULT_CONTENT: SiteContent = {
  hero: {
    badge: "নতুন কোর্স উপলব্ধ",
    title: "বুয়েটিয়ান'স পাঠশালার সাথে",
    highlight: "উন্মোচন করুন আপনার সম্ভাবনা",
    subtitle: "লাইভ ক্লাস, রেকর্ডেড লেকচার, সাপ্তাহিক পরীক্ষা আর খাতা দেখে মন্তব্য: HSC আর ভর্তি পরীক্ষার পুরো প্রস্তুতি এক জায়গায়।",
    image_url: "",
    primary_label: "কোর্স দেখুন", primary_href: "#courses",
    secondary_label: "অ্যাকাউন্ট খুলুন", secondary_href: "/sign-up",
  },
  features: { title: "শিক্ষার্থীরা কেন আমাদের বেছে নেয়?", items: [] },
  branches: { title: "আমাদের ব্রাঞ্চসমূহ", items: [] },
  cta: { title: "", text: "", button_label: "", button_href: "" },
  contact: { phone: "", whatsapp: "", email: "", address: "", facebook: "", youtube: "", footer_text: "" },
  about: { title: "আমাদের সম্পর্কে", intro: "", mission: "", vision: "", image_url: "", points: [] },
  payment: { bkash_number: "", account_type: "personal", note: "", review_time: "" },
};
export const ACCOUNT_TYPES = { personal: "পার্সোনাল", agent: "এজেন্ট", merchant: "মার্চেন্ট" } as const;

// ---------- যাচাই ----------
// সব লেখা সাধারণ লেখা হিসেবে দেখানো হয় (HTML নয়), তাই লেখায় ঝুঁকি নেই। ঝুঁকি লিংকে: javascript: ইত্যাদি আটকানো
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "");

export const isSafeHref = (v: string) => v === "" || /^(\/(?!\/)|#|https:\/\/|http:\/\/localhost|tel:|mailto:)/i.test(v);
export const isSafeUrl = (v: string) => v === "" || /^https:\/\//i.test(v) || /^http:\/\/(localhost|127\.0\.0\.1)/i.test(v);

const href = (v: unknown, max = 300) => {
  const s = text(v, max);
  return isSafeHref(s) ? s : "";
};
const url = (v: unknown) => {
  const s = text(v, 500);
  return isSafeUrl(s) ? s : "";
};
const icon = (v: unknown) => {
  const s = text(v, 40).toLowerCase();
  return /^[a-z0-9_]+$/.test(s) ? s : "check_circle";
};
const list = <T,>(v: unknown, max: number, map: (x: Record<string, unknown>) => T, keep: (x: T) => boolean) =>
  (Array.isArray(v) ? v : [])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map(map)
    .filter(keep)
    .slice(0, max);

// database বা ফর্ম থেকে আসা যেকোনো JSON কে নিরাপদ, পূর্ণ আকারে আনা
export function cleanSection<K extends SectionKey>(key: K, raw: unknown): SiteContent[K] {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_CONTENT;
  const pick = (k: string, max: number, fallback = "") => (k in r ? text(r[k], max) : fallback);
  switch (key) {
    case "hero":
      return {
        badge: pick("badge", 60, d.hero.badge), title: pick("title", 120, d.hero.title), highlight: pick("highlight", 120, d.hero.highlight),
        subtitle: pick("subtitle", 400, d.hero.subtitle), image_url: url(r.image_url),
        primary_label: pick("primary_label", 40, d.hero.primary_label), primary_href: "primary_href" in r ? href(r.primary_href) : d.hero.primary_href,
        secondary_label: pick("secondary_label", 40, d.hero.secondary_label), secondary_href: "secondary_href" in r ? href(r.secondary_href) : d.hero.secondary_href,
      } as SiteContent[K];
    case "features":
      return {
        title: pick("title", 120, d.features.title),
        items: list(r.items, 12, (x) => ({ icon: icon(x.icon), title: text(x.title, 80), text: text(x.text, 300) }), (x) => !!x.title),
      } as SiteContent[K];
    case "branches":
      return {
        title: pick("title", 120, d.branches.title),
        items: list(r.items, 24, (x) => ({ name: text(x.name, 80), address: text(x.address, 200), phone: text(x.phone, 40), map_url: url(x.map_url) }), (x) => !!x.name),
      } as SiteContent[K];
    case "cta":
      return { title: pick("title", 120), text: pick("text", 300), button_label: pick("button_label", 40), button_href: href(r.button_href) } as SiteContent[K];
    case "contact":
      return {
        phone: pick("phone", 40), whatsapp: pick("whatsapp", 40), email: pick("email", 120), address: pick("address", 300),
        facebook: url(r.facebook), youtube: url(r.youtube), footer_text: pick("footer_text", 300),
      } as SiteContent[K];
    case "about":
      return {
        title: pick("title", 120, d.about.title), intro: pick("intro", 3000), mission: pick("mission", 1500), vision: pick("vision", 1500),
        image_url: url(r.image_url),
        points: list(r.points, 12, (x) => ({ title: text(x.title, 80), text: text(x.text, 300) }), (x) => !!x.title),
      } as SiteContent[K];
    case "payment": {
      // bKash নম্বর: 01XXXXXXXXX ধাঁচে (বাংলা অঙ্কেও লেখা যায়); ভুল হলে ফাঁকা, তখন ভর্তির modal এ "নম্বর দেওয়া হয়নি"
      const digits = toAsciiDigits(text(r.bkash_number, 20)).replace(/\D/g, "").replace(/^88(?=01)/, "");
      const type = r.account_type === "agent" || r.account_type === "merchant" ? r.account_type : "personal";
      return {
        bkash_number: /^01[3-9]\d{8}$/.test(digits) ? digits : "", account_type: type,
        note: pick("note", 300), review_time: pick("review_time", 120),
      } as SiteContent[K];
    }
  }
  throw new Error("অজানা অংশ: " + String(key));
}

// কোর্সের ফর্ম যাচাই: ভুল থাকলে ঘরের নাম → বাংলা কারণ
export type CourseInput = Omit<Course, "id" | "updated_at">;
export function cleanCourse(raw: Record<string, unknown>): { value: CourseInput; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const money = (v: unknown) => {
    const s = toAsciiDigits(String(v ?? "")).replace(/[,\s৳]/g, "");
    return s === "" ? null : Number(s);
  };
  const date = (v: unknown) => {
    const s = text(v, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  };
  const opt = (v: unknown, max: number) => text(v, max) || null;

  const value: CourseInput = {
    slug: text(raw.slug, 80).toLowerCase(),
    title: text(raw.title, 150),
    subtitle: opt(raw.subtitle, 200),
    description: opt(raw.description, 8000),
    key_points: (Array.isArray(raw.key_points) ? raw.key_points : []).map((k) => text(k, 120)).filter(Boolean).slice(0, 20),
    price: money(raw.price) ?? NaN,
    price_before: money(raw.price_before),
    thumbnail_url: url(raw.thumbnail_url) || null,
    batch_name: opt(raw.batch_name, 80),
    starts_on: date(raw.starts_on),
    enroll_deadline: date(raw.enroll_deadline),
    class_schedule: opt(raw.class_schedule, 150),
    duration_label: opt(raw.duration_label, 40),
    routine: list(raw.routine, 200, (x) => ({ day: text(x.day, 60), time: text(x.time, 60), topic: text(x.topic, 200) }), (x) => !!(x.day || x.topic)),
    faqs: list(raw.faqs, 30, (x) => ({ q: text(x.q, 300), a: text(x.a, 2000) }), (x) => !!x.q),
    routine_url: url(raw.routine_url) || null,
    syllabus_url: url(raw.syllabus_url) || null,
    is_published: raw.is_published === true || raw.is_published === "on" || raw.is_published === "true",
    position: Math.trunc(Number(toAsciiDigits(String(raw.position ?? "0")))) || 0,
  };

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value.slug)) errors.slug = "ছোট হাতের ইংরেজি অক্ষর, সংখ্যা আর - দিয়ে লিখুন, যেমন hsc-27-math";
  if (value.title.length < 2) errors.title = "কোর্সের নাম লিখুন";
  if (!Number.isFinite(value.price) || value.price < 0) errors.price = "সঠিক দাম লিখুন (০ হলে ফ্রি)";
  if (value.price_before !== null && (!Number.isFinite(value.price_before) || value.price_before <= value.price))
    errors.price_before = "আগের দাম এখনকার দামের চেয়ে বেশি হতে হবে, নয়তো ফাঁকা রাখুন";
  for (const k of ["thumbnail_url", "routine_url", "syllabus_url"] as const)
    if (text(raw[k], 500) && !value[k]) errors[k] = "শুধু https লিংক";
  if (value.is_published && !value.description) errors.description = "প্রকাশের আগে বিবরণ লিখুন";
  return { value, errors };
}

// ---------- দেখানো ----------
export const bn = (v: string | number) => String(v).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);
export const taka = (n: number) => "৳" + bn(Number(n).toLocaleString("en-IN"));
const BN_MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
export const bnDate = (iso: string | null) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${bn(d)} ${BN_MONTHS[m - 1]} ${bn(y)}`;
};
