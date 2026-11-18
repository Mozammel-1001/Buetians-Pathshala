-- শুধু development এর নমুনা ডেটা (production এ চালাবেন না)। SQL Editor এ চালান, বা local এ `supabase db reset`
insert into public.courses (slug, title, description, key_points, price, is_published) values
  ('hsc-math-1st', 'উচ্চতর গণিত ১ম পত্র', 'HSC উচ্চতর গণিত ১ম পত্রের পুরো সিলেবাস: লাইভ ক্লাস, রেকর্ডেড লেকচার আর সাপ্তাহিক পরীক্ষা।',
   array['৮+ মডিউল', 'লাইভ প্রশ্নোত্তর', 'সাপ্তাহিক MCQ ও লিখিত পরীক্ষা'], 2500, true),
  ('eng-math', 'ইঞ্জিনিয়ারিং গণিত প্রস্তুতি', 'বুয়েট, কুয়েট, রুয়েট ভর্তি পরীক্ষার গণিত: অন্তরীকরণ, যোগজীকরণ, ম্যাট্রিক্স।',
   array['ভর্তি পরীক্ষার প্রশ্নব্যাংক', 'মডেল টেস্ট', 'খাতা দেখে মন্তব্য'], 3500, true),
  ('hsc-physics-1st', 'পদার্থবিজ্ঞান ১ম পত্র', 'ভেক্টর থেকে কাজ, শক্তি ও ক্ষমতা পর্যন্ত।', array['লাইভ ক্লাস', 'অধ্যায়ভিত্তিক পরীক্ষা'], 2500, false)
on conflict (slug) do nothing;

insert into public.subjects (course_id, name, position)
select id, 'গণিত', 1 from public.courses where slug in ('hsc-math-1st', 'eng-math')
on conflict do nothing;

insert into public.chapters (course_id, subject_id, title, position)
select s.course_id, s.id, t.title, t.pos
  from public.subjects s join public.courses c on c.id = s.course_id
  cross join lateral (values ('সরলরেখা', 1), ('বৃত্ত', 2), ('ম্যাট্রিক্স', 3)) t(title, pos)
 where c.slug = 'hsc-math-1st'
on conflict do nothing;
