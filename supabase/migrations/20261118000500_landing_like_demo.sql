-- হোমপেজ হুবহু ডেমোর (index.html) মতো: hero তে একাধিক ছবির slider, পরিসংখ্যান, কোর্স অংশের শিরোনাম, "কেন আমরা"
-- bento কার্ড, প্ল্যাটফর্ম অংশ; কোর্সে ক্যাটাগরি (ফিল্টারের বোতাম) আর ছোট ব্যাজ ("নতুন", "জনপ্রিয়")।
-- আগের শুরুর লেখা অ্যাডমিন না বদলে থাকলে ডেমোর লেখায় বদলায়; বদলে থাকলে হাত দেয় না

-- ================= কোর্স =================
alter table public.courses
  add column category text check (category is null or length(category) <= 40),   -- যেমন "একাডেমিক"
  add column badge    text check (badge is null or length(badge) <= 20);         -- কার্ডের কোণে, যেমন "নতুন"

-- ================= সাইটের লেখার নতুন অংশ =================
alter table public.site_content drop constraint site_content_key_check;
alter table public.site_content add constraint site_content_key_check
  check (key in ('hero', 'stats', 'courses', 'features', 'platform', 'branches', 'cta', 'contact', 'about', 'payment'));

insert into public.site_content (key, value) values
  ('stats', $j${"items": [
     {"value": "3035", "suffix": "+", "label": "শিক্ষার্থী"},
     {"value": "50", "suffix": "+", "label": "দক্ষ মেন্টর"},
     {"value": "1752", "suffix": "+", "label": "কোর্স সম্পন্ন"},
     {"value": "100", "suffix": "%", "label": "সাফল্যের হার"}]}$j$::jsonb),
  ('courses', $j${"title": "দক্ষতাকে নিয়ে যান", "highlight": "নতুন উচ্চতায়",
     "subtitle": "স্পষ্টতা এবং মনে রাখার সুবিধার্থে ডিজাইন করা আমাদের মেথডলজি জটিল বিষয়গুলোকে সহজ এবং বোধগম্য করে তোলে।",
     "all_label": "সকল কোর্স", "button_label": "সব কোর্স দেখুন →"}$j$::jsonb),
  ('platform', $j${"title": "কমপ্লিট ডিজিটাল", "highlight": "একাডেমিক\nপ্ল্যাটফর্ম",
     "text": "আমাদের ইন্টিগ্রেটেড সিস্টেমের সাথে\nনিরবচ্ছিন্ন শিক্ষার অভিজ্ঞতা নিন। রিয়েল-টাইম আপডেট,\nপারফরম্যান্স ট্র্যাকিং এবং তাৎক্ষণিক ফিডব্যাক সবই এক জায়গায়।",
     "image_url": "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=800&auto=format&fit=crop",
     "chip": "ইন্টিগ্রেটেড লাইভ MCQ ও CQ প্রোসেসিং",
     "app_label": "অ্যাপ ডাউনলোড করুন", "app_href": "", "web_label": "ওয়েব প্ল্যাটফর্ম", "web_href": "/sign-in"}$j$::jsonb)
on conflict (key) do nothing;

-- ================= আগের শুরুর লেখা → ডেমোর লেখা (অ্যাডমিন না বদলে থাকলে) =================
-- hero (আগের সংস্করণে একটা ছবি, অন্য লেখা)
update public.site_content set value = $j${
    "badge": "নতুন কোর্স উপলব্ধ", "title": "বুয়েটিয়ান'স পাঠশালার সাথে", "highlight": "উন্মোচন করুন\nআপনার সম্ভাবনা",
    "subtitle": "আপনার শেখার পদ্ধতিতে নিয়ে আসুন নতুন এক মাত্রা। আমাদের প্ল্যাটফর্মটি আপনার লক্ষ্যের জন্য বিশেষভাবে ডিজাইন করা হয়েছে, যা বাস্তব প্রয়োগের সাথে শিক্ষার এক অপূর্ব মেলবন্ধন তৈরি করে।",
    "images": ["/images/hero/hero-1.webp", "/images/hero/hero-2.webp", "/images/hero/hero-3.webp", "/images/hero/hero-4.webp", "/images/hero/hero-5.webp"],
    "card_kicker": "Success Story", "card_title": "Qualified Candidates",
    "primary_label": "ফ্রি ক্লাস শুরু করুন", "primary_href": "/sign-up", "secondary_label": "ডেমো দেখুন", "secondary_href": "/courses"}$j$::jsonb
 where key = 'hero'
   and value - 'secondary_href' = $j${
    "badge": "নতুন কোর্স উপলব্ধ", "title": "বুয়েটিয়ান'স পাঠশালার সাথে", "highlight": "উন্মোচন করুন আপনার সম্ভাবনা",
    "subtitle": "লাইভ ক্লাস, রেকর্ডেড লেকচার, সাপ্তাহিক পরীক্ষা আর খাতা দেখে মন্তব্য: HSC আর ভর্তি পরীক্ষার পুরো প্রস্তুতি এক জায়গায়।",
    "image_url": "", "primary_label": "কোর্স দেখুন", "primary_href": "#courses", "secondary_label": "অ্যাকাউন্ট খুলুন"}$j$::jsonb;

