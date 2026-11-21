// সাইটের লেখা আর কোর্সের তথ্য: ধরন, শুরুর মান, যাচাই আর দেখানোর সাহায্যকারী। browser আর server দুই জায়গাতেই
// চলে (অ্যাডমিনের ফর্মেও লাগে)। database থেকে পড়া content.ts এ
import { toAsciiDigits } from "@/lib/validation";

// ---------- ধরন ----------
// হোমপেজ হুবহু ডেমোর (index.html) মতো; প্রতিটি অংশের লেখা আর ছবি অ্যাডমিন প্যানেল থেকে
export type Hero = {
  badge: string;
  title: string;        // শিরোনামের প্রথম অংশ, সবুজ
  highlight: string;    // বাকি অংশ (নতুন লাইন চলে)
  subtitle: string;
  images: string[];     // ডানের slider এর ছবি (৩ সেকেন্ড পরপর বদলায়)
  card_kicker: string;  // ছবির কোণের ছোট কার্ড: উপরের ছোট লেখা
  card_title: string;   //   আর বড় লেখা
  primary_label: string; primary_href: string; secondary_label: string; secondary_href: string;
};
export type Stat = { value: string; suffix: string; label: string };
export type FeatureVariant = "large" | "plain" | "gradient" | "image";
export type Feature = { variant: FeatureVariant; icon: string; title: string; text: string; points: string; image_url: string };
export type Branch = { name: string; address: string; phone: string; map_url: string };
// আমাদের সম্পর্কে পাতা (হুবহু ডেমোর about_us.html): রং বেছে নেওয়া যায়, আইকন Material Symbols এর নাম
export type Tone = "green" | "blue" | "purple" | "emerald" | "orange" | "pink" | "yellow";
export const TONE_LABELS: Record<Tone, string> = { green: "সবুজ", blue: "নীল", purple: "বেগুনি", emerald: "পান্না", orange: "কমলা", pink: "গোলাপি", yellow: "হলুদ" };
const TONES = Object.keys(TONE_LABELS) as Tone[];
export type AboutBlock = { label: string; title: string; text: string; tags: string };   // tags: প্রতি লাইনে একটা
export type AboutStat = { icon: string; tone: Tone; value: string; suffix: string; label: string };
export type AboutWhy = { icon: string; tone: Tone; title: string; text: string };
export type SiteContent = {
  hero: Hero;
  stats: { items: Stat[] };
  courses: {
    title: string; highlight: string; subtitle: string; all_label: string; button_label: string;
    // সব কোর্সের পাতার (/courses) শিরোনাম আর বর্ণনা
    page_title: string; page_highlight: string; page_subtitle: string;
  };
  features: { title: string; highlight: string; items: Feature[] };
  platform: { title: string; highlight: string; text: string; image_url: string; chip: string; app_label: string; app_href: string; web_label: string; web_href: string };
  branches: { title: string; highlight: string; items: Branch[] };
  cta: { title: string; text: string; button_label: string; button_href: string };
  contact: { phone: string; whatsapp: string; email: string; address: string; facebook: string; youtube: string; instagram: string; telegram: string; footer_text: string };
  about: {
    badge: string; title: string; highlight: string; subtitle: string;
    mission: AboutBlock; vision: AboutBlock;
    stats: AboutStat[];
    why: { chip: string; title: string; highlight: string; items: AboutWhy[] };
  };
  payment: { bkash_number: string; account_type: "personal" | "agent" | "merchant"; note: string; review_time: string };
};
export type SectionKey = keyof SiteContent;
export const SECTION_KEYS: SectionKey[] = ["hero", "stats", "courses", "features", "platform", "branches", "cta", "contact", "about", "payment"];
export const FEATURE_VARIANTS: Record<FeatureVariant, string> = { large: "বড় (দুই সারি জুড়ে)", plain: "সাধারণ", gradient: "রঙিন", image: "ছবির উপর লেখা" };

