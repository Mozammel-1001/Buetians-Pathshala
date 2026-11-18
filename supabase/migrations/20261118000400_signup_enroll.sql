-- আলাদা সাইন আপ (নাম, মোবাইল, ইমেইল, অভিভাবকের মোবাইল, প্রতিষ্ঠান, শ্রেণি) আর OTP দিয়ে অ্যাকাউন্ট চালু;
-- আইডি বা মোবাইল দিয়ে লগইন; bKash এ Send Money করে ভর্তির আবেদন, TrxID এর duplicate সাথে সাথে ধরা

-- ================= শ্রেণি =================
alter table public.profiles add column class_level text check (class_level is null or length(class_level) <= 60);
-- নিজের ইমেইল আর শ্রেণিও নিজে বদলানো যায় (ফোন নয়: সেটা শুধু OTP দিয়ে, auth এর পথে)
grant update (email, class_level) on public.profiles to authenticated;

-- ================= অ্যাকাউন্ট চালু হয় OTP যাচাইয়ের পর =================
-- আগে নম্বরে কোড পাঠানোর মুহূর্তেই (Supabase তখনই auth.users এ সারি বানায়) profile আর আইডি তৈরি হতো,
-- কোড না দিলেও। এখন profile, মানে BP আইডি, তৈরি হয় যখন মোবাইল নম্বর যাচাই হয়:
--   মোবাইলে সাইন আপ: কোড মিললে (phone_confirmed_at বসে)
--   Google: প্রথম লগইনে profile হয় না; /onboarding এ নম্বর যাচাই হলে হয়
-- তাই প্রতিটি profile এ যাচাই করা নম্বর থাকে, আর আইডির ক্রমে অসমাপ্ত সাইন আপের জন্য ফাঁক পড়ে না।
-- তথ্য আসে সাইন আপ ফর্মের metadata থেকে (নাম, ইমেইল, প্রতিষ্ঠান, অভিভাবক, শ্রেণি); ফোন শুধু যাচাই করা নম্বর
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if coalesce(new.phone, '') = '' or new.phone_confirmed_at is null then return new; end if;
  if exists (select 1 from public.profiles where id = new.id) then return new; end if;
  insert into public.profiles (id, full_name, phone, email, avatar_url, institute, guardian_phone, class_level)
  values (new.id,
          left(coalesce(nullif(trim(m->>'full_name'), ''), nullif(trim(m->>'name'), ''), ''), 120),
          new.phone,
          coalesce(nullif(new.email, ''), nullif(trim(m->>'email'), '')),
          coalesce(m->>'avatar_url', m->>'picture'),
          nullif(trim(m->>'institute'), ''),
          nullif(trim(m->>'guardian_phone'), ''),
          left(nullif(trim(m->>'class_level'), ''), 60));
  return new;
end $$;

create trigger on_auth_user_confirmed after update of phone, phone_confirmed_at on auth.users
  for each row when (new.phone_confirmed_at is not null and coalesce(new.phone, '') <> ''
                     and (old.phone_confirmed_at is null or old.phone is distinct from new.phone))
  execute function public.handle_new_user();

-- সব profile এ নম্বর থাকে (আগের পর্বে Google এর অ্যাকাউন্টে ফাঁকা থাকতে পারত; তেমন কিছু না থাকলে আবার বাধ্যতামূলক)
do $$
begin
  if not exists (select 1 from public.profiles where phone is null) then
    alter table public.profiles alter column phone set not null;
  end if;
end $$;

-- সাইন আপ শেষ হয়নি (লগইন আছে, profile নেই, যেমন Google এর পর নম্বর যাচাই বাকি): এক-ডিভাইসের পাহারা
-- তাকে আটকায় না, কারণ তার কোনো ডেটাই নেই (সব টেবিলের restrictive policy এমনিতেই কিছু দেয় না)
create or replace function public.check_request() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is not null
     and coalesce(current_setting('request.path', true), '') not in ('/rpc/claim_session', '/rpc/session_status')
     and exists (select 1 from public.profiles where id = auth.uid())
     and not public.session_ok() then
    raise sqlstate 'PT401' using message = 'SESSION_REPLACED',
      detail = 'এই অ্যাকাউন্টে অন্য ডিভাইসে লগইন হয়েছে, এখানে আবার লগইন করুন';
  end if;
