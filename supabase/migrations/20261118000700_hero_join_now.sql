-- hero এর প্রধান বোতাম: "ফ্রি ক্লাস শুরু করুন" → "Join Now" (অ্যাডমিন অন্য লেখা দিয়ে থাকলে হাত দেয় না)
update public.site_content
   set value = jsonb_set(value, '{primary_label}', '"Join Now"')
 where key = 'hero' and value->>'primary_label' = 'ফ্রি ক্লাস শুরু করুন';