export type RoutineRow = { day: string; time: string; topic: string };
export type Faq = { q: string; a: string };
export type PrizeGroup = { title: string; items: string[] };
export type Course = {
  id: number; slug: string; title: string; subtitle: string | null; description: string | null;
  key_points: string[]; highlights: string[]; prizes: PrizeGroup[]; price: number; price_before: number | null; thumbnail_url: string | null;
  category: string | null; badge: string | null;
  batch_name: string | null; starts_on: string | null; enroll_deadline: string | null;
  class_schedule: string | null; duration_label: string | null;
  medium: string | null; total_seats: number | null; promo_video_url: string | null;
  routine: RoutineRow[]; faqs: Faq[]; routine_url: string | null; syllabus_url: string | null;
  is_published: boolean; position: number; updated_at: string;
};
export const COURSE_COLUMNS =
  "id, slug, title, subtitle, description, key_points, highlights, prizes, price, price_before, thumbnail_url, category, badge, batch_name, starts_on, enroll_deadline, " +
  "class_schedule, duration_label, medium, total_seats, promo_video_url, routine, faqs, routine_url, syllabus_url, is_published, position, updated_at";

// ---------- শুরুর মান: ডেমো সাইটের (index.html) লেখা হুবহু ----------
const UNSPLASH = (id: string) => `https://images.unsplash.com/${id}?q=80&w=800&auto=format&fit=crop`;
export const DEFAULT_CONTENT: SiteContent = {
  hero: {
    badge: "নতুন কোর্স উপলব্ধ",
    title: "বুয়েটিয়ান'স পাঠশালার সাথে",
    highlight: "উন্মোচন করুন\nআপনার সম্ভাবনা",
    subtitle: "আপনার শেখার পদ্ধতিতে নিয়ে আসুন নতুন এক মাত্রা। আমাদের প্ল্যাটফর্মটি আপনার লক্ষ্যের জন্য বিশেষভাবে ডিজাইন করা হয়েছে, যা বাস্তব প্রয়োগের সাথে শিক্ষার এক অপূর্ব মেলবন্ধন তৈরি করে।",
    images: [],   // অ্যাডমিন প্যানেল → সাইটের লেখা → hero থেকে আপলোড; না থাকলে শুধু লেখা, মাঝখানে
    card_kicker: "Success Story", card_title: "Qualified Candidates",
    primary_label: "Join Now", primary_href: "/sign-up",
    secondary_label: "ডেমো দেখুন", secondary_href: "/courses",
  },
  stats: {
    items: [
      { value: "3035", suffix: "+", label: "শিক্ষার্থী" },
      { value: "50", suffix: "+", label: "দক্ষ মেন্টর" },
      { value: "1752", suffix: "+", label: "কোর্স সম্পন্ন" },
      { value: "100", suffix: "%", label: "সাফল্যের হার" },
    ],
  },
  courses: {
    title: "দক্ষতাকে নিয়ে যান", highlight: "নতুন উচ্চতায়",
    subtitle: "স্পষ্টতা এবং মনে রাখার সুবিধার্থে ডিজাইন করা আমাদের মেথডলজি জটিল বিষয়গুলোকে সহজ এবং বোধগম্য করে তোলে।",
    all_label: "সকল কোর্স", button_label: "সব কোর্স দেখুন →",
    page_title: "আমাদের", page_highlight: "সকল কোর্স এবং প্রোগ্রাম",
    page_subtitle: "আপনার সাফল্যের জন্য বিশেষভাবে ডিজাইন করা আমাদের অ্যাকাডেমিক এবং স্কিল ডেভেলপমেন্ট প্রোগ্রামগুলো অন্বেষণ করুন। আপনার যাত্রা শুরু করতে আজই এনরোল করুন।",
  },
  features: {
    title: "শিক্ষার্থীরা কেন আমাদের", highlight: "বেছে নেয়?",
    items: [
      { variant: "large", icon: "videocam", title: "লাইভ রিয়েল-টাইম\nএক্সাম", text: "রিয়েল-টাইম প্রতিযোগিতামূলক অভিজ্ঞতা", points: "তাৎক্ষণিক পারফরম্যান্স বিশ্লেষণ\nলাইভ লিডারবোর্ড র\u200d্যাংকিং", image_url: "" },
      { variant: "plain", icon: "", title: "কমপ্লিট মডেল টেস্ট", text: "", points: "অধ্যায়-ভিত্তিক পরীক্ষা\nবোর্ড স্ট্যান্ডার্ড প্রশ্ন", image_url: "" },
      { variant: "gradient", icon: "", title: "SuperSolve", text: "যেকোনো একাডেমিক সমস্যার জন্য ২৪/৭ এআই-চালিত তাৎক্ষণিক সমাধান নেটওয়ার্ক।", points: "", image_url: "" },
      { variant: "image", icon: "", title: "রিয়েল-টাইম অ্যানালিটিক্স", text: "নিজের অগ্রগতি স্বচক্ষে দেখুন", points: "", image_url: UNSPLASH("photo-1551288049-bebda4e38f71") },
      { variant: "plain", icon: "", title: "প্র্যাকটিস ইঞ্জিন", text: "", points: "অসংখ্য স্বয়ংক্রিয় প্রশ্ন\nঅ্যাডাপ্টিভ ডিফিকাল্টি স্কেলিং", image_url: "" },
    ],
  },
  platform: {
    title: "কমপ্লিট ডিজিটাল", highlight: "একাডেমিক\nপ্ল্যাটফর্ম",
    text: "আমাদের ইন্টিগ্রেটেড সিস্টেমের সাথে\nনিরবচ্ছিন্ন শিক্ষার অভিজ্ঞতা নিন। রিয়েল-টাইম আপডেট,\nপারফরম্যান্স ট্র্যাকিং এবং তাৎক্ষণিক ফিডব্যাক সবই এক জায়গায়।",
    image_url: UNSPLASH("photo-1512941937669-90a1b58e7e9c"), chip: "ইন্টিগ্রেটেড লাইভ MCQ ও CQ প্রোসেসিং",
    app_label: "অ্যাপ ডাউনলোড করুন", app_href: "", web_label: "ওয়েব প্ল্যাটফর্ম", web_href: "/sign-in",
  },
  branches: {
    title: "আমাদের", highlight: "ব্রাঞ্চসমূহ",
    items: [
      ["মেইন ক্যাম্পাস", "ঢাকা"], ["নর্থ ব্রাঞ্চ", "উত্তরা"], ["সাউথ ব্রাঞ্চ", "যাত্রাবাড়ী"],
      ["সেন্ট্রাল হাব", "মিরপুর"], ["ইস্ট ব্রাঞ্চ", "বাড্ডা"], ["ওয়েস্ট ব্রাঞ্চ", "মোহাম্মদপুর"],
    ].map(([name, address]) => ({ name, address, phone: "", map_url: "" })),
  },
  cta: {
    title: "আপনার ভবিষ্যৎ পরিবর্তন করতে প্রস্তুত?",
    text: "হাজারো শিক্ষার্থীর সাথে যোগ দিন যারা বুয়েটিয়ান'স পাঠশালা-র মাধ্যমে নিজেদের ক্যারিয়ারকে এগিয়ে নিচ্ছেন।",
    button_label: "আজই ফ্রি-তে যুক্ত হোন", button_href: "/sign-up",
  },
  contact: {
    phone: "", whatsapp: "", email: "", address: "", facebook: "", youtube: "", instagram: "", telegram: "",
    footer_text: "নির্ভুল শিক্ষা এবং উন্নত কারিকুলাম ডিজাইনের মাধ্যমে শিক্ষার্থীদের ক্ষমতায়ন।",
  },
  about: {
    badge: "কোর্সের বিস্তারিত",
    title: "পূর্ণাঙ্গ",
    highlight: "স্টাডি প্ল্যান",
    subtitle: "আমাদের সতর্কতার সাথে তৈরি করা কোর্স মডিউলগুলোর মাধ্যমে আপনার সুপ্ত সম্ভাবনাকে জাগ্রত করুন। আপনার ক্যারিয়ার এবং একাডেমিক লক্ষ্য অর্জনে ঠিক যে দক্ষতাগুলো প্রয়োজন, তা প্রদানের জন্য ইন্ডাস্ট্রি বিশেষজ্ঞদের দ্বারা এটি ডিজাইন করা হয়েছে।",
    mission: {
      label: "লক্ষ্য",
      title: "আমাদের লক্ষ্য",
      text: "সহজলভ্য, আধুনিক রিসোর্স এবং ইন্টারেক্টিভ শেখার অভিজ্ঞতার মাধ্যমে মানসম্মত শিক্ষাকে সবার জন্য উন্মুক্ত করা, যা বিশ্বব্যাপী শিক্ষার্থীদের তাদের পেশাগত ও ব্যক্তিগত লক্ষ্য অর্জনে ক্ষমতায়ন করে।",
      tags: "মানসম্মত কন্টেন্ট\nগ্লোবাল রিচ\nউদ্ভাবন",
    },
    vision: {
      label: "রূপকল্প",
      title: "আমাদের রূপকল্প",
      text: "তাত্ত্বিক জ্ঞান এবং বাস্তব প্রয়োগের মধ্যে ব্যবধান দূর করে একটি প্রতিনিয়ত বিকাশমান, প্রযুক্তি-নির্ভর কারিকুলামের মাধ্যমে দক্ষতা উন্নয়নের জন্য বিশ্বের শীর্ষস্থানীয় ডিজিটাল প্ল্যাটফর্ম হয়ে ওঠা।",
      tags: "ভবিষ্যতের জন্য প্রস্তুত\nইন্ডাস্ট্রি লিডার\nদক্ষতা নির্ভর",
    },
    stats: [
      {
        icon: "group",
        tone: "green",
        value: "3043",
        suffix: "+",
        label: "শিক্ষার্থী",
      },
      {
        icon: "person_play",
        tone: "blue",
        value: "22",
        suffix: "+",
        label: "ইনস্ট্রাক্টর",
      },
      {
        icon: "verified",
        tone: "purple",
        value: "9",
        suffix: "+",
        label: "বছর",
      },
      {
        icon: "menu_book",
        tone: "emerald",
        value: "686",
        suffix: "+",
        label: "কোর্স",
      },
    ],
    why: {
      chip: "প্ল্যাটফর্মের বৈশিষ্ট্য",
      title: "আমরা কেন",
      highlight: "আলাদা?",
      items: [
        {
          icon: "lightbulb",
          tone: "orange",
          title: "ইন্টারেক্টিভ লার্নিং",
          text: "জটিল বিষয়গুলোকে সহজ ও ব্যবহারিক করে তুলতে আমাদের ডায়নামিক কন্টেন্টের সাথে যুক্ত হন।",
        },
        {
          icon: "workspace_premium",
          tone: "blue",
          title: "দক্ষ ইনস্ট্রাক্টর",
          text: "সরাসরি ইন্ডাস্ট্রি বিশেষজ্ঞদের কাছ থেকে শিখুন যাদের রয়েছে প্রতিটি লেসনের বাস্তব অভিজ্ঞতা।",
        },
        {
          icon: "schedule",
          tone: "emerald",
          title: "সুবিধাজনক সময়সূচী",
          text: "যেকোনো সময়, যেকোনো স্থান থেকে কোর্সের ম্যাটেরিয়াল অ্যাক্সেস করুন। আপনার নিজের গতিতে শিখুন।",
        },
        {
          icon: "support_agent",
          tone: "purple",
          title: "২৪/৭ সাপোর্ট",
          text: "আমাদের নিবেদিত স্টুডেন্ট সাপোর্ট টিমের মাধ্যমে যেকোনো সময় আপনার প্রশ্নের তাৎক্ষণিক উত্তর পান।",
        },
        {
          icon: "build",
          tone: "pink",
          title: "লাইভ প্রজেক্ট",
          text: "প্রকৃত ইন্ডাস্ট্রির চাহিদা পূরণ করে এমন বাস্তবসম্মত প্রজেক্টে কাজ করে একটি শক্তিশালী পোর্টফোলিও তৈরি করুন।",
        },
        {
          icon: "trending_up",
          tone: "yellow",
          title: "ক্যারিয়ার গাইডেন্স",
          text: "ব্যক্তিগত ক্যারিয়ার কোচিং, রিজিউম রিভিউ এবং চাকরিদাতাদের সাথে সরাসরি যোগাযোগের সুযোগ পান।",
        },
      ],
    },
  },
  payment: { bkash_number: "", account_type: "personal", note: "", review_time: "" },
};
export const ACCOUNT_TYPES = { personal: "পার্সোনাল", agent: "এজেন্ট", merchant: "মার্চেন্ট" } as const;