end $$;

-- ================= পেমেন্টের তথ্য (অ্যাডমিন প্যানেল → সাইটের লেখা) =================
alter table public.site_content drop constraint site_content_key_check;
alter table public.site_content add constraint site_content_key_check
  check (key in ('hero', 'features', 'branches', 'cta', 'contact', 'about', 'payment'));
insert into public.site_content (key, value) values
  ('payment', jsonb_build_object(
     'bkash_number', '', 'account_type', 'personal',
     'note', 'bKash অ্যাপে "Send Money" করুন (Payment নয়)। Reference এ আপনার আইডি লিখুন।',
     'review_time', 'সাধারণত ১২ ঘণ্টার মধ্যে যাচাই হয়।'))
on conflict (key) do nothing;
-- নতুন অ্যাকাউন্টের বোতাম এখন সাইন আপ পাতায় (অ্যাডমিন আগে না বদলে থাকলে)
update public.site_content set value = jsonb_set(value, '{secondary_href}', '"/sign-up"')
 where key = 'hero' and value->>'secondary_href' = '/sign-in';
update public.site_content set value = jsonb_set(value, '{button_href}', '"/sign-up"')
 where key = 'cta' and value->>'button_href' = '/sign-in';

-- ================= ভর্তির আবেদন =================
-- শিক্ষার্থী সরাসরি payments এ লিখতে পারে না; সব আবেদন submit_payment দিয়ে, যাতে যাচাই আর হিসাব এক জায়গায়
drop policy payments_insert on public.payments;

create index payments_status_created on public.payments (status, created_at);