-- "কেন আমরা" (আগে ৪টা সাধারণ কার্ড)
update public.site_content set value = $j${
    "title": "শিক্ষার্থীরা কেন আমাদের", "highlight": "বেছে নেয়?",
    "items": [
      {"variant": "large", "icon": "videocam", "title": "লাইভ রিয়েল-টাইম\nএক্সাম", "text": "রিয়েল-টাইম প্রতিযোগিতামূলক অভিজ্ঞতা", "points": "তাৎক্ষণিক পারফরম্যান্স বিশ্লেষণ\nলাইভ লিডারবোর্ড র‍্যাংকিং", "image_url": ""},
      {"variant": "plain", "icon": "", "title": "কমপ্লিট মডেল টেস্ট", "text": "", "points": "অধ্যায়-ভিত্তিক পরীক্ষা\nবোর্ড স্ট্যান্ডার্ড প্রশ্ন", "image_url": ""},
      {"variant": "gradient", "icon": "", "title": "SuperSolve", "text": "যেকোনো একাডেমিক সমস্যার জন্য ২৪/৭ এআই-চালিত তাৎক্ষণিক সমাধান নেটওয়ার্ক।", "points": "", "image_url": ""},
      {"variant": "image", "icon": "", "title": "রিয়েল-টাইম অ্যানালিটিক্স", "text": "নিজের অগ্রগতি স্বচক্ষে দেখুন", "points": "", "image_url": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=800&auto=format&fit=crop"},
      {"variant": "plain", "icon": "", "title": "প্র্যাকটিস ইঞ্জিন", "text": "", "points": "অসংখ্য স্বয়ংক্রিয় প্রশ্ন\nঅ্যাডাপ্টিভ ডিফিকাল্টি স্কেলিং", "image_url": ""}]}$j$::jsonb
 where key = 'features' and value = $j${
    "title": "শিক্ষার্থীরা কেন আমাদের বেছে নেয়?",
    "items": [
      {"icon": "videocam", "title": "লাইভ রিয়েল-টাইম এক্সাম", "text": "প্রতিযোগিতার অভিজ্ঞতা, সাথে সাথে ফল আর মেধাক্রম।"},
      {"icon": "quiz", "title": "কমপ্লিট মডেল টেস্ট", "text": "অধ্যায়ভিত্তিক পরীক্ষা, বোর্ড স্ট্যান্ডার্ড প্রশ্ন।"},
      {"icon": "rate_review", "title": "খাতা দেখে মন্তব্য", "text": "লিখিত উত্তরের খাতা বুয়েটিয়ানরা দেখে নম্বর আর মন্তব্য দেন।"},
      {"icon": "monitoring", "title": "নিজের অগ্রগতি", "text": "কোন অধ্যায়ে কতটা এগোলেন, নিজেই দেখুন।"}]}$j$::jsonb;

-- ব্রাঞ্চ: ডেমোর নমুনা ব্রাঞ্চ (আসল না হলে অ্যাডমিন প্যানেলে বদলান বা মুছুন)
update public.site_content set value = $j${
    "title": "আমাদের", "highlight": "ব্রাঞ্চসমূহ",
    "items": [
      {"name": "মেইন ক্যাম্পাস", "address": "ঢাকা", "phone": "", "map_url": ""},
      {"name": "নর্থ ব্রাঞ্চ", "address": "উত্তরা", "phone": "", "map_url": ""},
      {"name": "সাউথ ব্রাঞ্চ", "address": "যাত্রাবাড়ী", "phone": "", "map_url": ""},
      {"name": "সেন্ট্রাল হাব", "address": "মিরপুর", "phone": "", "map_url": ""},
      {"name": "ইস্ট ব্রাঞ্চ", "address": "বাড্ডা", "phone": "", "map_url": ""},
      {"name": "ওয়েস্ট ব্রাঞ্চ", "address": "মোহাম্মদপুর", "phone": "", "map_url": ""}]}$j$::jsonb
 where key = 'branches' and value = $j${"title": "আমাদের ব্রাঞ্চসমূহ", "items": []}$j$::jsonb;

-- শেষের আহ্বান
update public.site_content set value = $j${
    "title": "আপনার ভবিষ্যৎ পরিবর্তন করতে প্রস্তুত?",
    "text": "হাজারো শিক্ষার্থীর সাথে যোগ দিন যারা বুয়েটিয়ান'স পাঠশালা-র মাধ্যমে নিজেদের ক্যারিয়ারকে এগিয়ে নিচ্ছেন।",
    "button_label": "আজই ফ্রি-তে যুক্ত হোন", "button_href": "/sign-up"}$j$::jsonb
 where key = 'cta' and value - 'button_href' = $j${
    "title": "আপনার ভবিষ্যৎ পরিবর্তন করতে প্রস্তুত?",
    "text": "হাজারো শিক্ষার্থীর সাথে যোগ দিন যারা বুয়েটিয়ান'স পাঠশালার সাথে নিজেদের এগিয়ে নিচ্ছে।",
    "button_label": "আজই যুক্ত হোন"}$j$::jsonb;

-- ফুটারের লেখা (যোগাযোগের ঘর অ্যাডমিন না ভরে থাকলে)
update public.site_content
   set value = value || $j${"footer_text": "নির্ভুল শিক্ষা এবং উন্নত কারিকুলাম ডিজাইনের মাধ্যমে শিক্ষার্থীদের ক্ষমতায়ন।", "instagram": "", "telegram": ""}$j$::jsonb
 where key = 'contact' and value->>'footer_text' = 'HSC আর বিশ্ববিদ্যালয় ভর্তি পরীক্ষার প্রস্তুতি, বুয়েটিয়ানদের হাতে।';
