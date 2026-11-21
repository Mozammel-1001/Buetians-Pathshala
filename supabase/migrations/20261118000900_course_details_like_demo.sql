-- কোর্সের বিস্তারিত পাতা (course_details.html) হুবহু: "মাধ্যম", "মোট আসন" আর প্রোমো ভিডিওর লিংক।
-- সব ঐচ্ছিক; ফাঁকা থাকলে পাতায় সেই অংশ দেখায় না। অ্যাডমিন প্যানেলের কোর্স সম্পাদনা থেকে বসে
alter table public.courses
  add column medium          text check (medium is null or length(medium) <= 40),               -- যেমন "বাংলা"
  add column total_seats     int  check (total_seats is null or total_seats between 1 and 100000),
  add column promo_video_url text check (promo_video_url is null or promo_video_url ~ '^https://');
