-- সাইটের সব লেখা আর ছবি অ্যাডমিন প্যানেল থেকে: কোর্সের ছবি, বিবরণ, মূল বিষয়, রুটিন, দাম, ব্যাচ;
-- হোমপেজের hero (ছবিসহ), "কেন আমরা", ব্রাঞ্চ, যোগাযোগ, আমাদের সম্পর্কে।
-- বদলাতে পারেন শুধু admin; কে কখন কী বদলালেন audit_logs এ থাকে

-- ================= কোর্সের বাড়তি তথ্য =================
alter table public.courses
  add column subtitle        text,                         -- শিরোনামের নিচের এক লাইন
  add column price_before    numeric(10,2),                -- ছাড়ের আগের দাম (কেটে দেখানো হয়)
  add column batch_name      text,                         -- যেমন "HSC ২৭ ব্যাচ"
  add column starts_on       date,                         -- ক্লাস শুরু
  add column enroll_deadline date,                         -- ভর্তির শেষ দিন
  add column class_schedule  text,                         -- যেমন "সপ্তাহে ৩ দিন, রাত ৮টা"
  add column duration_label  text,                         -- যেমন "৬ মাস"
  add column routine         jsonb not null default '[]',  -- [{day, time, topic}]: "শনিবার" বা "১২ জানুয়ারি"
  add column faqs            jsonb not null default '[]',  -- [{q, a}]
  add column routine_url     text,                         -- রুটিনের PDF/ছবি (ঐচ্ছিক)
  add column syllabus_url    text,                         -- সিলেবাসের PDF (ঐচ্ছিক)
  add column position        int not null default 0,       -- হোমপেজে কোনটা আগে
  add column updated_at      timestamptz not null default now(),
  add constraint courses_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  add constraint courses_price_before check (price_before is null or price_before > price),
  add constraint courses_routine_array check (jsonb_typeof(routine) = 'array'),
  add constraint courses_faqs_array check (jsonb_typeof(faqs) = 'array');

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger courses_touch before update on public.courses
  for each row execute function public.touch_updated_at();

-- কোর্স বানানো, বদলানো, মোছা: শুধু admin। ভর্তি বা পেমেন্ট থাকা কোর্স মোছা যায় না (foreign key),
-- সেগুলো "অপ্রকাশিত" করে রাখতে হয়
create policy courses_admin_insert on public.courses for insert with check (public.my_role() = 'admin');
create policy courses_admin_update on public.courses for update
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy courses_admin_delete on public.courses for delete using (public.my_role() = 'admin');

-- ================= সাইটের লেখা =================
-- প্রতিটি অংশ এক সারি, ভেতরে JSON। ঘরগুলো কী কী তা app এর src/lib/content.ts বলে (সেখানেই যাচাই)
create table public.site_content (
  key        text primary key check (key in ('hero', 'features', 'branches', 'cta', 'contact', 'about')),
  value      jsonb not null check (jsonb_typeof(value) = 'object'),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null default auth.uid()
);

create trigger site_content_touch before update on public.site_content
  for each row execute function public.touch_updated_at();

alter table public.site_content enable row level security;
create policy site_content_read on public.site_content for select using (true);   -- লগইন ছাড়াও
create policy site_content_admin_insert on public.site_content for insert with check (public.my_role() = 'admin');
create policy site_content_admin_update on public.site_content for update
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy one_device on public.site_content as restrictive for all to authenticated
  using ((select public.session_ok())) with check ((select public.session_ok()));

