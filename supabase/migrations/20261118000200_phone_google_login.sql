-- লগইন: মোবাইল নম্বরে OTP (মূল পথ) আর Google। সবার পড়ার মতো ID BP-1001 থেকে ক্রমিক।
--
-- ১. user_code: BP-1001, BP-1002, ... (শিক্ষার্থী, শিক্ষক, স্টাফ সবাই এক ক্রমে)
--    sequence এ ফাঁক পড়ে (ব্যর্থ signup ও নম্বর খেয়ে ফেলে)। তাই এক সারির counter: signup এর transaction
--    বাতিল হলে counter ও ফিরে যায়, ফাঁক পড়ে না। একসাথে কয়েকজন signup করলে এক এক করে নম্বর পান (মুহূর্তের কাজ)
create table public.user_code_counter (
  id   boolean primary key default true check (id),   -- একটাই সারি
  last integer not null
);
alter table public.user_code_counter enable row level security;   -- policy নেই: শুধু নিচের function
revoke all on public.user_code_counter from anon, authenticated;

create function public.next_user_code() returns text
language sql volatile security definer set search_path = '' as $$
  update public.user_code_counter set last = last + 1 returning 'BP-' || last
$$;
revoke execute on function public.next_user_code() from public, anon, authenticated;

-- আগে কেউ অ্যাকাউন্ট খুলে থাকলে (পুরনো BP-26-00001 ধাঁচ) খোলার ক্রমে নতুন নম্বর
update public.profiles p set user_code = 'BP-' || (1000 + o.rn)
  from (select id, row_number() over (order by created_at, id) rn from public.profiles) o
 where o.id = p.id;
insert into public.user_code_counter (last) select 1000 + count(*) from public.profiles;

alter table public.profiles alter column user_code set default public.next_user_code();
drop sequence public.user_code_seq;

-- ২. ফোন: Google দিয়ে খোলা অ্যাকাউন্টে প্রথমে নম্বর থাকে না। সাইটে প্রথমবার ঢুকলে OTP দিয়ে নম্বর যাচাই
--    করিয়ে নেওয়া হয় (/onboarding), তার আগে কোনো পাতা খোলে না
alter table public.profiles alter column phone drop not null;

-- ৩. নতুন অ্যাকাউন্টে profile। ফোন শুধু auth.users.phone থেকে, মানে OTP দিয়ে যাচাই করা নম্বর।
--    metadata র ফোন আর নেওয়া হয় না: signup API তে যে কেউ যেকোনো নম্বর লিখে দিতে পারে
--    (অন্যের নম্বর আটকে রাখা যেত, profiles.phone unique)।
--    Google দেয় full_name/name আর avatar_url/picture
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, full_name, phone, email, avatar_url, institute, guardian_phone)
  values (new.id,
          coalesce(nullif(trim(m->>'full_name'), ''), nullif(trim(m->>'name'), ''), ''),
          nullif(new.phone, ''),
          new.email,
          coalesce(m->>'avatar_url', m->>'picture'),
          m->>'institute', m->>'guardian_phone');
  return new;
end $$;

-- ৪. লগইনের ফোন বা ইমেইল বদলালে (যেমন Google অ্যাকাউন্টে OTP দিয়ে নম্বর যোগ) profile এও।
--    profiles.phone নিজে বদলানো যায় না (grant নেই), শুধু এই পথে, যাচাইয়ের পর
create function public.sync_user_contact() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles
     set phone = coalesce(nullif(new.phone, ''), phone),
         email = coalesce(new.email, email)
   where id = new.id;
  return new;
end $$;

create trigger on_auth_user_contact_changed after update of phone, email on auth.users
  for each row when (old.phone is distinct from new.phone or old.email is distinct from new.email)
  execute function public.sync_user_contact();
