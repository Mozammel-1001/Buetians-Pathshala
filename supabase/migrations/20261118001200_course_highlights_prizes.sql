-- কোর্সের বিস্তারিত পাতা (course_details.html) হুবহু: ওভারভিউর নিচে ▶ চিহ্নের হাইলাইট তালিকা,
-- আর "🏆 মাসিক মেগা পুরষ্কার" / "🎁 সাপ্তাহিক সারপ্রাইজ গিফট" এর মতো পুরস্কারের অংশ।
-- দুটোই ঐচ্ছিক; ফাঁকা থাকলে পাতায় দেখায় না। অ্যাডমিন প্যানেলের কোর্স সম্পাদনা থেকে বসে।
--   highlights: ["৫০+ লাইভ ইন্টারেক্টিভ ক্লাস", ...]   (সর্বোচ্চ ২০টি)
--   prizes:     [{"title": "🏆 মাসিক মেগা পুরষ্কার", "items": ["১ম পুরষ্কার - স্মার্টওয়াচ", ...]}, ...]
alter table public.courses
  add column highlights text[] not null default '{}' check (cardinality(highlights) <= 20),
  add column prizes     jsonb  not null default '[]' check (jsonb_typeof(prizes) = 'array' and jsonb_array_length(prizes) <= 6);
