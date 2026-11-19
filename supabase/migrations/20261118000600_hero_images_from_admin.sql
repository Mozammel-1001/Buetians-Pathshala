-- hero এর ছবি আর সাইটের কোডে বসানো থাকে না: অ্যাডমিন প্যানেল → সাইটের লেখা → hero থেকে আপলোড হয়।
-- আগের migration যে ৫টা ছবির ঠিকানা বসিয়েছিল (/images/hero/hero-1..5.webp, ফাইলগুলো এখন নেই), সেগুলো তুলে দেওয়া।
-- অ্যাডমিন নিজে ছবি দিয়ে বা ক্রম বদলে থাকলে হাত দেয় না
update public.site_content
   set value = jsonb_set(value, '{images}', '[]'::jsonb)
 where key = 'hero'
   and value->'images' = '["/images/hero/hero-1.webp", "/images/hero/hero-2.webp", "/images/hero/hero-3.webp", "/images/hero/hero-4.webp", "/images/hero/hero-5.webp"]'::jsonb;