-- bKash এ Send Money এর পর আবেদন। ফেরত দেয় {status, reason, ...}:
--   pending        আবেদন জমা হয়েছে, admin বা manager যাচাই করবেন
--   duplicate      এই TrxID আগেই ব্যবহার হয়েছে (কার, তা বলা হয় না; নিজের হলে অবস্থা বলে)। চেষ্টাটা audit_logs এ থাকে
--   enrolled       আগেই ভর্তি আছেন
--   pending_exists এই কোর্সে আগের আবেদন যাচাই বাকি
--   invalid        TrxID বা নম্বর ঠিক নেই, কোর্স নেই ইত্যাদি
--   too_many       এক ঘণ্টায় অনেকবার ভুল TrxID (অন্যের TrxID আন্দাজে চেষ্টা আটকাতে)
-- TrxID বড় হাতের অক্ষরে, ফাঁকা আর চিহ্ন বাদ দিয়ে মেলানো হয়, তাই " 9a7b-6c5d4e " আর "9A7B6C5D4E" একই
create function public.submit_payment(p_course_id bigint, p_sender text, p_trx_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := auth.uid();
  v_trx    text := upper(regexp_replace(coalesce(p_trx_id, ''), '[^A-Za-z0-9]', '', 'g'));
  v_digits text := regexp_replace(translate(coalesce(p_sender, ''), '০১২৩৪৫৬৭৮৯', '0123456789'), '[^0-9]', '', 'g');  -- বাংলা অঙ্কেও চলে
  v_sender text;
  c        public.courses;
  dup      public.payments;
  v_id     bigint;
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'লগইন করা নেই' using errcode = '42501';
  end if;

  v_sender := case when v_digits ~ '^(88)?01[3-9][0-9]{8}$' then '88' || right(v_digits, 11) end;
  if v_sender is null then
    return jsonb_build_object('status', 'invalid', 'field', 'sender', 'reason', 'যে bKash নম্বর থেকে টাকা পাঠিয়েছেন সেটা ঠিকভাবে লিখুন (০১XXXXXXXXX)');
  end if;
  if v_trx !~ '^[A-Z0-9]{8,12}$' then
    return jsonb_build_object('status', 'invalid', 'field', 'trx', 'reason', 'TrxID ঠিক নেই। bKash এর মেসেজে থাকা ১০ অক্ষরের TrxID দিন (যেমন 9A7B6C5D4E)');
  end if;

  select * into c from public.courses where id = p_course_id and is_published;
  if not found then
    return jsonb_build_object('status', 'invalid', 'reason', 'কোর্সটা পাওয়া যায়নি');
  end if;
  if c.price = 0 then
    return jsonb_build_object('status', 'invalid', 'reason', 'এটা ফ্রি কোর্স, টাকা লাগে না');
  end if;
  if public.is_enrolled(c.id) then
    return jsonb_build_object('status', 'enrolled', 'reason', 'আপনি এই কোর্সে আগেই ভর্তি আছেন');
  end if;
  if exists (select 1 from public.payments where user_id = v_uid and course_id = c.id and status = 'pending') then
    return jsonb_build_object('status', 'pending_exists', 'reason', 'এই কোর্সে আপনার আগের আবেদন যাচাইয়ের অপেক্ষায় আছে');
  end if;
  if (select count(*) from public.audit_logs
       where actor_id = v_uid and action = 'payment.duplicate_trx' and created_at > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('status', 'too_many', 'reason', 'অনেকবার ব্যবহার হওয়া TrxID দেওয়া হয়েছে। এক ঘণ্টা পরে চেষ্টা করুন, নয়তো সাপোর্টে যোগাযোগ করুন');
  end if;

  select * into dup from public.payments where trx_id = v_trx;
  if not found then
    begin
      insert into public.payments (user_id, course_id, amount, sender_number, trx_id)
      values (v_uid, c.id, c.price, v_sender, v_trx)
      returning id into v_id;
    exception when unique_violation then
      -- ঠিক একই মুহূর্তে একই TrxID বা একই কোর্সে দুটো আবেদন
      select * into dup from public.payments where trx_id = v_trx;
      if not found then
        return jsonb_build_object('status', 'pending_exists', 'reason', 'এই কোর্সে আপনার আগের আবেদন যাচাইয়ের অপেক্ষায় আছে');
      end if;
    end;
  end if;

  if v_id is null then
    insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
    values (v_uid, 'payment.duplicate_trx', 'payments', dup.id::text,
            jsonb_build_object('trx_id', v_trx, 'course_id', c.id, 'sender', v_sender, 'same_user', dup.user_id = v_uid));
    return jsonb_build_object('status', 'duplicate', 'trx_id', v_trx, 'reason',
      case
        when dup.user_id = v_uid and dup.status = 'rejected'
          then 'এই TrxID দিয়ে আপনার আগের আবেদন বাতিল হয়েছিল' || coalesce(' (কারণ: ' || dup.reject_reason || ')', '') || '। একই TrxID আবার দেওয়া যায় না'
        when dup.user_id = v_uid
          then 'এই TrxID দিয়ে আপনি আগেই আবেদন করেছেন (' || case dup.status when 'approved' then 'অনুমোদিত' else 'যাচাই বাকি' end || ')'
        else 'এই TrxID দিয়ে আগেই আরেকটি পেমেন্ট জমা হয়েছে। প্রতিটি TrxID একবারই ব্যবহার করা যায়'
      end);
  end if;

  return jsonb_build_object('status', 'pending', 'payment_id', v_id, 'trx_id', v_trx, 'amount', c.price, 'course', c.title);
end $$;

-- ফ্রি কোর্সে সরাসরি ভর্তি
create function public.enroll_free(p_course_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'লগইন করা নেই' using errcode = '42501';
  end if;
  if not exists (select 1 from public.courses where id = p_course_id and is_published and price = 0) then
    return jsonb_build_object('status', 'invalid', 'reason', 'এই কোর্সটা ফ্রি নয়');
  end if;
  insert into public.enrollments (user_id, course_id, status, note)
  values (auth.uid(), p_course_id, 'active', 'free')
  on conflict (user_id, course_id) do update set status = 'active'
    where public.enrollments.status <> 'revoked';   -- বাতিল করা ভর্তি নিজে ফেরানো যায় না
  return jsonb_build_object('status', case when public.is_enrolled(p_course_id) then 'enrolled' else 'invalid' end,
                            'reason', case when public.is_enrolled(p_course_id) then null else 'এই কোর্সে আপনার ভর্তি বাতিল করা আছে, সাপোর্টে যোগাযোগ করুন' end);
end $$;

revoke execute on function public.submit_payment(bigint, text, text) from public, anon;
revoke execute on function public.enroll_free(bigint) from public, anon;