// ---------- যাচাই ----------
// সব লেখা সাধারণ লেখা হিসেবে দেখানো হয় (HTML নয়), তাই লেখায় ঝুঁকি নেই। ঝুঁকি লিংকে: javascript: ইত্যাদি আটকানো
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "");

export const isSafeHref = (v: string) => v === "" || /^(\/(?!\/)|#|https:\/\/|http:\/\/localhost|tel:|mailto:)/i.test(v);
export const isSafeUrl = (v: string) =>
  v === "" || /^https:\/\//i.test(v) || /^http:\/\/(localhost|127\.0\.0\.1)/i.test(v) || /^\/(?!\/)[\w\-./%]+$/.test(v);  // সাইটের নিজের ছবি (/images/...)

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
  // আগের সংস্করণে পুরো শিরোনাম এক ঘরে ছিল, সবুজ অংশ আলাদা ছিল না: তখন সবুজ অংশ ফাঁকা (শুরুর মান জুড়লে লেখা দুবার আসত)
  const pickHl = (fallback: string) => ("highlight" in r ? text(r.highlight, 120) : "title" in r ? "" : fallback);
  switch (key) {
    case "hero": {
      // আগের সংস্করণে একটাই ছবি ছিল (image_url): থাকলে সেটাই slider এর ছবি
      const imgs = "images" in r ? (Array.isArray(r.images) ? r.images : []).map(url).filter(Boolean).slice(0, 8)
        : r.image_url ? [url(r.image_url)].filter(Boolean) : d.hero.images;
      return {
        badge: pick("badge", 60, d.hero.badge), title: pick("title", 120, d.hero.title), highlight: pick("highlight", 160, d.hero.highlight),
        subtitle: pick("subtitle", 400, d.hero.subtitle), images: imgs,
        card_kicker: pick("card_kicker", 40, d.hero.card_kicker), card_title: pick("card_title", 60, d.hero.card_title),
        primary_label: pick("primary_label", 40, d.hero.primary_label), primary_href: "primary_href" in r ? href(r.primary_href) : d.hero.primary_href,
        secondary_label: pick("secondary_label", 40, d.hero.secondary_label), secondary_href: "secondary_href" in r ? href(r.secondary_href) : d.hero.secondary_href,
      } as SiteContent[K];
    }
    case "stats":
      return {
        items: "items" in r
          ? list(r.items, 6, (x) => ({ value: toAsciiDigits(text(x.value, 12)).replace(/[^\d.]/g, ""), suffix: text(x.suffix, 4), label: text(x.label, 40) }), (x) => !!x.value && !!x.label)
          : d.stats.items,
      } as SiteContent[K];
    case "courses":
      return {
        title: pick("title", 120, d.courses.title), highlight: pick("highlight", 120, d.courses.highlight), subtitle: pick("subtitle", 400, d.courses.subtitle),
        all_label: pick("all_label", 30, d.courses.all_label), button_label: pick("button_label", 40, d.courses.button_label),
        page_title: pick("page_title", 80, d.courses.page_title), page_highlight: pick("page_highlight", 120, d.courses.page_highlight),
        page_subtitle: pick("page_subtitle", 400, d.courses.page_subtitle),
      } as SiteContent[K];
    case "features": {
      const variant = (v: unknown): FeatureVariant => (v === "large" || v === "gradient" || v === "image" ? v : "plain");
      return {
        title: pick("title", 120, d.features.title), highlight: pickHl(d.features.highlight),
        items: "items" in r
          ? list(r.items, 12, (x) => ({
              variant: variant(x.variant), icon: x.icon ? icon(x.icon) : "", title: text(x.title, 80), text: text(x.text, 300),
              points: text(x.points, 600), image_url: url(x.image_url),
            }), (x) => !!x.title)
          : d.features.items,
      } as SiteContent[K];
    }
    case "platform":
      return {
        title: pick("title", 80, d.platform.title), highlight: pick("highlight", 120, d.platform.highlight), text: pick("text", 600, d.platform.text),
        image_url: "image_url" in r ? url(r.image_url) : d.platform.image_url, chip: pick("chip", 80, d.platform.chip),
        app_label: pick("app_label", 40, d.platform.app_label), app_href: "app_href" in r ? href(r.app_href) : d.platform.app_href,
        web_label: pick("web_label", 40, d.platform.web_label), web_href: "web_href" in r ? href(r.web_href) : d.platform.web_href,
      } as SiteContent[K];
    case "branches":
      return {
        title: pick("title", 120, d.branches.title), highlight: pickHl(d.branches.highlight),
        items: "items" in r
          ? list(r.items, 24, (x) => ({ name: text(x.name, 80), address: text(x.address, 200), phone: text(x.phone, 40), map_url: url(x.map_url) }), (x) => !!x.name)
          : d.branches.items,
      } as SiteContent[K];
    case "cta":
      return {
        title: pick("title", 120, d.cta.title), text: pick("text", 300, d.cta.text), button_label: pick("button_label", 40, d.cta.button_label),
        button_href: "button_href" in r ? href(r.button_href) : d.cta.button_href,
      } as SiteContent[K];
    case "contact":
      return {
        phone: pick("phone", 40), whatsapp: pick("whatsapp", 40), email: pick("email", 120), address: pick("address", 300),
        facebook: url(r.facebook), youtube: url(r.youtube), instagram: url(r.instagram), telegram: url(r.telegram),
        footer_text: pick("footer_text", 300, d.contact.footer_text),
      } as SiteContent[K];
    case "about": {
      const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
      const tone = (v: unknown): Tone => (TONES.includes(v as Tone) ? (v as Tone) : "green");
      // আগের সংস্করণে mission/vision সাধারণ লেখা ছিল (object নয়): তখন শুরুর মান
      const block = (raw: unknown, fb: AboutBlock): AboutBlock => {
        const x = obj(raw);
        const g = (k: keyof AboutBlock, max: number) => (k in x ? text(x[k], max) : fb[k]);
        return { label: g("label", 30), title: g("title", 80), text: g("text", 1200), tags: g("tags", 400) };
      };
      const w = obj(r.why);
      const g = (k: string, max: number, fb: string) => (k in w ? text(w[k], max) : fb);
      return {
        badge: pick("badge", 60, d.about.badge), title: pick("title", 120, d.about.title), highlight: pick("highlight", 120, d.about.highlight),
        subtitle: pick("subtitle", 800, d.about.subtitle),
        mission: block(r.mission, d.about.mission), vision: block(r.vision, d.about.vision),
        stats: Array.isArray(r.stats)
          ? list(r.stats, 6, (x) => ({ icon: x.icon ? icon(x.icon) : "check_circle", tone: tone(x.tone), value: toAsciiDigits(text(x.value, 12)).replace(/[^\d.]/g, ""), suffix: text(x.suffix, 4), label: text(x.label, 40) }), (x) => !!x.value && !!x.label)
          : d.about.stats,
        why: {
          chip: g("chip", 60, d.about.why.chip), title: g("title", 80, d.about.why.title), highlight: g("highlight", 80, d.about.why.highlight),
          items: Array.isArray(w.items)
            ? list(w.items, 12, (x) => ({ icon: x.icon ? icon(x.icon) : "check_circle", tone: tone(x.tone), title: text(x.title, 80), text: text(x.text, 300) }), (x) => !!x.title)
            : d.about.why.items,
        },
      } as SiteContent[K];
    }
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
    highlights: (Array.isArray(raw.highlights) ? raw.highlights : []).map((k) => text(k, 150)).filter(Boolean).slice(0, 20),
    prizes: list(raw.prizes, 6, (x) => ({ title: text(x.title, 80), items: (Array.isArray(x.items) ? x.items : []).map((i) => text(i, 120)).filter(Boolean).slice(0, 10) }), (x) => !!(x.title && x.items.length)),
    price: money(raw.price) ?? NaN,
    price_before: money(raw.price_before),
    thumbnail_url: url(raw.thumbnail_url) || null,
    category: opt(raw.category, 40),
    badge: opt(raw.badge, 20),
    batch_name: opt(raw.batch_name, 80),
    starts_on: date(raw.starts_on),
    enroll_deadline: date(raw.enroll_deadline),
    class_schedule: opt(raw.class_schedule, 150),
    duration_label: opt(raw.duration_label, 40),
    medium: opt(raw.medium, 40),
    total_seats: (() => { const n = Math.trunc(Number(toAsciiDigits(String(raw.total_seats ?? "")))); return n > 0 && n <= 100000 ? n : null; })(),
    promo_video_url: url(raw.promo_video_url) || null,
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
  for (const k of ["thumbnail_url", "routine_url", "syllabus_url", "promo_video_url"] as const)
    if (text(raw[k], 500) && !value[k]) errors[k] = "শুধু https লিংক";
  if (value.is_published && !value.description) errors.description = "প্রকাশের আগে বিবরণ লিখুন";
  return { value, errors };
}

// ---------- দেখানো ----------
export const bn = (v: string | number) => String(v).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);
export const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
export const taka = (n: number) => "৳" + bn(Number(n).toLocaleString("en-IN"));
const BN_MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
export const bnDate = (iso: string | null) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${bn(d)} ${BN_MONTHS[m - 1]} ${bn(y)}`;
};