-- শুরুর লেখা (ডেমো সাইট থেকে)। অ্যাডমিন প্যানেলে বদলানো যায়; খালি তালিকার অংশ সাইটে দেখায় না
insert into public.site_content (key, value) values
  ('hero', jsonb_build_object(
     'badge', 'নতুন কোর্স উপলব্ধ',
     'title', 'বুয়েটিয়ান''স পাঠশালার সাথে',
     'highlight', 'উন্মোচন করুন আপনার সম্ভাবনা',
     'subtitle', 'লাইভ ক্লাস, রেকর্ডেড লেকচার, সাপ্তাহিক পরীক্ষা আর খাতা দেখে মন্তব্য: HSC আর ভর্তি পরীক্ষার পুরো প্রস্তুতি এক জায়গায়।',
     'image_url', '',
     'primary_label', 'কোর্স দেখুন', 'primary_href', '#courses',
     'secondary_label', 'অ্যাকাউন্ট খুলুন', 'secondary_href', '/sign-in')),
  ('features', jsonb_build_object(
     'title', 'শিক্ষার্থীরা কেন আমাদের বেছে নেয়?',
     'items', jsonb_build_array(
       jsonb_build_object('icon', 'videocam', 'title', 'লাইভ রিয়েল-টাইম এক্সাম', 'text', 'প্রতিযোগিতার অভিজ্ঞতা, সাথে সাথে ফল আর মেধাক্রম।'),
       jsonb_build_object('icon', 'quiz', 'title', 'কমপ্লিট মডেল টেস্ট', 'text', 'অধ্যায়ভিত্তিক পরীক্ষা, বোর্ড স্ট্যান্ডার্ড প্রশ্ন।'),
       jsonb_build_object('icon', 'rate_review', 'title', 'খাতা দেখে মন্তব্য', 'text', 'লিখিত উত্তরের খাতা বুয়েটিয়ানরা দেখে নম্বর আর মন্তব্য দেন।'),
       jsonb_build_object('icon', 'monitoring', 'title', 'নিজের অগ্রগতি', 'text', 'কোন অধ্যায়ে কতটা এগোলেন, নিজেই দেখুন।')))),
  ('branches', jsonb_build_object('title', 'আমাদের ব্রাঞ্চসমূহ', 'items', '[]'::jsonb)),
  ('cta', jsonb_build_object(
     'title', 'আপনার ভবিষ্যৎ পরিবর্তন করতে প্রস্তুত?',
     'text', 'হাজারো শিক্ষার্থীর সাথে যোগ দিন যারা বুয়েটিয়ান''স পাঠশালার সাথে নিজেদের এগিয়ে নিচ্ছে।',
     'button_label', 'আজই যুক্ত হোন', 'button_href', '/sign-in')),
  ('contact', jsonb_build_object('phone', '', 'whatsapp', '', 'email', '', 'address', '',
     'facebook', '', 'youtube', '', 'footer_text', 'HSC আর বিশ্ববিদ্যালয় ভর্তি পরীক্ষার প্রস্তুতি, বুয়েটিয়ানদের হাতে।')),
  ('about', jsonb_build_object('title', 'আমাদের সম্পর্কে', 'intro', '', 'mission', '', 'vision', '', 'image_url', '',
     'points', '[]'::jsonb))
on conflict (key) do nothing;

-- ================= কে কী বদলালেন =================
-- কোর্স আর সাইটের লেখার প্রতিটি বদল audit_logs এ: কে, কখন, কোন ঘরগুলো (দাম বদলালে আগের আর নতুন দামও)
create function public.audit_content() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  changed text[];
  meta jsonb;
  entity_id text := coalesce(n, o)->>(case when tg_table_name = 'courses' then 'id' else 'key' end);
begin
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into changed
      from jsonb_object_keys(n) k
     where k not in ('updated_at', 'updated_by') and n->k is distinct from o->k;
    if changed is null then return null; end if;
    meta := jsonb_build_object('fields', to_jsonb(changed));
    if tg_table_name = 'courses' and 'price' = any(changed) then
      meta := meta || jsonb_build_object('price_from', o->'price', 'price_to', n->'price');
    end if;
  else
    meta := jsonb_build_object('title', coalesce(n, o)->>'title');
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), tg_table_name || '.' || lower(tg_op), tg_table_name, entity_id, meta);
  return null;
end $$;

create trigger courses_audit after insert or update or delete on public.courses
  for each row execute function public.audit_content();
create trigger site_content_audit after insert or update on public.site_content
  for each row execute function public.audit_content();

-- ================= ছবি আর PDF (Storage) =================
-- public bucket: কোর্সের ছবি, hero, রুটিন/সিলেবাস PDF। সবাই দেখতে পারে (সাইটে দেখানোর জিনিস), রাখতে বা
-- মুছতে পারেন শুধু admin। ৫MB পর্যন্ত, শুধু ছবি আর PDF
do $$
begin
  if to_regclass('storage.objects') is not null then
    execute $q$insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
             values ('site-media', 'site-media', true, 5242880,
                     array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf'])
             on conflict (id) do nothing$q$;
    -- সাইটে দেখানো public URL দিয়ে, তাতে policy লাগে না; এটা অ্যাডমিন প্যানেল থেকে মোছা/তালিকার জন্য
    execute $q$create policy site_media_select on storage.objects for select to authenticated
             using (bucket_id = 'site-media' and public.my_role() = 'admin')$q$;
    execute $q$create policy site_media_insert on storage.objects for insert to authenticated
             with check (bucket_id = 'site-media' and public.my_role() = 'admin')$q$;
    execute $q$create policy site_media_update on storage.objects for update to authenticated
             using (bucket_id = 'site-media' and public.my_role() = 'admin')$q$;
    execute $q$create policy site_media_delete on storage.objects for delete to authenticated
             using (bucket_id = 'site-media' and public.my_role() = 'admin')$q$;
  end if;
end $$;
