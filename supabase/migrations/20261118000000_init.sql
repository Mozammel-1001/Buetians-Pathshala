-- বুয়েটিয়ান'স পাঠশালা: মূল schema (Supabase migration)। এটাই এখন আসল কপি; docs/0001_init.sql ডেমো পর্বের নকশা।
-- চালানো: npx supabase db push (README দেখুন)

-- বুয়েটিয়ান'স পাঠশালা: প্রথম Supabase migration
-- উৎস: docs/system-architecture.pdf, পরিশিষ্ট ক
-- পরে যোগ হয়েছে (PDF এ নেই): manager রোল, শিক্ষকের ক্লাস অ্যাসাইন ও সম্মানী,
-- অন্য খরচ, নোটিশ, মাসিক লেনদেন, প্রোফাইলের বাড়তি তথ্য ও পড়ার মতো ID,
-- বিষয় → অধ্যায় → লেকচার, অগ্রগতির রিপোর্ট view, প্রশ্নোত্তর (পড়াশোনা ও ভর্তি),
-- শিক্ষক বা manager কে উত্তর দিতে জানানো (notifications), তিন ধরনের পরীক্ষা (MCQ, লিখিত,
-- MCQ + লিখিত), খাতা মূল্যায়নকারী (evaluator) আর নম্বরপ্রতি খাতা কাটার সম্মানী,
-- পরীক্ষার নির্ভরযোগ্যতা: শুরুর পর প্রশ্নপত্র বন্ধ, প্রতিজনের আলাদা ক্রম, একসাথে সেভ আর এক ডিভাইস,
-- উত্তর সংশোধন ও নতুন করে নম্বর, খাতার দ্বিতীয় যাচাই, ক্যালিব্রেশন, পুনর্মূল্যায়ন, মেধাক্রম cache,
-- প্রশ্নের মান বিশ্লেষণ, সন্দেহজনক pattern আর অধ্যায়ভিত্তিক রিপোর্ট,
-- কড়া পরীক্ষা: একবার খুললে আর বাতিল বা আবার খোলা নয় (পাতা ছাড়লে, রিলোড, back, অন্য ট্যাবে গেলে জমা),
-- একসাথে একটাই ডিভাইসে লগইন (নতুন লগইনে আগেরটা বাদ), AI দিয়ে খাতার খসড়া নম্বর,
-- প্রশ্নপত্র তৈরি (অ্যাডমিন ও কোর্সের শিক্ষক): সময়সূচি, প্রকাশের আগে যাচাই, প্রশ্ন আর অপশনে ছবি

-- ================= Types =================
create type user_role         as enum ('student', 'teacher', 'manager', 'admin', 'evaluator');  -- evaluator: খাতা মূল্যায়নকারী
create type payment_status    as enum ('pending', 'approved', 'rejected');
create type enrollment_status as enum ('active', 'expired', 'revoked');
create type video_status      as enum ('uploading', 'processing', 'ready', 'failed');
create type live_status       as enum ('scheduled', 'live', 'ended');
create type attempt_status    as enum ('in_progress', 'submitted', 'expired');
-- কীভাবে জমা হলো: নিজে জমা, সময় শেষে ফোন থেকে, পাতা ছেড়ে যাওয়া (রিলোড, অন্য পাতা, বন্ধ), back চাপা,
-- অন্য ট্যাব বা অ্যাপে যাওয়া, আবার খোলা (সার্ভার), অন্য ডিভাইসে লগইন (সার্ভার), সময় পেরিয়ে cron
create type attempt_end_reason as enum ('submit', 'time_up', 'left', 'back', 'tab_hidden', 'reopened',
                                        'other_device', 'expired');
create type class_type        as enum ('live', 'solve', 'recorded');
create type class_status      as enum ('assigned', 'done', 'cancelled');
create type payout_method     as enum ('bkash', 'nagad', 'bank', 'cash');
create type expense_category  as enum ('service', 'sms', 'refund', 'other');
create type notice_audience   as enum ('all_students', 'course', 'teachers', 'evaluators');
create type notice_channel    as enum ('site', 'sms', 'both');
create type notification_kind as enum ('qa_answer', 'qa_reminder', 'script_returned', 'exam_result',
                                       'exam_corrected', 'recheck_request', 'recheck_result',
                                       'moderation_flag', 'calibration');
create type qa_kind           as enum ('study', 'enrollment');   -- পড়াশোনার প্রশ্ন, ভর্তির প্রশ্ন
create type exam_kind         as enum ('mcq', 'written', 'mixed');  -- MCQ, লিখিত, MCQ + লিখিত
create type script_status     as enum ('claimed', 'marked', 'returned');  -- খাতা ধরা আছে, কাটা হয়েছে, ফেরত
-- পরীক্ষার সময় ফোন থেকে আসা ঘটনা (রেকর্ড; শিক্ষক দেখে সিদ্ধান্ত নেন)। MCQ পরীক্ষায় অন্য ট্যাব/অ্যাপে
-- গেলে ফোন নিজেই জমা দেয় (exams.submit_on_hide); লিখিত/মিশ্রে ক্যামেরা লাগে বলে শুধু রেকর্ড
create type exam_event_kind   as enum ('tab_hidden', 'fullscreen_exit', 'copy_paste', 'offline', 'online');
create type recheck_status    as enum ('pending', 'changed', 'unchanged', 'rejected');  -- পুনর্মূল্যায়নের আবেদন
-- খাতার দ্বিতীয় যাচাই: বাছাই হয়েছে (বাকি), দুজনের নম্বর মিলেছে, পার্থক্য বেশি, শিক্ষক চূড়ান্ত করেছেন
create type moderation_status as enum ('pending', 'agreed', 'flagged', 'resolved');

-- একই শিক্ষকের একই সময়ে দুটো ক্লাস আটকাতে (class_assignments এর exclude)
create extension if not exists btree_gist with schema extensions;

-- ================= User =================
-- পড়ার মতো ID, যেমন BP-26-00001 (বছর-ক্রমিক)। ID কার্ড আর সাপোর্ট কলে কাজে লাগে।
-- ভেতরের আসল ID থাকে id (uuid), যেটা লগইন থেকে আসে
create sequence user_code_seq;

-- শিক্ষার্থী, শিক্ষক, ম্যানেজার, অ্যাডমিন সবাই এক টেবিলে; কে কী তা role বলে
create table profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  user_code      text not null unique
                 default 'BP-' || to_char(now() at time zone 'Asia/Dhaka', 'YY') || '-'
                         || lpad(nextval('public.user_code_seq')::text, 5, '0'),
  full_name      text not null,
  phone          text not null unique,
  email          text,
  avatar_url     text,
  role           user_role not null default 'student',
  institute      text,                       -- শিক্ষার্থী: স্কুল/কলেজ; শিক্ষক: বিশ্ববিদ্যালয়
  guardian_phone text,                       -- শুধু শিক্ষার্থী; ফলাফলের SMS অভিভাবকও পেতে পারে
  department     text,                       -- শুধু শিক্ষক, যেমন CSE
  batch          text,                       -- শুধু শিক্ষক, যেমন BUET '19
  created_at     timestamptz not null default now()
);

-- Signup করলে নিজে থেকে profile তৈরি (role = student)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- ফোন: ফোন-OTP লগইনে auth.users.phone, ইমেইল লগইনে signup ফর্মের ফোন (metadata); দুটোই 8801XXXXXXXXX ধাঁচে
  insert into public.profiles (id, full_name, phone, email, institute, guardian_phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''),
          coalesce(nullif(new.phone, ''), new.raw_user_meta_data->>'phone'), new.email,
          new.raw_user_meta_data->>'institute', new.raw_user_meta_data->>'guardian_phone');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.my_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

-- admin বা manager (staff) কিনা
create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.my_role() in ('admin', 'manager'), false)
$$;

-- ================= কোর্স ও কনটেন্ট =================
create table courses (
  id            bigint generated always as identity primary key,
  slug          text not null unique,
  title         text not null,
  description   text,
  key_points    text[] not null default '{}',  -- কোর্সে কী থাকছে: "৮+ মডিউল", "লাইভ প্রশ্নোত্তর" ...
  price         numeric(10,2) not null check (price >= 0),
  thumbnail_url text,
  is_published  boolean not null default false,
  created_at    timestamptz not null default now()
);

create table course_teachers (
  course_id  bigint references courses(id) on delete cascade,
  teacher_id uuid   references profiles(id) on delete cascade,
  primary key (course_id, teacher_id)
);

-- কোর্স → বিষয় → অধ্যায় → লেকচার
create table subjects (
  id        bigint generated always as identity primary key,
  course_id bigint not null references courses(id) on delete cascade,
  name      text not null,                   -- পদার্থবিজ্ঞান, রসায়ন, গণিত ...
  position  int not null default 0,
  unique (course_id, name),
  unique (id, course_id)                     -- নিচের composite FK এর জন্য
);

-- course_id রাখা হয়েছে যাতে অন্য কোর্সের বিষয়ে অধ্যায় বসে না যায়
create table chapters (
  id         bigint generated always as identity primary key,
  course_id  bigint not null,
  subject_id bigint not null,
  title      text not null,
  position   int not null default 0,
  foreign key (subject_id, course_id) references subjects (id, course_id) on delete cascade,
  unique (id, course_id)
);

create table lessons (
  id               bigint generated always as identity primary key,
  course_id        bigint not null references courses(id) on delete cascade,
  chapter_id       bigint,
  lecture_no       int check (lecture_no > 0),     -- অধ্যায়ের কত নম্বর লেকচার
  title            text not null,
  bunny_video_id   text unique,                    -- লিংক নয়; দেখার সময় token সহ লিংক তৈরি হয়
  video_status     video_status not null default 'uploading',
  duration_seconds int,
  is_preview       boolean not null default false,
  created_by       uuid references profiles(id),
  created_at       timestamptz not null default now(),
  -- লেকচার আর অধ্যায় একই কোর্সের হতে হবে। অধ্যায় মুছলে লেকচার থাকে, শুধু chapter_id খালি হয়
  foreign key (chapter_id, course_id) references chapters (id, course_id) on delete set null (chapter_id),
  unique (chapter_id, lecture_no),
  unique (id, course_id)                           -- প্রশ্নোত্তরের composite FK এর জন্য
);

-- স্টাডি ম্যাটেরিয়াল (PDF)। ফাইল থাকে Storage এর private bucket এ, নামানো যায় শুধু
-- এনরোলমেন্ট যাচাই করে দেওয়া signed URL দিয়ে
create table study_materials (
  id           bigint generated always as identity primary key,
  course_id    bigint not null references courses(id) on delete cascade,
  chapter_id   bigint,                       -- ম্যাটেরিয়াল পেজে অধ্যায় অনুযায়ী সাজানো হয়
  lesson_id    bigint references lessons(id) on delete set null,
  kind         text not null default 'sheet'
               check (kind in ('sheet', 'bank', 'solution', 'formula')),  -- লেকচার শিট, প্রশ্নব্যাংক, সমাধান, সূত্র
  title        text not null,
  storage_path text not null,
  page_count   int check (page_count > 0),
  size_bytes   bigint check (size_bytes > 0),
  uploaded_by  uuid default auth.uid() references profiles(id),
  created_at   timestamptz not null default now(),
  foreign key (chapter_id, course_id) references chapters (id, course_id) on delete set null (chapter_id)
);

-- ================= Payment ও enrollment =================
create table payments (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references profiles(id),
  course_id     bigint not null references courses(id),
  amount        numeric(10,2) not null,
  method        text not null default 'bkash_manual',
  sender_number text not null,
  trx_id        text not null unique,
  status        payment_status not null default 'pending',
  reject_reason text,
  reviewed_by   uuid references profiles(id),
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- একই কোর্সে একসাথে একটাই pending আবেদন
create unique index one_pending_payment on payments (user_id, course_id)
  where status = 'pending';

-- টাকার পরিমাণ browser থেকে না নিয়ে কোর্সের দাম বসানো, TrxID uppercase করা
create function public.prepare_payment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.amount := (select price from public.courses where id = new.course_id);
  new.trx_id := upper(trim(new.trx_id));
  return new;
end $$;

create trigger payments_prepare before insert on payments
  for each row execute function public.prepare_payment();

create table enrollments (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references profiles(id),
  course_id   bigint not null references courses(id),
  payment_id  bigint references payments(id),
  status      enrollment_status not null default 'active',
  enrolled_at timestamptz not null default now(),
  expires_at  timestamptz,
  note        text,                          -- ম্যানুয়াল এনরোলের কারণ: স্কলারশিপ, ক্যাশ ...
  unique (user_id, course_id)
);

-- ================= শেখা =================
create table lesson_progress (
  user_id         uuid   references profiles(id) on delete cascade,
  lesson_id       bigint references lessons(id) on delete cascade,
  watched_seconds int not null default 0,
  completed       boolean not null default false,
  updated_at      timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table bookmarks (
  user_id    uuid   references profiles(id) on delete cascade,
  lesson_id  bigint references lessons(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table student_notes (
  id                 bigint generated always as identity primary key,
  user_id            uuid not null references profiles(id) on delete cascade,
  lesson_id          bigint references lessons(id) on delete set null,
  title              text not null,
  content            text not null,          -- sanitize করা HTML
  video_time_seconds int,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- প্রশ্নোত্তর দুই ধরনের (kind):
--   study:      পড়াশোনার প্রশ্ন, শিক্ষার্থীর ড্যাশবোর্ড থেকে। করে কোর্সে ভর্তি শিক্ষার্থী, উত্তর দেন
--               কোর্সের শিক্ষক বা admin। কোর্সের সবাই সবার প্রশ্ন দেখে। দেরি হলে admin বা manager
--               শিক্ষককে জানান (remind_teacher)
--   enrollment: ভর্তির প্রশ্ন, কোর্সের বিস্তারিত পেজ থেকে (ফি, পেমেন্ট, সময়সূচি)। করে যেকোনো লগইন
--               করা ইউজার, উত্তর দেন manager বা admin। উত্তর পাওয়া প্রশ্ন সবাই দেখে (লগইন ছাড়াও),
--               উত্তর বাকিগুলো শুধু প্রশ্নকারী আর staff। দেরি হলে admin manager কে জানান (remind_manager)
-- অধ্যায় আর লেকচার একই কোর্সের হতে হবে; ভর্তির প্রশ্নে এগুলো থাকে না
create table qa_questions (
  id          bigint generated always as identity primary key,
  course_id   bigint not null references courses(id) on delete cascade,
  kind        qa_kind not null default 'study',
  chapter_id  bigint,                                  -- কোন অধ্যায়ের প্রশ্ন (ঐচ্ছিক)
  lesson_id   bigint,                                  -- কোন লেকচার দেখে প্রশ্ন (ঐচ্ছিক)
  user_id     uuid not null default auth.uid() references profiles(id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 10 and 2000),
  answered_at timestamptz,                             -- প্রথম উত্তরের সময়, trigger বসায়; null মানে উত্তর বাকি
  created_at  timestamptz not null default now(),
  check (kind = 'study' or (chapter_id is null and lesson_id is null)),
  foreign key (chapter_id, course_id) references chapters (id, course_id) on delete set null (chapter_id),
  foreign key (lesson_id, course_id) references lessons (id, course_id) on delete set null (lesson_id)
);
create index qa_questions_course_idx on qa_questions (course_id, kind, created_at desc);
create index qa_questions_open_idx on qa_questions (kind, course_id, created_at) where answered_at is null;

create table qa_answers (
  id          bigint generated always as identity primary key,
  question_id bigint not null references qa_questions(id) on delete cascade,
  user_id     uuid not null default auth.uid() references profiles(id),
  body        text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at  timestamptz not null default now()
);
create index qa_answers_question_idx on qa_answers (question_id);

-- ================= Live class =================
-- এখন লাইভ ক্লাস Broadcast ধরনের (Facebook Live এর মতো): শিক্ষক ব্রাউজার থেকে
-- ক্যামেরা চালু করেন, শিক্ষার্থীরা দেখে আর কমেন্ট করে, ক্লাস শেষে রেকর্ডিং লেসন হয়।
-- JaaS (ভিডিও কল) এর অংশগুলো মোছা হয়নি, "-- [JaaS]" দিয়ে comment করা আছে।
-- JaaS এ ফিরতে: [JaaS] লাইনগুলো খুলুন, আর [Broadcast] অংশগুলো comment করুন।
create table live_sessions (
  id                  uuid primary key default gen_random_uuid(),
  course_id           bigint not null references courses(id),
  teacher_id          uuid not null references profiles(id),
  title               text not null,
  -- [JaaS] room_name           text not null unique default gen_random_uuid()::text,
  playback_id         uuid not null unique default gen_random_uuid(),  -- [Broadcast] HLS ভিডিওর ঠিকানা; token ছাড়া চলে না
  peak_viewers        int not null default 0,                          -- [Broadcast] একসাথে সর্বোচ্চ দর্শক
  status              live_status not null default 'scheduled',
  scheduled_at        timestamptz,
  started_at          timestamptz,
  ended_at            timestamptz,
  recording_lesson_id bigint references lessons(id),
  created_at          timestamptz not null default now()
);

-- একই কোর্সে একসাথে একটাই live ক্লাস
create unique index one_live_per_course on live_sessions (course_id)
  where status = 'live';

-- [JaaS] কে কখন ঢুকল আর বের হলো, JaaS webhook (PARTICIPANT_JOINED/LEFT) থেকে
-- create table live_attendance (
--   id         bigint generated always as identity primary key,
--   session_id uuid not null references live_sessions(id) on delete cascade,
--   user_id    uuid not null references profiles(id),
--   joined_at  timestamptz not null,
--   left_at    timestamptz
-- );

-- [Broadcast] শিক্ষকের publish key আলাদা টেবিলে, যাতে শিক্ষার্থীরা কোনোভাবে না দেখে।
-- কোনো RLS policy নেই; পাওয়া যায় শুধু get_stream_key() দিয়ে
create table live_stream_keys (
  session_id uuid primary key references live_sessions(id) on delete cascade,
  stream_key text not null unique
             default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

-- [Broadcast] নতুন লাইভ সেশন তৈরি হলে নিজে থেকে stream key তৈরি
create function public.create_stream_key() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.live_stream_keys (session_id) values (new.id);
  return new;
end $$;

create trigger live_sessions_stream_key after insert on live_sessions
  for each row execute function public.create_stream_key();

-- [Broadcast] কে কতক্ষণ দেখল (উপস্থিতি)। প্লেয়ার প্রতি মিনিটে live_heartbeat() ডাকে
create table live_views (
  session_id      uuid not null references live_sessions(id) on delete cascade,
  user_id         uuid not null references profiles(id),
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  watched_seconds int not null default 0,
  primary key (session_id, user_id)
);

-- [Broadcast] লাইভ কমেন্ট, Facebook Live এর মতো সবাই সবারটা দেখে।
-- pin, সমাধান আর delete হয় moderate_comment() দিয়ে
create table live_comments (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references live_sessions(id) on delete cascade,
  user_id     uuid not null default auth.uid() references profiles(id),
  body        text not null check (char_length(trim(body)) between 1 and 300),
  is_pinned   boolean not null default false,
  is_resolved boolean not null default false,
  deleted_at  timestamptz,
  deleted_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);
create index live_comments_session on live_comments (session_id, created_at);

-- ================= Exam =================
-- পরীক্ষা তিন ধরনের (kind): mcq, written (লিখিত), mixed (MCQ + লিখিত)।
--   MCQ অংশের নম্বর জমার সাথে সাথে পাওয়া যায় (submit_exam), কিন্তু সঠিক উত্তর, সমাধান আর
--   মেধাতালিকা পরীক্ষার সময় (closes_at) শেষ হওয়ার পর।
--   লিখিত অংশ: শিক্ষার্থী খাতার ছবি দেয়, মূল্যায়নকারী/শিক্ষক/admin প্রশ্নভিত্তিক কাটেন,
--   সব কাটা হলে ফল প্রকাশ হয় (publish_written_results), তখন মোট নম্বর আর মেধাতালিকা আসে
create table exams (
  id               bigint generated always as identity primary key,
  course_id        bigint not null references courses(id) on delete cascade,
  title            text not null,
  kind             exam_kind not null default 'mcq',
  duration_minutes int not null check (duration_minutes > 0),
  negative_mark    numeric(4,2) not null default 0,   -- শুধু MCQ এ
  opens_at         timestamptz,
  closes_at        timestamptz,
  -- লিখিত অংশে কোন সেকশন থেকে কয়টির উত্তর দিতে হবে, যেমন {"সৃজনশীল": 5, "সংক্ষিপ্ত": 7}। না থাকলে সবগুলো
  pick_rules       jsonb not null default '{}' check (jsonb_typeof(pick_rules) = 'object'),
  upload_grace_minutes int not null default 15 check (upload_grace_minutes between 0 and 60),  -- জমার পর খাতার ছবি দেওয়ার সময়
  shuffle          boolean not null default true,   -- MCQ: প্রতিজনের প্রশ্ন আর অপশনের ক্রম আলাদা, পাশের জনের সাথে মেলানো কঠিন
  -- শুধু MCQ পরীক্ষা: অন্য ট্যাব, অ্যাপ বা উইন্ডোতে গেলে সাথে সাথে জমা (ফোন জানায়, end_reason = 'tab_hidden')।
  -- লিখিত/মিশ্রে খাতার ছবি তুলতে ক্যামেরা খুলতে হয়, তাই সেখানে শুধু রেকর্ড
  submit_on_hide   boolean not null default true,
  -- খাতার দ্বিতীয় যাচাই: প্রত্যেকের প্রথম ২টা আর তারপর এত % খাতা আরেকজন না দেখে কাটেন;
  -- দুজনের পার্থক্য পূর্ণমানের moderation_tolerance % এর বেশি হলে শিক্ষক চূড়ান্ত নম্বর দেন
  moderation_percent   int not null default 10 check (moderation_percent between 0 and 100),
  moderation_tolerance numeric(5,2) not null default 15 check (moderation_tolerance between 0 and 100),
  recheck_days     int not null default 3 check (recheck_days between 0 and 14),  -- ফল প্রকাশের পর পুনর্মূল্যায়নের আবেদনের সময়
  results_published_at timestamptz,          -- লিখিত/মিশ্র: সব খাতা কাটা হলে প্রকাশ হয়
  ranks_computed_at timestamptz,             -- মেধাক্রম একবার হিসাব করে exam_ranks এ রাখা হয়েছে কবে
  solution_pdf_path text,                    -- শিক্ষকের আপলোড করা সমাধান (Storage, private); না থাকলে exam_solution() থেকে PDF তৈরি হয়
  is_published     boolean not null default false,
  created_by       uuid default auth.uid() references profiles(id),
  created_at       timestamptz not null default now(),
  check (closes_at is null or opens_at is null or closes_at > opens_at)
);

create table exam_questions (
  id             bigint generated always as identity primary key,
  exam_id        bigint not null references exams(id) on delete cascade,
  kind           text not null default 'mcq' check (kind in ('mcq', 'written')),
  section        text not null default '',  -- লিখিত: "সৃজনশীল", "সংক্ষিপ্ত" ইত্যাদি (pick_rules এর key)
  body           text not null,
  options        jsonb,                      -- MCQ: ["ক", "খ", "গ", "ঘ"]
  correct_option smallint,                   -- MCQ: স্টুডেন্টের কাছে কখনো যাবে না
  explanation    text,                       -- MCQ এর ব্যাখ্যা, বা লিখিত প্রশ্নের সমাধান
  scheme         text,                       -- লিখিত: নম্বর বিভাজন (কোনটা লিখলে কত), মূল্যায়নকারী দেখে কাটেন
  marks          numeric(5,2) not null default 1 check (marks > 0),  -- পূর্ণমান
  position       int not null default 0,
  chapter_id     bigint references chapters(id) on delete set null,  -- অধ্যায়ভিত্তিক রিপোর্টের জন্য (একই কোর্সের)
  lock_options   boolean not null default false,  -- "সবগুলো" বা "কোনোটিই নয়" থাকলে অপশন এলোমেলো হয় না
  -- ছবি: Storage এর private 'question-images' bucket এ (path: <exam_id>/<file>)। পরীক্ষা শুরুর আগে শুধু
  -- প্রশ্ন যাঁরা বসান তাঁরা দেখেন, শুরুর পর ভর্তি শিক্ষার্থীরা signed URL দিয়ে (নিচের storage policy)।
  -- প্রশ্নের নিচে একটা ছবি (চিত্র, গ্রাফ, বর্তনী), আর MCQ তে প্রতিটি অপশনে চাইলে ছবি
  image_path     text,
  option_images  jsonb,                      -- MCQ: অপশনের সমান লম্বা array, ছবি না থাকলে null
  -- বাতিল প্রশ্ন (শুধু correct_exam_question দিয়ে): drop = মোট নম্বর থেকে বাদ, award = সবাই পূর্ণ নম্বর
  cancelled      text check (cancelled in ('drop', 'award')),
  check (option_images is null or (kind = 'mcq' and jsonb_typeof(option_images) = 'array'
                                    and jsonb_array_length(option_images) = jsonb_array_length(options))),
  check ((kind = 'mcq') = (options is not null and correct_option is not null)),
  check (options is null or (jsonb_typeof(options) = 'array' and correct_option between 0 and jsonb_array_length(options) - 1)),
  check (cancelled is null or kind = 'mcq')
);

create table exam_attempts (
  id            bigint generated always as identity primary key,
  exam_id       bigint not null references exams(id),
  user_id       uuid not null references profiles(id),
  started_at    timestamptz not null default now(),
  deadline_at   timestamptz not null,
  submitted_at  timestamptz,
  mcq_score     numeric(6,2),               -- জমার সাথে সাথে
  written_score numeric(6,2),               -- ফল প্রকাশের সময় বসে
  score         numeric(6,2),               -- মোট। MCQ পরীক্ষায় জমার সাথে, লিখিত/মিশ্রে ফল প্রকাশের সময়
  status        attempt_status not null default 'in_progress',
  upload_until  timestamptz,                -- লিখিত: জমার পর এই সময় পর্যন্ত খাতার ছবি দেওয়া যায়
  picked        bigint[],                   -- লিখিত: যে প্রশ্নগুলোর উত্তর দিয়েছে (pick_rules থাকলে)
  -- খাতার কোড: মূল্যায়নকারী শিক্ষার্থীর নাম দেখেন না, শুধু এই কোড
  script_code   text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  q_order       bigint[],                   -- এই শিক্ষার্থীর MCQ প্রশ্নের ক্রম (shuffle)
  opt_order     jsonb,                      -- {"<question_id>": [দেখানো ক্রমে আসল অপশনের index]}
  session_token uuid,                       -- যে পাতায় পরীক্ষা খোলা হয়েছে শুধু সেটাই সেভ আর জমা দিতে পারে
  open_nonce    text,                       -- সেই পাতার চিহ্ন: একই পাতা থেকে start_exam আবার এলে (নেটে উত্তর হারালে) একই attempt;
                                            -- অন্য পাতা থেকে এলে (রিলোড, নতুন ট্যাব, অন্য ফোন) পরীক্ষা জমা হয়ে যায়
  last_seq      bigint not null default 0,  -- শেষ যে সেভ নেওয়া হয়েছে; দেরিতে পৌঁছানো পুরনো সেভ বাদ পড়ে
  end_reason    attempt_end_reason,         -- কীভাবে জমা হলো (শিক্ষার্থী ফলে আর শিক্ষক বিশ্লেষণে দেখেন)
  unique (exam_id, user_id)                  -- একজন একবারই দেয়; প্রথমবারের ফলেই মেধাক্রম (পরে অনুশীলন ফোনেই, exam_solution থেকে)
);
create index exam_attempts_exam_status on exam_attempts (exam_id, status);

create table attempt_answers (
  attempt_id      bigint references exam_attempts(id) on delete cascade,
  question_id     bigint references exam_questions(id),
  selected_option smallint,
  is_correct      boolean,                   -- submit এর পর server বসায়
  answered_at     timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

-- লিখিত খাতার পাতা। ছবি থাকে Storage এর private 'scripts' bucket এ
-- (path: <user_id>/<attempt_id>/<question_id>-<page>.jpg); upload এর পর এখানে একটা সারি
create table script_pages (
  id           bigint generated always as identity primary key,
  attempt_id   bigint not null references exam_attempts(id) on delete cascade,
  question_id  bigint not null references exam_questions(id) on delete cascade,
  page_no      smallint not null check (page_no between 1 and 20),
  storage_path text not null unique,
  created_at   timestamptz not null default now(),
  unique (attempt_id, question_id, page_no)
);

-- খাতার প্রতিটি প্রশ্নের নম্বর। কাটা হয় প্রশ্নভিত্তিক: একজন একটা প্রশ্ন বেছে নিয়ে সব খাতার ওই
-- প্রশ্ন একটার পর একটা কাটেন (claim_script → save_script_mark), তাই নম্বর একরকম হয়।
-- সরাসরি লেখা যায় না, শুধু function দিয়ে
create table script_marks (
  attempt_id    bigint not null references exam_attempts(id) on delete cascade,
  question_id   bigint not null references exam_questions(id) on delete cascade,
  status        script_status not null default 'claimed',
  marker_id     uuid references profiles(id),     -- যিনি ধরে আছেন বা কেটেছেন
  claimed_at    timestamptz,
  marks         numeric(5,2) check (marks >= 0),
  note          text,                             -- শিক্ষার্থীর জন্য মন্তব্য
  annotations   jsonb,                            -- ছবির উপর লাল দাগ: {"<path>": [{t:'p'|'k'|'x'|'t', ...}]}
  marked_at     timestamptz,
  pay_amount    numeric(10,2) not null default 0, -- পূর্ণমান × তখনকার রেট (admin কাটলে ০)
  return_reason text,
  returned_by   uuid references profiles(id),
  moderation    moderation_status,                -- null = দ্বিতীয় যাচাইয়ে পড়েনি
  primary key (attempt_id, question_id),
  check (status <> 'marked' or (marks is not null and marked_at is not null))
);
create index script_marks_marker on script_marks (marker_id, marked_at) where status = 'marked';
create index script_marks_moderation on script_marks (question_id) where moderation in ('pending', 'flagged');

-- AI দিয়ে খসড়া নম্বর: মূল্যায়নকারী খাতা হাতে নিয়ে চাইলে server (docs/ai/ai-draft-marks.route.js) খাতার ছবি,
-- প্রশ্ন, সমাধান আর নম্বর বিভাজন AI কে দেয়; অংশভিত্তিক নম্বর, ভুলের জায়গা আর মন্তব্য এখানে থাকে।
-- মূল্যায়নকারী দেখে নিজে নম্বর দেন। তাঁর নম্বর AI থেকে পূর্ণমানের moderation_tolerance % এর বেশি দূরে হলে
-- খাতাটা দ্বিতীয় যাচাইয়ে যায়। দ্বিতীয় যাচাই আর নমুনা খাতায় দেখানো হয় না (না দেখে কাটার নিয়ম)।
-- শুধু server (service role) লেখে, policy নেই; পড়া ai_draft_context() দিয়ে
create table ai_mark_drafts (
  attempt_id  bigint not null references exam_attempts(id) on delete cascade,
  question_id bigint not null references exam_questions(id) on delete cascade,
  marks       numeric(5,2) not null check (marks >= 0),
  parts       jsonb not null default '[]',   -- [{"label":"ক","max":2,"got":2,"status":"correct","comment":"...","img":0,"box":[..],"errors":[..]}]
  comment     text,
  model       text,
  created_at  timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

-- দ্বিতীয় যাচাই (moderation): বাছাই হওয়া খাতা আরেকজন মূল্যায়নকারী প্রথম নম্বর না দেখে কাটেন।
-- তিনিও পূর্ণমান × রেট সম্মানী পান। পার্থক্য বেশি হলে শিক্ষক final_marks ঠিক করেন (resolve_moderation)
create table script_moderations (
  attempt_id   bigint not null,
  question_id  bigint not null,
  moderator_id uuid not null references profiles(id),
  claimed_at   timestamptz not null default now(),
  marks        numeric(5,2) check (marks >= 0),
  marked_at    timestamptz,
  pay_amount   numeric(10,2) not null default 0,
  first_marks  numeric(5,2),        -- প্রথম মূল্যায়নকারীর নম্বর (চূড়ান্ত করার পর script_marks বদলালেও থাকে)
  final_marks  numeric(5,2),
  resolved_by  uuid references profiles(id),
  resolved_at  timestamptz,
  primary key (attempt_id, question_id),
  foreign key (attempt_id, question_id) references script_marks (attempt_id, question_id) on delete cascade
);
create index script_moderations_moderator on script_moderations (moderator_id, marked_at);

-- ক্যালিব্রেশন: শিক্ষক কোনো প্রশ্নের ১-৩টা কাটা খাতা "নমুনা" করেন। নতুন মূল্যায়নকারী সেই প্রশ্নের
-- আসল খাতা পাওয়ার আগে নমুনাগুলো কাটেন (শিক্ষকের নম্বর না দেখে); অন্তত দুই-তৃতীয়াংশ পার্থক্যসীমার
-- মধ্যে হলে কাটা শুরু, না হলে শিক্ষক দেখে অনুমতি দেন। শিক্ষক আর admin এর দরকার নেই
create table calibration_refs (
  question_id bigint not null references exam_questions(id) on delete cascade,
  attempt_id  bigint not null references exam_attempts(id) on delete cascade,
  ref_marks   numeric(5,2) not null check (ref_marks >= 0),
  set_by      uuid not null references profiles(id),
  created_at  timestamptz not null default now(),
  primary key (question_id, attempt_id)
);
create table calibration_marks (
  user_id     uuid not null references profiles(id) on delete cascade,
  question_id bigint not null,
  attempt_id  bigint not null,
  marks       numeric(5,2) not null,
  within      boolean not null,               -- শিক্ষকের নম্বরের কাছাকাছি কিনা
  created_at  timestamptz not null default now(),
  primary key (user_id, question_id, attempt_id),
  foreign key (question_id, attempt_id) references calibration_refs (question_id, attempt_id) on delete cascade
);
create table calibration_approvals (
  user_id     uuid not null references profiles(id) on delete cascade,
  question_id bigint not null references exam_questions(id) on delete cascade,
  approved_by uuid not null references profiles(id),
  created_at  timestamptz not null default now(),
  primary key (user_id, question_id)
);

-- পুনর্মূল্যায়নের আবেদন: ফল প্রকাশের পর recheck_days এর মধ্যে, প্রশ্নভিত্তিক, কারণসহ (এক পরীক্ষায় সর্বোচ্চ ৩টি)।
-- যিনি প্রথমে কেটেছিলেন তিনি নন, কোর্সের অন্য শিক্ষক বা admin দেখেন (resolve_recheck)
create table recheck_requests (
  id          bigint generated always as identity primary key,
  attempt_id  bigint not null references exam_attempts(id) on delete cascade,
  question_id bigint not null references exam_questions(id) on delete cascade,
  user_id     uuid not null references profiles(id),
  reason      text not null check (length(btrim(reason)) between 5 and 500),
  status      recheck_status not null default 'pending',
  old_marks   numeric(5,2),
  new_marks   numeric(5,2),
  reply       text,
  resolved_by uuid references profiles(id),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  unique (attempt_id, question_id)
);
create index recheck_requests_pending on recheck_requests (created_at) where status = 'pending';

-- পরীক্ষা চলার সময়ের ঘটনা (ট্যাব বদল, নেট যাওয়া-আসা, কপি)। save_answers লেখে;
-- কোনো policy নেই, শিক্ষক দেখেন exam_integrity() দিয়ে
create table attempt_events (
  id          bigint generated always as identity primary key,
  attempt_id  bigint not null references exam_attempts(id) on delete cascade,
  kind        exam_event_kind not null,
  at          timestamptz not null default now(),   -- server এ পৌঁছানোর সময়
  seconds     int check (seconds between 0 and 86400),  -- ট্যাব বা নেটের বাইরে কতক্ষণ (ফোনের হিসাব, শুধু তথ্য)
  meta        jsonb
);
create index attempt_events_attempt on attempt_events (attempt_id);

-- পরীক্ষা শুরুর পর যত সংশোধন: উত্তর-চাবি বদল, প্রশ্ন বাতিল, প্রকাশের পর খাতার নম্বর বদল।
-- পরীক্ষা শেষে শিক্ষার্থীরাও প্রশ্নের সংশোধনগুলো দেখে (কেন নম্বর বদলাল)
create table exam_corrections (
  id          bigint generated always as identity primary key,
  exam_id     bigint not null references exams(id) on delete cascade,
  question_id bigint references exam_questions(id) on delete cascade,
  attempt_id  bigint references exam_attempts(id) on delete cascade,  -- শুধু খাতার নম্বর সংশোধনে
  action      text not null check (action in ('key', 'drop', 'award', 'restore', 'marks')),
  old_value   jsonb,
  new_value   jsonb,
  reason      text not null,
  by_user     uuid not null references profiles(id),
  created_at  timestamptz not null default now()
);
create index exam_corrections_exam on exam_corrections (exam_id, created_at);

-- মেধাক্রম: ফল তৈরি হলে একবার হিসাব করে রাখা (হাজারো শিক্ষার্থী প্রতিবার নতুন করে হিসাব না করায়)।
-- সমান নম্বরে যে কম সময়ে জমা দিয়েছে সে আগে; সময়ও সমান হলে একই অবস্থান। policy নেই, function দিয়ে পড়া
create table exam_ranks (
  exam_id       bigint not null references exams(id) on delete cascade,
  attempt_id    bigint not null references exam_attempts(id) on delete cascade,
  user_id       uuid not null references profiles(id),
  score         numeric(6,2),
  seconds_taken int not null,
  rank_no       int not null,
  primary key (exam_id, attempt_id)
);

-- খাতা কাটার সম্মানী: প্রতি নম্বর কত টাকা (admin ঠিক করেন)। রেট বদলালে আগের কাটা খাতার টাকা
-- বদলায় না, কারণ প্রতিটি কাটা খাতায় তখনকার টাকা বসে যায় (script_marks.pay_amount)
create table marking_rates (
  id             bigint generated always as identity primary key,
  per_mark       numeric(8,2) not null check (per_mark >= 0),
  effective_from timestamptz not null default now(),
  set_by         uuid not null default auth.uid() references profiles(id)
);

-- প্রশ্নের ধরন পরীক্ষার ধরনের সাথে মিলতে হবে (MCQ পরীক্ষায় লিখিত প্রশ্ন নয়, লিখিততে MCQ নয়),
-- আর অধ্যায় একই কোর্সের হতে হবে
create function public.check_question_kind() returns trigger
language plpgsql set search_path = '' as $$
declare
  e public.exams;
begin
  select * into e from public.exams where id = new.exam_id;
  if (e.kind = 'mcq' and new.kind <> 'mcq') or (e.kind = 'written' and new.kind <> 'written') then
    raise exception 'এই পরীক্ষায় % প্রশ্ন দেওয়া যায় না', case new.kind when 'mcq' then 'MCQ' else 'লিখিত' end;
  end if;
  if new.chapter_id is not null
     and not exists (select 1 from public.chapters c where c.id = new.chapter_id and c.course_id = e.course_id) then
    raise exception 'অধ্যায়টি এই পরীক্ষার কোর্সের নয়';
  end if;
  return new;
end $$;

create trigger exam_question_kind before insert or update of kind, exam_id, chapter_id on exam_questions
  for each row execute function public.check_question_kind();

-- পরীক্ষা শুরু হয়েছে কিনা: কেউ শুরু করেছে, অথবা প্রকাশিত আর খোলার সময় পার হয়েছে
create function public.exam_started(p_exam_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.exams e
                  where e.id = p_exam_id and e.is_published and coalesce(e.opens_at, '-infinity') <= now())
      or exists (select 1 from public.exam_attempts a where a.exam_id = p_exam_id)
$$;

-- শুরুর পর প্রশ্নপত্র বন্ধ: app থেকে (authenticated/anon রোলে) প্রশ্ন যোগ, বদল বা মোছা যায় না।
-- উত্তরে ভুল থাকলে correct_exam_question() দিয়ে, যেটা কারণসহ লেখা থাকে আর সবার নম্বর আবার হিসাব করে।
-- (security definer function গুলো নিজের নিয়মে চলে, তাই এই trigger তাদের আটকায় না)
create function public.freeze_started_paper() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and (
       (tg_op <> 'INSERT' and public.exam_started(old.exam_id))
    or (tg_op <> 'DELETE' and public.exam_started(new.exam_id))) then
    raise exception 'পরীক্ষা শুরু হয়ে গেছে, প্রশ্নপত্র আর বদলানো যায় না। উত্তরে ভুল থাকলে "সংশোধন" ব্যবহার করুন'
      using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger exam_paper_frozen before insert or update or delete on exam_questions
  for each row execute function public.freeze_started_paper();

-- শুরুর পর পরীক্ষার সময়, নম্বর আর নিয়মও বদলানো যায় না (সময় বাড়ানো বা কমানো নয়, সবার জন্য এক নিয়ম)।
-- প্রকাশ বন্ধ (is_published) জরুরি দরকারে করা যায়
create function public.freeze_started_exam() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and public.exam_started(old.id) and (
       tg_op = 'DELETE'
       or (new.course_id, new.kind, new.duration_minutes, new.negative_mark, new.opens_at, new.closes_at,
           new.pick_rules, new.shuffle, new.submit_on_hide, new.upload_grace_minutes, new.moderation_percent,
           new.moderation_tolerance)
          is distinct from
          (old.course_id, old.kind, old.duration_minutes, old.negative_mark, old.opens_at, old.closes_at,
           old.pick_rules, old.shuffle, old.submit_on_hide, old.upload_grace_minutes, old.moderation_percent,
           old.moderation_tolerance)) then
    raise exception 'পরীক্ষা শুরুর পর সময়, নম্বর বা নিয়ম বদলানো যায় না' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger exam_rules_frozen before update or delete on exams
  for each row execute function public.freeze_started_exam();

-- প্রকাশের আগে যাচাই (app থেকে প্রকাশ করলে, আর প্রকাশিত পরীক্ষার সময় বা ধরন বদলালে):
--   শুরু আর শেষের সময় দেওয়া; শেষ সময় ভবিষ্যতে আর অন্তত শুরু + পরীক্ষার সময় (নইলে কেউ পুরো সময় পায় না);
--   ধরন অনুযায়ী প্রশ্ন আছে (মিশ্রে MCQ আর লিখিত দুটোই); "যেকোনো N টি" নিয়মের সেকশন আছে আর N ঠিক
create function public.check_exam_publish() returns trigger
language plpgsql set search_path = '' as $$
declare
  n_mcq int;
  n_written int;
  r record;
  v_n int;
begin
  if current_user not in ('authenticated', 'anon') or not new.is_published then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.is_published
     and (new.opens_at, new.closes_at, new.duration_minutes, new.kind, new.pick_rules)
         is not distinct from (old.opens_at, old.closes_at, old.duration_minutes, old.kind, old.pick_rules) then
    return new;
  end if;
  if new.opens_at is null or new.closes_at is null then
    raise exception 'প্রকাশের আগে পরীক্ষা শুরু আর শেষের সময় দিন';
  end if;
  if new.closes_at <= now() then
    raise exception 'শেষের সময় পেরিয়ে গেছে, নতুন সময় দিন';
  end if;
  if new.closes_at < new.opens_at + make_interval(mins => new.duration_minutes) then
    raise exception 'শেষের সময় অন্তত শুরু + % মিনিট হতে হবে, নইলে কেউ পুরো সময় পাবে না', new.duration_minutes;
  end if;
  select count(*) filter (where q.kind = 'mcq'), count(*) filter (where q.kind = 'written')
    into n_mcq, n_written from public.exam_questions q where q.exam_id = new.id;
  if (new.kind = 'mcq' and n_mcq = 0) or (new.kind = 'written' and n_written = 0)
     or (new.kind = 'mixed' and (n_mcq = 0 or n_written = 0)) then
    raise exception 'প্রশ্ন ছাড়া প্রকাশ করা যায় না (MCQ %টি, লিখিত %টি আছে)', n_mcq, n_written;
  end if;
  if (new.kind = 'mcq' and n_written > 0) or (new.kind = 'written' and n_mcq > 0) then
    raise exception 'পরীক্ষার ধরনের সাথে প্রশ্ন মেলে না';
  end if;
  for r in select j.key, j.value from jsonb_each(new.pick_rules) j loop
    select count(*) into v_n from public.exam_questions q
     where q.exam_id = new.id and q.kind = 'written' and q.section = r.key;
    if jsonb_typeof(r.value) <> 'number' or (r.value #>> '{}')::numeric not between 1 and v_n
       or (r.value #>> '{}')::numeric <> trunc((r.value #>> '{}')::numeric) then
      raise exception '"%" সেকশনে %টি প্রশ্ন আছে, "যেকোনো" সংখ্যা ১ থেকে % এর মধ্যে দিন', r.key, v_n, v_n;
    end if;
  end loop;
  return new;
end $$;

create trigger exam_publish_check before insert or update on exams
  for each row execute function public.check_exam_publish();

-- প্রকাশিত (শুরু হয়নি) পরীক্ষার কোনো ধরনের শেষ প্রশ্নটা মোছা যায় না; আগে প্রকাশ বন্ধ করুন
create function public.keep_published_paper() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon')
     and exists (select 1 from public.exams e where e.id = old.exam_id and e.is_published)
     and not exists (select 1 from public.exam_questions q
                      where q.exam_id = old.exam_id and q.kind = old.kind and q.id <> old.id) then
    raise exception 'প্রকাশিত পরীক্ষার শেষ % প্রশ্নটা মোছা যায় না, আগে প্রকাশ বন্ধ করুন',
      case old.kind when 'mcq' then 'MCQ' else 'লিখিত' end;
  end if;
  return old;
end $$;

create trigger exam_paper_not_empty before delete on exam_questions
  for each row execute function public.keep_published_paper();

-- ================= Public ও system =================
create table admission_circulars (
  id           bigint generated always as identity primary key,
  institution  text not null,
  title        text not null,
  body         text,
  apply_url    text,
  deadline     date,
  published_at timestamptz not null default now()
);

create table audit_logs (
  id         bigint generated always as identity primary key,
  actor_id   uuid references profiles(id),
  action     text not null,                  -- payment.approve, role.change ...
  entity     text not null,
  entity_id  text,
  meta       jsonb,
  created_at timestamptz not null default now()
);

create table sms_logs (
  id          bigint generated always as identity primary key,
  user_id     uuid references profiles(id),
  phone       text not null,
  purpose     text not null,                 -- otp / payment / class
  provider_id text,
  status      text not null,                 -- sent / failed
  created_at  timestamptz not null default now()
);                                           -- OTP এর কোড এখানে রাখা হয় না

create table webhook_events (
  idempotency_key text primary key,          -- JaaS / Bunny event এর id
  source          text not null,
  received_at     timestamptz not null default now()
);

-- ================= শিক্ষকের ক্লাস ও সম্মানী =================
-- প্রতি ক্লাসের সম্মানী, admin ঠিক করে
create table teacher_rates (
  teacher_id uuid primary key references profiles(id) on delete cascade,
  per_class  numeric(10,2) not null check (per_class >= 0),
  updated_at timestamptz not null default now()
);

-- কোন শিক্ষক কবে কোন ক্লাস নেবেন। শুধু নেওয়া (done) ক্লাস থেকে সম্মানী হিসাব হয়
create table class_assignments (
  id              bigint generated always as identity primary key,
  teacher_id      uuid not null references profiles(id),
  course_id       bigint not null references courses(id),
  topic           text not null,
  class_type      class_type not null,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  pay_amount      numeric(10,2) not null check (pay_amount >= 0),  -- অ্যাসাইনের সময়ের রেট; পরে রেট বদলালেও এটা থাকে
  status          class_status not null default 'assigned',
  live_session_id uuid references live_sessions(id) on delete set null,
  cancel_reason   text,
  completed_at    timestamptz,
  assigned_by     uuid references profiles(id),
  created_at      timestamptz not null default now(),
  check (ends_at > starts_at),
  -- একই শিক্ষকের সময় মিলে যাওয়া দুটো অ্যাসাইন করা ক্লাস হবে না (error code 23P01)
  exclude using gist (teacher_id with =, tstzrange(starts_at, ends_at) with &&)
    where (status = 'assigned')
);
create index class_assignments_teacher on class_assignments (teacher_id, starts_at);

-- শিক্ষককে দেওয়া টাকা। টাকা আগে bKash/নগদ/ব্যাংকে পাঠিয়ে তারপর এখানে রেকর্ড হয়
create table teacher_payouts (
  id         bigint generated always as identity primary key,
  teacher_id uuid not null references profiles(id),
  period     date not null check (extract(day from period) = 1),  -- কোন মাসের সম্মানী (মাসের ১ তারিখ)
  amount     numeric(10,2) not null check (amount > 0),
  method     payout_method not null,
  account    text,                           -- যে নম্বর বা অ্যাকাউন্টে পাঠানো হয়েছে
  reference  text,                           -- TrxID বা ব্যাংক রেফারেন্স
  note       text,
  paid_by    uuid not null references profiles(id),
  paid_at    timestamptz not null default now(),
  check (method = 'cash' or (account is not null and reference is not null))
);
create index teacher_payouts_period on teacher_payouts (period, teacher_id);

-- লাইভ ক্লাস শেষ হলে অ্যাসাইন করা ক্লাসটি নিজে থেকে "নেওয়া হয়েছে" হয়
create function public.finish_class_on_live_end() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.class_assignments
     set status = 'done', completed_at = coalesce(new.ended_at, now())
   where live_session_id = new.id and status = 'assigned';
  return new;
end $$;

create trigger live_end_finishes_class after update of status on live_sessions
  for each row when (new.status = 'ended' and old.status <> 'ended')
  execute function public.finish_class_on_live_end();

-- ================= অন্য খরচ =================
-- শিক্ষক সম্মানী ছাড়া বাকি খরচ: সার্ভিস বিল, SMS রিচার্জ, রিফান্ড
create table expenses (
  id          bigint generated always as identity primary key,
  category    expense_category not null,
  description text not null,
  amount      numeric(10,2) not null check (amount > 0),
  method      text,
  reference   text,
  payment_id  bigint references payments(id),  -- রিফান্ড হলে কোন পেমেন্টের টাকা ফেরত
  spent_at    timestamptz not null default now(),
  recorded_by uuid not null default auth.uid() references profiles(id),
  created_at  timestamptz not null default now(),
  check (category <> 'refund' or payment_id is not null)
);

-- ================= নোটিশ =================
create table notices (
  id         bigint generated always as identity primary key,
  title      text,
  body       text not null,
  audience   notice_audience not null,
  course_id  bigint references courses(id) on delete cascade,
  channel    notice_channel not null default 'site',
  recipients int not null default 0,
  sent_by    uuid not null default auth.uid() references profiles(id),
  created_at timestamptz not null default now(),
  check ((audience = 'course') = (course_id is not null)),
  check (channel = 'sms' or title is not null)   -- ওয়েবসাইটে দেখালে শিরোনাম লাগবে
);

-- একজনের জন্য নোটিফিকেশন (ওয়েবসাইটের ঘণ্টা আইকনে দেখায়)। notices সবার জন্য ঘোষণা, এটা ব্যক্তিগত।
--   qa_answer:   শিক্ষার্থীর প্রশ্নের উত্তর এসেছে (qa_answers এর trigger পাঠায়)
--   qa_reminder: প্রশ্নের উত্তর দিতে বলা হয়েছে। শিক্ষককে admin বা manager (remind_teacher()),
--                manager কে admin (remind_manager())
--   script_returned: কাটা খাতা আবার কাটতে ফেরত এসেছে (return_script_mark())
--   exam_result: লিখিত/মিশ্র পরীক্ষার ফল প্রকাশ হয়েছে (publish_written_results())
create table notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references profiles(id) on delete cascade,   -- যে পাবে
  kind        notification_kind not null,
  question_id bigint references qa_questions(id) on delete cascade,
  exam_id     bigint references exams(id) on delete cascade,   -- script_returned, exam_result
  body        text not null,
  sent_by     uuid references profiles(id) on delete set null,
  via_sms     boolean not null default false,  -- SMS ও যাবে কিনা; পাঠায় API route, লেখে sms_logs এ
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, created_at desc);
create index notifications_reminder_idx on notifications (question_id, user_id, created_at desc)
  where kind = 'qa_reminder';

-- ================= মাসিক লেনদেন =================
-- আয় (অনুমোদিত পেমেন্ট) আর খরচ (সম্মানী + অন্য খরচ) এক জায়গায়। শুধু admin দেখে।
-- security_invoker থাকায় নিচের টেবিলগুলোর RLS ও মানা হয়
create view public.transactions with (security_invoker = on) as
select * from (
  select 'payment-' || p.id  as id,
         p.reviewed_at       as happened_at,
         'income'::text      as direction,
         'fee'::text         as category,
         p.amount,
         p.course_id,
         p.user_id           as party_id,
         'bKash'::text       as method,
         p.trx_id            as reference,
         p.reviewed_by       as recorded_by
    from public.payments p
   where p.status = 'approved'
  union all
  select 'payout-' || t.id, t.paid_at, 'expense', 'teacher', t.amount, null::bigint,
         t.teacher_id, t.method::text, t.reference, t.paid_by
    from public.teacher_payouts t
  union all
  select 'expense-' || e.id, e.spent_at, 'expense', e.category::text, e.amount, null::bigint,
         null::uuid, e.method, e.reference, e.recorded_by
    from public.expenses e
) all_tx
where public.my_role() = 'admin';

revoke all on public.transactions from anon;

create index payments_approved_at on payments (reviewed_at) where status = 'approved';
create index expenses_spent_at on expenses (spent_at);

-- ================= Helper function =================
create function public.is_enrolled(p_course_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.enrollments
    where user_id = auth.uid() and course_id = p_course_id and status = 'active'
      and (expires_at is null or expires_at > now())
  )
$$;

create function public.teaches(p_course_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.course_teachers
    where teacher_id = auth.uid() and course_id = p_course_id
  )
$$;

-- পরীক্ষার মোট নম্বর। প্রশ্ন বা উত্তর না দেখিয়ে শুধু যোগফল দেয়।
-- লিখিত অংশে "যেকোনো ৫টি" থাকলে সেকশন থেকে ৫টির নম্বর ধরা হয় (সবচেয়ে বেশি নম্বরেরগুলো)।
-- বাতিল (drop) প্রশ্ন মোট থেকে বাদ; award প্রশ্ন থাকে (সবাই পূর্ণ নম্বর পায়)
create function public.exam_total_marks(p_exam_id bigint) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(x.marks), 0)
    from (select q.marks,
                 row_number() over (partition by q.kind, q.section order by q.marks desc, q.id) as rn,
                 case when q.kind = 'written' then (e.pick_rules ->> q.section)::int end as pick
            from public.exam_questions q
            join public.exams e on e.id = q.exam_id
           where q.exam_id = p_exam_id and q.cancelled is distinct from 'drop') x
   where x.pick is null or x.rn <= x.pick
$$;

-- শুধু MCQ অংশের মোট নম্বর
create function public.exam_mcq_total(p_exam_id bigint) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(marks), 0) from public.exam_questions
   where exam_id = p_exam_id and kind = 'mcq' and cancelled is distinct from 'drop'
$$;

-- এই শিক্ষার্থী কি আমার (শিক্ষকের) কোনো কোর্সে ভর্তি
create function public.teaches_student(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.enrollments en
      join public.course_teachers ct on ct.course_id = en.course_id
     where en.user_id = p_user_id and ct.teacher_id = auth.uid() and en.status = 'active'
  )
$$;

-- ================= Payment approve / reject =================
create function public.approve_payment(p_payment_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.payments;
begin
  if not public.is_staff() then
    raise exception 'শুধু admin বা manager approve করতে পারে';
  end if;

  update public.payments
     set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_payment_id and status = 'pending'
  returning * into p;

  if not found then
    raise exception 'Payment পাওয়া যায়নি বা আগেই review হয়েছে';
  end if;

  insert into public.enrollments (user_id, course_id, payment_id, status)
  values (p.user_id, p.course_id, p.id, 'active')
  on conflict (user_id, course_id)
  do update set status = 'active', payment_id = excluded.payment_id, enrolled_at = now();

  insert into public.audit_logs (actor_id, action, entity, entity_id)
  values (auth.uid(), 'payment.approve', 'payments', p.id::text);
end $$;

create function public.reject_payment(p_payment_id bigint, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'শুধু admin বা manager reject করতে পারে';
  end if;

  update public.payments
     set status = 'rejected', reject_reason = p_reason,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_payment_id and status = 'pending';

  if not found then
    raise exception 'Payment পাওয়া যায়নি বা আগেই review হয়েছে';
  end if;

  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'payment.reject', 'payments', p_payment_id::text,
          jsonb_build_object('reason', p_reason));
end $$;

-- Admin শুধু student, teacher আর manager রোল দিতে পারে। নতুন admin বানানো বা
-- কোনো admin এর রোল বদলানো হয় সরাসরি database থেকে, ড্যাশবোর্ড থেকে নয়।
-- নতুন শিক্ষক/ম্যানেজার: server এ service role দিয়ে auth user তৈরি, তারপর এই function
create function public.set_role(p_user_id uuid, p_role public.user_role) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_old public.user_role;
begin
  if public.my_role() is distinct from 'admin' then
    raise exception 'শুধু admin role বদলাতে পারে';
  end if;
  if p_role = 'admin' then
    raise exception 'admin রোল ড্যাশবোর্ড থেকে দেওয়া যায় না';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'নিজের রোল নিজে বদলানো যায় না';
  end if;

  select role into v_old from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'ইউজার পাওয়া যায়নি';
  end if;
  if v_old = 'admin' then
    raise exception 'admin এর রোল ড্যাশবোর্ড থেকে বদলানো যায় না';
  end if;

  update public.profiles set role = p_role where id = p_user_id;

  -- শিক্ষক না থাকলে কোর্স থেকে সরানো আর সামনের ক্লাস বাতিল
  if v_old = 'teacher' and p_role <> 'teacher' then
    delete from public.course_teachers where teacher_id = p_user_id;
    update public.class_assignments
       set status = 'cancelled', cancel_reason = 'শিক্ষক রোল সরানো হয়েছে'
     where teacher_id = p_user_id and status = 'assigned';
  end if;
  -- হাতে ধরে রাখা (কাটা শেষ হয়নি) খাতা ছেড়ে দেওয়া, যাতে অন্যরা কাটতে পারেন
  delete from public.script_marks where marker_id = p_user_id and status = 'claimed';

  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'role.change', 'profiles', p_user_id::text,
          jsonb_build_object('from', v_old, 'to', p_role));
end $$;

-- খাতা মূল্যায়নকারী যোগ বা বাদ (admin ও manager)। শুধু শিক্ষার্থী ↔ মূল্যায়নকারী বদলানো যায়;
-- শিক্ষক, manager বা admin কে এভাবে বদলানো যায় না।
-- নতুন মানুষ হলে: server এ service role দিয়ে auth user (ফোন) তৈরি, তারপর এই function
create function public.set_evaluator(p_user_id uuid, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_old public.user_role;
begin
  if not public.is_staff() then
    raise exception 'শুধু admin বা manager মূল্যায়নকারী যোগ করতে পারেন' using errcode = '42501';
  end if;
  select role into v_old from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'ইউজার পাওয়া যায়নি';
  end if;
  if v_old not in ('student', 'evaluator') then
    raise exception 'শুধু শিক্ষার্থী আইডিকে মূল্যায়নকারী করা যায় (এখন: %)', v_old;
  end if;
  if (v_old = 'evaluator') = p_on then
    return;   -- আগে থেকেই এই অবস্থায়
  end if;

  update public.profiles set role = case when p_on then 'evaluator' else 'student' end::public.user_role
   where id = p_user_id;
  if not p_on then
    delete from public.script_marks where marker_id = p_user_id and status = 'claimed';
  end if;

  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), case when p_on then 'evaluator.add' else 'evaluator.remove' end, 'profiles', p_user_id::text, null);
end $$;

-- ================= Enrollment (admin ও manager) =================
-- পেমেন্ট ছাড়া এনরোল: স্কলারশিপ, ক্যাশ ইত্যাদি। কারণ লিখতেই হবে
create function public.manual_enroll(p_user_id uuid, p_course_id bigint,
                                     p_expires_at timestamptz, p_note text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_id bigint;
begin
  if not public.is_staff() then
    raise exception 'শুধু admin বা manager এনরোল করতে পারে';
  end if;
  if coalesce(trim(p_note), '') = '' then
    raise exception 'ম্যানুয়াল এনরোলের কারণ লিখতে হবে';
  end if;
  if exists (select 1 from public.enrollments
              where user_id = p_user_id and course_id = p_course_id and status = 'active'
                and (expires_at is null or expires_at > now())) then
    raise exception 'এই কোর্সে আগেই সক্রিয় আছে';
  end if;
  -- admin যেটা বাতিল করেছে, manager সেটা আবার চালু করতে পারবে না
  if exists (select 1 from public.enrollments
              where user_id = p_user_id and course_id = p_course_id and status = 'revoked')
     and public.my_role() is distinct from 'admin' then
    raise exception 'বাতিল হওয়া এনরোলমেন্ট শুধু admin আবার চালু করতে পারে';
  end if;

  insert into public.enrollments (user_id, course_id, status, expires_at, note)
  values (p_user_id, p_course_id, 'active', p_expires_at, p_note)
  on conflict (user_id, course_id)
  do update set status = 'active', payment_id = null, enrolled_at = now(),
                expires_at = excluded.expires_at, note = excluded.note
  returning id into v_id;

  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'enrollment.manual', 'enrollments', v_id::text,
          jsonb_build_object('user_id', p_user_id, 'course_id', p_course_id, 'note', p_note));
  return v_id;
end $$;

-- মেয়াদ বাড়ানো। p_expires_at null মানে আজীবন। কমানো যায় না
create function public.extend_enrollment(p_enrollment_id bigint, p_expires_at timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'শুধু admin বা manager মেয়াদ বাড়াতে পারে';
  end if;

  update public.enrollments
     set expires_at = p_expires_at, status = 'active'
   where id = p_enrollment_id and status <> 'revoked'
     and expires_at is not null
     and (p_expires_at is null or p_expires_at > greatest(expires_at, now()));

  if not found then
    raise exception 'এনরোলমেন্ট পাওয়া যায়নি, বাতিল হয়েছে, আজীবন আছে, বা নতুন মেয়াদ আগের চেয়ে পরে নয়';
  end if;

  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'enrollment.extend', 'enrollments', p_enrollment_id::text,
          jsonb_build_object('expires_at', p_expires_at));
end $$;

-- বাতিল শুধু admin (রিফান্ডের সাথে জড়িত)। আবার চালু করতে admin manual_enroll() ব্যবহার করে
create function public.revoke_enrollment(p_enrollment_id bigint, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.my_role() is distinct from 'admin' then
    raise exception 'শুধু admin এনরোলমেন্ট বাতিল করতে পারে';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'বাতিলের কারণ লিখতে হবে';
  end if;

  update public.enrollments set status = 'revoked'
   where id = p_enrollment_id and status <> 'revoked';
  if not found then
    raise exception 'এনরোলমেন্ট পাওয়া যায়নি বা আগেই বাতিল';
  end if;

  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'enrollment.revoke', 'enrollments', p_enrollment_id::text,
          jsonb_build_object('reason', p_reason));
end $$;

-- ================= ক্লাস অ্যাসাইন (admin ও manager) =================
-- p_pay না দিলে শিক্ষকের teacher_rates এর রেট বসে। লাইভ ক্লাস হলে live_sessions এও
-- শিডিউল তৈরি হয়। একই সময়ে শিক্ষকের আরেকটি ক্লাস থাকলে 23P01 error আসে
create function public.assign_class(p_teacher_id uuid, p_course_id bigint, p_topic text,
                                    p_type public.class_type, p_starts_at timestamptz,
                                    p_ends_at timestamptz, p_pay numeric default null) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_pay  numeric;
  v_live uuid;
  v_id   bigint;
begin
  if not public.is_staff() then
    raise exception 'শুধু admin বা manager ক্লাস অ্যাসাইন করতে পারে';
  end if;
  if not exists (select 1 from public.profiles where id = p_teacher_id and role = 'teacher') then
    raise exception 'এই ইউজার শিক্ষক নন';
  end if;
  if p_starts_at <= now() then
    raise exception 'সামনের কোনো সময় দিন';
  end if;

  v_pay := coalesce(p_pay, (select per_class from public.teacher_rates where teacher_id = p_teacher_id));
  if v_pay is null then
    raise exception 'এই শিক্ষকের প্রতি ক্লাসের সম্মানী ঠিক করা নেই';
  end if;

  -- শিক্ষক কোর্সে না থাকলে যুক্ত করা
  insert into public.course_teachers (course_id, teacher_id)
  values (p_course_id, p_teacher_id) on conflict do nothing;

  if p_type = 'live' then
    insert into public.live_sessions (course_id, teacher_id, title, scheduled_at)
    values (p_course_id, p_teacher_id, p_topic, p_starts_at)
    returning id into v_live;
  end if;

  insert into public.class_assignments (teacher_id, course_id, topic, class_type, starts_at,
                                        ends_at, pay_amount, live_session_id, assigned_by)
  values (p_teacher_id, p_course_id, p_topic, p_type, p_starts_at, p_ends_at, v_pay, v_live, auth.uid())
  returning id into v_id;

  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'class.assign', 'class_assignments', v_id::text,
          jsonb_build_object('teacher_id', p_teacher_id, 'course_id', p_course_id, 'starts_at', p_starts_at));
  return v_id;
end $$;

-- অন্য শিক্ষককে দেওয়া। সম্মানী নতুন শিক্ষকের রেটে বদলায়
create function public.reassign_class(p_class_id bigint, p_teacher_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.class_assignments;
begin
  if not public.is_staff() then
    raise exception 'শুধু admin বা manager শিক্ষক বদলাতে পারে';
  end if;
  if not exists (select 1 from public.profiles where id = p_teacher_id and role = 'teacher') then
    raise exception 'এই ইউজার শিক্ষক নন';
  end if;

  select * into c from public.class_assignments
   where id = p_class_id and status = 'assigned' for update;
  if not found then
    raise exception 'ক্লাস পাওয়া যায়নি বা আর অ্যাসাইন অবস্থায় নেই';
  end if;

  update public.class_assignments
     set teacher_id = p_teacher_id,
         pay_amount = coalesce((select per_class from public.teacher_rates where teacher_id = p_teacher_id), pay_amount)
   where id = p_class_id;

  insert into public.course_teachers (course_id, teacher_id)
  values (c.course_id, p_teacher_id) on conflict do nothing;

  if c.live_session_id is not null then
    update public.live_sessions set teacher_id = p_teacher_id where id = c.live_session_id;
  end if;

  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'class.reassign', 'class_assignments', p_class_id::text,
          jsonb_build_object('from', c.teacher_id, 'to', p_teacher_id, 'reason', p_reason));
end $$;

-- বাতিল ক্লাসের জন্য সম্মানী হয় না। শিডিউল থাকা লাইভ সেশনও মুছে যায়
create function public.cancel_class(p_class_id bigint, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_live uuid;
begin
  if not public.is_staff() then
    raise exception 'শুধু admin বা manager ক্লাস বাতিল করতে পারে';
  end if;

  update public.class_assignments
     set status = 'cancelled', cancel_reason = p_reason
   where id = p_class_id and status = 'assigned'
  returning live_session_id into v_live;
  if not found then
    raise exception 'ক্লাস পাওয়া যায়নি বা আর অ্যাসাইন অবস্থায় নেই';
  end if;

  if v_live is not null then
    delete from public.live_sessions where id = v_live and status = 'scheduled';
  end if;

  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'class.cancel', 'class_assignments', p_class_id::text,
          jsonb_build_object('reason', p_reason));
end $$;

-- সলভ বা রেকর্ডেড ক্লাস হাতে "নেওয়া হয়েছে" করা (লাইভ ক্লাস trigger নিজেই করে)
create function public.complete_class(p_class_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'শুধু admin বা manager ক্লাস সম্পন্ন করতে পারে';
  end if;

  update public.class_assignments
     set status = 'done', completed_at = now()
   where id = p_class_id and status = 'assigned' and starts_at <= now();
  if not found then
    raise exception 'ক্লাস পাওয়া যায়নি, এখনো শুরু হয়নি, বা আগেই শেষ বা বাতিল';
  end if;

  insert into public.audit_logs (actor_id, action, entity, entity_id)
  values (auth.uid(), 'class.done', 'class_assignments', p_class_id::text);
end $$;

-- ================= সম্মানী: ক্লাস আর খাতা কাটা (admin ও manager) =================
-- কোনো মাসে কে কত পাবেন: নেওয়া ক্লাসের সম্মানী + কাটা খাতার সম্মানী, দেওয়া হয়েছে, বাকি।
-- শিক্ষক আর মূল্যায়নকারী দুজনেই এখানে আসেন (নামটা পুরনো, teacher_ledger)।
-- খাতার সম্মানী = কাটা প্রশ্নের পূর্ণমান × তখনকার প্রতি নম্বরের রেট (দেওয়া নম্বর নয়, যাতে
-- বেশি নম্বর দিলে বেশি টাকা না হয়)। admin এর কাটা খাতার টাকা হয় না।
-- p_period = মাসের ১ তারিখ। মাস ধরা হয় বাংলাদেশ সময়ে। নিজেরটা নিজে দেখতে পারেন
create function public.teacher_ledger(p_period date)
returns table (teacher_id uuid, full_name text, classes bigint, earned numeric, paid numeric, due numeric,
               class_earned numeric, scripts bigint, marks_checked numeric, marking_earned numeric)
language sql stable security definer set search_path = '' as $$
  with done as (
    select c.teacher_id, count(*) as classes, sum(c.pay_amount) as earned
      from public.class_assignments c
     where c.status = 'done'
       and date_trunc('month', c.starts_at at time zone 'Asia/Dhaka')::date = p_period
     group by c.teacher_id
  ), marked as (   -- প্রথমবার কাটা আর দ্বিতীয় যাচাই, দুটোরই সম্মানী
    select x.uid as teacher_id, count(*) as scripts, sum(x.full_marks) as marks_checked, sum(x.pay) as earned
      from (select m.marker_id as uid, q.marks as full_marks, m.pay_amount as pay, m.marked_at as at
              from public.script_marks m
              join public.exam_questions q on q.id = m.question_id
             where m.status = 'marked' and m.pay_amount > 0
            union all
            select s.moderator_id, q.marks, s.pay_amount, s.marked_at
              from public.script_moderations s
              join public.exam_questions q on q.id = s.question_id
             where s.marked_at is not null and s.pay_amount > 0) x
     where date_trunc('month', x.at at time zone 'Asia/Dhaka')::date = p_period
     group by x.uid
  ), paid as (
    select t.teacher_id, sum(t.amount) as paid
      from public.teacher_payouts t
     where t.period = p_period
     group by t.teacher_id
  )
  select pr.id, pr.full_name,
         coalesce(d.classes, 0),
         coalesce(d.earned, 0) + coalesce(mk.earned, 0),
         coalesce(pd.paid, 0),
         greatest(coalesce(d.earned, 0) + coalesce(mk.earned, 0) - coalesce(pd.paid, 0), 0),
         coalesce(d.earned, 0), coalesce(mk.scripts, 0), coalesce(mk.marks_checked, 0), coalesce(mk.earned, 0)
    from public.profiles pr
    left join done d    on d.teacher_id = pr.id
    left join marked mk on mk.teacher_id = pr.id
    left join paid pd   on pd.teacher_id = pr.id
   where (d.teacher_id is not null or mk.teacher_id is not null or pd.teacher_id is not null)
     and (public.is_staff() or pr.id = auth.uid())
$$;

-- সম্মানী দেওয়ার রেকর্ড (শিক্ষক বা মূল্যায়নকারী)। বাকির চেয়ে বেশি দেওয়া যায় না
create function public.record_teacher_payout(p_teacher_id uuid, p_period date, p_amount numeric,
                                             p_method public.payout_method, p_account text,
                                             p_reference text, p_note text default null) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_due numeric;
  v_id  bigint;
begin
  if not public.is_staff() then
    raise exception 'শুধু admin বা manager সম্মানী দিতে পারে';
  end if;

  -- একই শিক্ষকের দুটো পেমেন্ট একসাথে রেকর্ড হয়ে যেন বাকির বেশি না যায়
  perform 1 from public.profiles where id = p_teacher_id for update;
  if not found then
    raise exception 'শিক্ষক পাওয়া যায়নি';
  end if;

  select l.due into v_due from public.teacher_ledger(p_period) l where l.teacher_id = p_teacher_id;
  if p_amount is null or p_amount <= 0 or p_amount > coalesce(v_due, 0) then
    raise exception 'পরিমাণ ০ এর বেশি আর বাকি (৳%) এর বেশি নয় এমন হতে হবে', coalesce(v_due, 0);
  end if;

  insert into public.teacher_payouts (teacher_id, period, amount, method, account, reference, note, paid_by)
  values (p_teacher_id, p_period, p_amount, p_method, nullif(trim(p_account), ''),
          nullif(upper(trim(p_reference)), ''), p_note, auth.uid())
  returning id into v_id;

  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'teacher.pay', 'teacher_payouts', v_id::text,
          jsonb_build_object('teacher_id', p_teacher_id, 'period', p_period,
                             'amount', p_amount, 'method', p_method));
  return v_id;
end $$;

-- ================= মাসিক হিসাব (শুধু admin) =================
-- p_month = মাসের ১ তারিখ। খাতভিত্তিক হিসাব app এ transactions view group করে নেয়
create function public.month_summary(p_month date)
returns table (income numeric, expense numeric, net numeric, tx_count bigint)
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(t.amount) filter (where t.direction = 'income'), 0),
         coalesce(sum(t.amount) filter (where t.direction = 'expense'), 0),
         coalesce(sum(case when t.direction = 'income' then t.amount else -t.amount end), 0),
         count(*)
    from public.transactions t
   where date_trunc('month', t.happened_at at time zone 'Asia/Dhaka')::date = p_month
     and public.my_role() = 'admin'
$$;

-- ================= লাইভ ক্লাস [Broadcast] =================
-- কে দেখতে পারে: কোর্সে ভর্তি শিক্ষার্থী, কোর্সের শিক্ষক, admin ও manager
create function public.can_watch_live(p_session_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.live_sessions s
     where s.id = p_session_id
       and (public.is_enrolled(s.course_id) or public.teaches(s.course_id) or public.is_staff())
  )
$$;

-- কে লাইভ চালায় আর কমেন্ট সামলায়: ক্লাসের শিক্ষক, কোর্সের শিক্ষক বা admin
create function public.can_host_live(p_session_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.live_sessions s
     where s.id = p_session_id
       and (s.teacher_id = auth.uid() or public.teaches(s.course_id) or public.my_role() = 'admin')
  )
$$;

-- শিক্ষকের ব্রাউজার এই key দিয়ে মিডিয়া সার্ভারে ভিডিও পাঠায় (WHIP)
create function public.get_stream_key(p_session_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_host_live(p_session_id) then
    raise exception 'শুধু এই ক্লাসের শিক্ষক বা admin stream key পান';
  end if;
  return (select stream_key from public.live_stream_keys where session_id = p_session_id);
end $$;

create function public.start_live(p_session_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_host_live(p_session_id) then
    raise exception 'শুধু এই ক্লাসের শিক্ষক বা admin লাইভ শুরু করতে পারেন';
  end if;
  -- একই কোর্সে আরেকটা লাইভ চললে one_live_per_course index আটকাবে (23505)
  update public.live_sessions set status = 'live', started_at = now()
   where id = p_session_id and status = 'scheduled';
  if not found then
    raise exception 'সেশন পাওয়া যায়নি বা আগেই শুরু বা শেষ হয়েছে';
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id)
  values (auth.uid(), 'live.start', 'live_sessions', p_session_id::text);
end $$;

-- শেষ হলে trigger ক্লাসটা "নেওয়া হয়েছে" করে; মিডিয়া সার্ভারের রেকর্ডিং server
-- Bunny Stream এ পাঠিয়ে recording_lesson_id বসায়
create function public.end_live(p_session_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_host_live(p_session_id) then
    raise exception 'শুধু এই ক্লাসের শিক্ষক বা admin লাইভ শেষ করতে পারেন';
  end if;
  update public.live_sessions set status = 'ended', ended_at = now()
   where id = p_session_id and status = 'live';
  if not found then
    raise exception 'সেশনটি এখন লাইভ নেই';
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id)
  values (auth.uid(), 'live.end', 'live_sessions', p_session_id::text);
end $$;

-- প্লেয়ার প্রতি মিনিটে ডাকে: উপস্থিতি জমা হয়, আর এখন কতজন দেখছে সেটা ফেরত আসে
create function public.live_heartbeat(p_session_id uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_now int;
begin
  if not public.can_watch_live(p_session_id) then
    raise exception 'এই ক্লাস দেখার অনুমতি নেই';
  end if;
  if not exists (select 1 from public.live_sessions where id = p_session_id and status = 'live') then
    return 0;
  end if;

  -- শিক্ষক বা admin দর্শক হিসেবে গোনা হয় না
  if not public.can_host_live(p_session_id) then
    insert into public.live_views (session_id, user_id) values (p_session_id, auth.uid())
    on conflict (session_id, user_id) do update
      set watched_seconds = public.live_views.watched_seconds
            + least(90, greatest(0, extract(epoch from now() - public.live_views.last_seen_at)))::int,
          last_seen_at = now();
  end if;

  select count(*) into v_now from public.live_views
   where session_id = p_session_id and last_seen_at > now() - interval '90 seconds';
  update public.live_sessions set peak_viewers = greatest(peak_viewers, v_now) where id = p_session_id;
  return v_now;
end $$;

-- কমেন্টের নিয়ম: শুধু লাইভ চলার সময়; শিক্ষার্থীর জন্য ১০ সেকেন্ডে একটা (slow mode);
-- pin বা delete এর মতো ঘরগুলো শিক্ষার্থী নিজে বসাতে পারে না
create function public.live_comment_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  s public.live_sessions;
begin
  select * into s from public.live_sessions where id = new.session_id;
  if s.status is distinct from 'live' then
    raise exception 'লাইভ চলার সময়ই শুধু কমেন্ট করা যায়';
  end if;

  new.user_id := auth.uid();
  new.is_pinned := false;
  new.is_resolved := false;
  new.deleted_at := null;
  new.deleted_by := null;
  new.created_at := now();

  if not public.can_host_live(new.session_id)
     and exists (select 1 from public.live_comments c
                  where c.session_id = new.session_id and c.user_id = new.user_id
                    and c.created_at > now() - interval '10 seconds') then
    raise exception 'একটু অপেক্ষা করুন, ১০ সেকেন্ডে একটা কমেন্ট করা যায়';
  end if;
  return new;
end $$;

create trigger live_comments_guard before insert on live_comments
  for each row execute function public.live_comment_guard();

-- শিক্ষক বা admin: pin, unpin, resolve, unresolve, delete। একসাথে একটাই pin থাকে
create function public.moderate_comment(p_comment_id bigint, p_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_session uuid;
begin
  select session_id into v_session from public.live_comments where id = p_comment_id;
  if v_session is null then
    raise exception 'কমেন্ট পাওয়া যায়নি';
  end if;
  if not public.can_host_live(v_session) then
    raise exception 'শুধু শিক্ষক বা admin কমেন্ট সামলাতে পারেন';
  end if;

  if p_action = 'pin' then
    update public.live_comments set is_pinned = false where session_id = v_session and is_pinned;
    update public.live_comments set is_pinned = true where id = p_comment_id;
  elsif p_action = 'unpin' then
    update public.live_comments set is_pinned = false where id = p_comment_id;
  elsif p_action in ('resolve', 'unresolve') then
    update public.live_comments set is_resolved = (p_action = 'resolve') where id = p_comment_id;
  elsif p_action = 'delete' then
    update public.live_comments
       set deleted_at = now(), deleted_by = auth.uid(), is_pinned = false
     where id = p_comment_id;
  else
    raise exception 'অজানা কাজ: %', p_action;
  end if;
end $$;

-- ================= পরীক্ষার রিপোর্ট ও লিডারবোর্ড =================
-- শতাংশের নিয়ম: মোট প্রাপ্ত নম্বর ÷ শেষ হওয়া সব পরীক্ষার মোট নম্বর × ১০০।
-- অনুপস্থিত পরীক্ষায় প্রাপ্ত নম্বর ০ ধরা হয়। পরীক্ষা শেষ হওয়ার আগে কারো ফল,
-- সমাধান বা সঠিক উত্তর দেখা যায় না। শিক্ষার্থী RLS এ শুধু নিজের attempt দেখে,
-- তাই লিডারবোর্ড এই function গুলো দিয়ে আসে (ফোন নম্বরের মতো তথ্য ছাড়া)

-- কোর্সের ফল কে দেখতে পারে: ভর্তি শিক্ষার্থী, কোর্সের শিক্ষক, admin ও manager
create function public.can_see_course_results(p_course_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_enrolled(p_course_id) or public.teaches(p_course_id) or public.is_staff()
$$;

-- পরীক্ষা শেষ হয়েছে কিনা (প্রকাশিত আর closes_at পার হয়েছে)। এর পর সমাধান দেখা যায়
create function public.exam_closed(p_exam_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.exams where id = p_exam_id and is_published and closes_at < now())
$$;

-- পুরো ফল (মোট নম্বর আর মেধাতালিকা) তৈরি কিনা: MCQ পরীক্ষা শেষ হলেই;
-- লিখিত বা মিশ্র পরীক্ষায় খাতা কাটা শেষে ফল প্রকাশ হলে
create function public.exam_results_ready(p_exam_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.exams e
                  where e.id = p_exam_id and e.is_published and e.closes_at < now()
                    and (e.kind = 'mcq' or e.results_published_at is not null))
$$;

-- কোর্সের লিডারবোর্ড: ফল তৈরি এমন সব পরীক্ষা মিলিয়ে শতাংশ অনুযায়ী অবস্থান (সমান হলে একই অবস্থান)
create function public.course_leaderboard(p_course_id bigint)
returns table (rank_no bigint, user_id uuid, user_code text, student text, institute text,
               exams_taken bigint, exams_held bigint, obtained numeric, total_marks numeric, percent numeric)
language sql stable security definer set search_path = '' as $$
  with held as (
    select e.id, public.exam_total_marks(e.id) as total
      from public.exams e
     where e.course_id = p_course_id and public.exam_results_ready(e.id)
  ), totals as (
    select count(*) as n, coalesce(sum(total), 0) as total from held
  ), scores as (
    select en.user_id, count(a.id) as taken, coalesce(sum(a.score), 0) as obtained
      from public.enrollments en
      left join public.exam_attempts a
             on a.user_id = en.user_id and a.status <> 'in_progress'
            and a.exam_id in (select id from held)
     where en.course_id = p_course_id and en.status = 'active'
     group by en.user_id
  )
  select rank() over (order by round(100 * s.obtained / nullif(t.total, 0), 2) desc nulls last),
         p.id, p.user_code, p.full_name, p.institute,
         s.taken, t.n, s.obtained, t.total,
         round(100 * s.obtained / nullif(t.total, 0), 2)
    from scores s
    join public.profiles p on p.id = s.user_id
    cross join totals t
   where public.can_see_course_results(p_course_id)
   order by 1, p.full_name
$$;

-- একটা পরীক্ষার মেধাক্রম: exam_ranks এ হিসাব করা থাকলে সেখান থেকে (দ্রুত), না থাকলে এখনই হিসাব।
-- নিয়ম: বেশি নম্বর আগে; সমান নম্বরে কম সময়ে জমা দেওয়া আগে; সময়ও সমান হলে একই অবস্থান।
-- সময় = শুরু থেকে জমা (সময় পেরিয়ে নিজে জমা হলে deadline পর্যন্ত)
create function public.exam_rank_list(p_exam_id bigint)
returns table (attempt_id bigint, user_id uuid, score numeric, seconds_taken int, rank_no int)
language sql stable security definer set search_path = '' as $$
  select r.attempt_id, r.user_id, r.score, r.seconds_taken, r.rank_no
    from public.exam_ranks r
   where r.exam_id = p_exam_id
     and (select e.ranks_computed_at from public.exams e where e.id = p_exam_id) is not null
  union all
  select x.id, x.user_id, x.score, x.secs, (rank() over (order by x.score desc nulls last, x.secs))::int
    from (select a.id, a.user_id, a.score,
                 greatest(0, extract(epoch from least(a.submitted_at, a.deadline_at) - a.started_at))::int as secs
            from public.exam_attempts a
           where a.exam_id = p_exam_id and a.status <> 'in_progress') x
   where (select e.ranks_computed_at from public.exams e where e.id = p_exam_id) is null
$$;
revoke execute on function public.exam_rank_list(bigint) from public, anon, authenticated;

-- মেধাক্রম হিসাব করে রাখা (ভেতরের কাজ): MCQ পরীক্ষা শেষ হলে cron, লিখিত/মিশ্রে ফল প্রকাশ,
-- আর উত্তর বা নম্বর সংশোধনের পর
create function public.refresh_exam_ranks(p_exam_id bigint) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  delete from public.exam_ranks where exam_id = p_exam_id;
  insert into public.exam_ranks (exam_id, attempt_id, user_id, score, seconds_taken, rank_no)
  select p_exam_id, x.id, x.user_id, x.score, x.secs, rank() over (order by x.score desc nulls last, x.secs)
    from (select a.id, a.user_id, a.score,
                 greatest(0, extract(epoch from least(a.submitted_at, a.deadline_at) - a.started_at))::int as secs
            from public.exam_attempts a
           where a.exam_id = p_exam_id and a.status <> 'in_progress') x;
  get diagnostics n = row_count;
  update public.exams set ranks_computed_at = now() where id = p_exam_id;
  return n;
end $$;
revoke execute on function public.refresh_exam_ranks(bigint) from public, anon, authenticated;

-- যেসব পরীক্ষার ফল তৈরি কিন্তু মেধাক্রম এখনো হিসাব হয়নি, সেগুলো হিসাব করা। প্রতি মিনিটে pg_cron:
--   select cron.schedule('refresh-exam-ranks', '* * * * *', 'select public.refresh_due_ranks()');
create function public.refresh_due_ranks() returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in select e.id from public.exams e
            where e.ranks_computed_at is null and public.exam_results_ready(e.id)
              and e.closes_at < now() - interval '2 minutes'
              and not exists (select 1 from public.exam_attempts a
                               where a.exam_id = e.id and a.status = 'in_progress') loop
    perform public.refresh_exam_ranks(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.refresh_due_ranks() from public, anon, authenticated;

-- একটা পরীক্ষার লিডারবোর্ড (যারা পরীক্ষা দিয়েছে), ফল তৈরি হওয়ার পর
create function public.exam_leaderboard(p_exam_id bigint)
returns table (rank_no bigint, user_id uuid, user_code text, student text, institute text,
               obtained numeric, total_marks numeric, percent numeric, submitted_at timestamptz,
               seconds_taken int)
language sql stable security definer set search_path = '' as $$
  select r.rank_no::bigint,
         p.id, p.user_code, p.full_name, p.institute,
         r.score, t.total, round(100 * r.score / nullif(t.total, 0), 2), a.submitted_at, r.seconds_taken
    from public.exam_rank_list(p_exam_id) r
    join public.exam_attempts a on a.id = r.attempt_id
    join public.exams e    on e.id = a.exam_id
    join public.profiles p on p.id = r.user_id
    cross join (select public.exam_total_marks(p_exam_id) as total) t
   where public.exam_results_ready(p_exam_id) and public.can_see_course_results(e.course_id)
   order by 1, p.full_name
$$;

-- শিক্ষার্থীর নিজের রিপোর্ট: কোর্সের প্রতিটি প্রকাশিত পরীক্ষা, অনুপস্থিত থাকলেও তালিকায় থাকে।
--   mcq_obtained: MCQ অংশের নম্বর, জমার সাথে সাথে
--   obtained/percent: মোট। MCQ পরীক্ষায় জমার সাথে; লিখিত/মিশ্রে ফল প্রকাশের পর
--   rank_no/attendees: ফল তৈরি হলে (MCQ: সময় শেষে, যাতে পরে যারা দেয় তাদের সাথে মিলিয়ে হয়)
--   status 'checking': জমা দিয়েছে, খাতা কাটা চলছে
create function public.my_exam_report(p_course_id bigint)
returns table (exam_id bigint, exam text, kind public.exam_kind, opens_at timestamptz, closes_at timestamptz,
               total_marks numeric, mcq_obtained numeric, obtained numeric, percent numeric, rank_no bigint,
               attendees bigint, status text, attempt_id bigint, solution_pdf_path text, results_ready boolean)
language sql stable security definer set search_path = '' as $$
  select e.id, e.title, e.kind, e.opens_at, e.closes_at, t.total,
         a.mcq_score,
         case when e.kind = 'mcq' or t.ready then a.score end,
         case when e.kind = 'mcq' or t.ready then round(100 * a.score / nullif(t.total, 0), 2) end,
         case when t.ready and a.id is not null then rk.rank_no::bigint end,
         case when t.ready then r.attendees end,
         case when a.id is not null and e.kind <> 'mcq' and not t.ready then 'checking'
              when a.id is not null then 'attended'
              when e.opens_at > now() then 'upcoming'
              when not t.closed then 'running'
              else 'absent' end,
         a.id,
         case when t.closed then e.solution_pdf_path end,
         t.ready
    from public.exams e
    left join public.exam_attempts a
           on a.exam_id = e.id and a.user_id = auth.uid() and a.status <> 'in_progress'
    cross join lateral (select public.exam_total_marks(e.id) as total, public.exam_closed(e.id) as closed,
                               public.exam_results_ready(e.id) as ready) t
    cross join lateral (
      select count(*) as attendees from public.exam_attempts x
       where x.exam_id = e.id and x.status <> 'in_progress'
    ) r
    left join lateral (
      select l.rank_no from public.exam_rank_list(e.id) l where l.attempt_id = a.id
    ) rk on t.ready
   where e.course_id = p_course_id and e.is_published and public.is_enrolled(p_course_id)
   order by coalesce(e.opens_at, e.created_at) desc
$$;

-- সমাধান: পরীক্ষার সময় শেষ হলে সব প্রশ্ন, MCQ এর সঠিক উত্তর আর ব্যাখ্যা, লিখিত প্রশ্নের
-- সমাধান আর নম্বর বিভাজন (সমাধানের PDF এর জন্য)। তার আগে কেউ পায় না।
-- cancelled: বাতিল প্রশ্ন (drop/award); সংশোধনের কারণ exam_corrections এ
create function public.exam_solution(p_exam_id bigint)
returns table (question_no int, body text, options jsonb, correct_option smallint, explanation text,
               marks numeric, kind text, section text, scheme text, question_id bigint, cancelled text,
               chapter text, image_path text, option_images jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.exams e where e.id = p_exam_id and public.can_see_course_results(e.course_id)) then
    raise exception 'এই পরীক্ষার সমাধান দেখার অনুমতি নেই';
  end if;
  if not public.exam_closed(p_exam_id) then
    raise exception 'পরীক্ষা শেষ হওয়ার পর সমাধান পাওয়া যাবে';
  end if;
  return query
    select (row_number() over (order by q.position, q.id))::int, q.body, q.options,
           q.correct_option, q.explanation, q.marks, q.kind, q.section, q.scheme, q.id, q.cancelled, c.title,
           q.image_path, q.option_images
      from public.exam_questions q
      left join public.chapters c on c.id = q.chapter_id
     where q.exam_id = p_exam_id
     order by q.position, q.id;
end $$;

-- উত্তরপত্র: শিক্ষার্থী কোন প্রশ্নে কী দিয়েছে আর সঠিক উত্তর কী (উত্তরপত্রের PDF এর জন্য)।
-- নিজেরটা, অথবা কোর্সের শিক্ষক বা staff; পরীক্ষা শেষ হওয়ার পর
create function public.my_answer_script(p_attempt_id bigint)
returns table (question_no int, body text, options jsonb, selected_option smallint,
               correct_option smallint, is_correct boolean, explanation text, marks numeric, cancelled text,
               image_path text, option_images jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.exam_attempts;
begin
  select * into v from public.exam_attempts x where x.id = p_attempt_id;
  if v.id is null or not (v.user_id = auth.uid() or public.is_staff()
       or exists (select 1 from public.exams e where e.id = v.exam_id and public.teaches(e.course_id))) then
    raise exception 'এই উত্তরপত্র দেখার অনুমতি নেই';
  end if;
  if not public.exam_closed(v.exam_id) then
    raise exception 'পরীক্ষা শেষ হওয়ার পর উত্তরপত্র পাওয়া যাবে';
  end if;
  return query
    select (row_number() over (order by q.position, q.id))::int, q.body, q.options,
           aa.selected_option, q.correct_option, aa.is_correct, q.explanation, q.marks, q.cancelled,
           q.image_path, q.option_images
      from public.exam_questions q
      left join public.attempt_answers aa on aa.question_id = q.id and aa.attempt_id = p_attempt_id
     where q.exam_id = v.exam_id and q.kind = 'mcq'
     order by q.position, q.id;
end $$;

-- ================= পরীক্ষা দেওয়া =================
-- পরীক্ষা শুরু: সময়সীমা server এ ঠিক হয় (পরীক্ষার সময় আর closes_at এর মধ্যে যেটা আগে)।
-- ফোনের টাইমার এই deadline আর server_now থেকে চলে, তাই নেট বন্ধ করলে বা ফোনের ঘড়ি বদলালেও সময় থামে না।
-- প্রথমবার: MCQ প্রশ্ন আর অপশনের ক্রম এই শিক্ষার্থীর জন্য এলোমেলো হয়ে রাখা হয় (exams.shuffle)।
-- p_nonce: যে পাতা থেকে খোলা হচ্ছে তার চিহ্ন (প্রতিবার পাতা লোডে নতুন, ফোনের memory তে, storage এ নয়)।
-- একবার শুরু হলে বাতিল বা আবার খোলা নেই: অন্য চিহ্ন নিয়ে আবার এলে (রিলোড, নতুন ট্যাব, অন্য ফোন বা
-- ব্রাউজার) পরীক্ষা শেষ সেভ পর্যন্ত উত্তর দিয়ে জমা হয়ে যায় (end_reason = 'reopened'), status দেখে ফোন ফল
-- দেখায়। একই চিহ্ন নিয়ে আবার এলে (start এর উত্তর নেটে হারিয়েছিল) একই attempt আর token ফেরত যায়।
-- প্রশ্ন যায় সঠিক উত্তর, ব্যাখ্যা আর নম্বর বিভাজন ছাড়া; বাতিল প্রশ্ন বাদ দিয়ে।
-- selected: দেখানো ক্রমে কোন অপশন বাছাই করা আছে
create function public.start_exam(p_exam_id bigint, p_nonce text default null)
returns table (attempt_id bigint, deadline_at timestamptz, questions jsonb, picked bigint[],
               session_token uuid, server_now timestamptz, last_seq bigint, status public.attempt_status,
               end_reason public.attempt_end_reason, submit_on_hide boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  e public.exams;
  a public.exam_attempts;
begin
  select * into e from public.exams x where x.id = p_exam_id;
  if e.id is null or not e.is_published or not public.is_enrolled(e.course_id) then
    raise exception 'এই পরীক্ষা দেওয়ার অনুমতি নেই' using errcode = '42501';
  end if;
  if e.opens_at is not null and e.opens_at > now() then
    raise exception 'পরীক্ষা এখনো শুরু হয়নি';
  end if;

  select * into a from public.exam_attempts x where x.exam_id = p_exam_id and x.user_id = auth.uid() for update;
  if a.id is null then
    if e.closes_at is not null and e.closes_at <= now() then
      raise exception 'পরীক্ষার সময় শেষ';
    end if;
    insert into public.exam_attempts (exam_id, user_id, deadline_at, q_order, opt_order, session_token, open_nonce)
    values (p_exam_id, auth.uid(),
            least(now() + make_interval(mins => e.duration_minutes), coalesce(e.closes_at, 'infinity'::timestamptz)),
            (select array_agg(q.id order by case when e.shuffle then random() end, q.position, q.id)
               from public.exam_questions q where q.exam_id = p_exam_id and q.kind = 'mcq'),
            (select jsonb_object_agg(q.id::text,
                      (select jsonb_agg(i order by case when e.shuffle and not q.lock_options then random() end, i)
                         from generate_series(0, jsonb_array_length(q.options) - 1) i))
               from public.exam_questions q where q.exam_id = p_exam_id and q.kind = 'mcq'),
            gen_random_uuid(), left(p_nonce, 100))
    returning * into a;
  elsif a.status <> 'in_progress' then
    raise exception 'এই পরীক্ষা আগেই জমা দেওয়া হয়েছে';
  elsif p_nonce is null or a.open_nonce is distinct from left(p_nonce, 100)
        or now() > a.deadline_at + interval '30 seconds' then
    -- আবার খোলা মানে পরীক্ষার পাতা ছেড়ে যাওয়া: যা সেভ ছিল তা দিয়ে জমা
    perform public.grade_attempt(a.id, case when now() > a.deadline_at + interval '30 seconds'
                                            then 'expired' else 'submitted' end::public.attempt_status,
                                 case when now() > a.deadline_at + interval '30 seconds'
                                      then 'expired' else 'reopened' end::public.attempt_end_reason);
    select * into a from public.exam_attempts x where x.id = a.id;
    return query select a.id, a.deadline_at, '[]'::jsonb, a.picked, null::uuid, now(), a.last_seq,
                        a.status, a.end_reason, e.submit_on_hide and e.kind = 'mcq';
    return;
  end if;

  return query
    select a.id, a.deadline_at,
           coalesce((
             select jsonb_agg(item order by grp, ord)
               from (
                 -- MCQ: এই শিক্ষার্থীর ক্রমে, অপশনও তার ক্রমে
                 select 1 as grp, o.ord, jsonb_build_object(
                          'id', q.id, 'kind', q.kind, 'section', q.section, 'body', q.body, 'marks', q.marks,
                          'image', q.image_path,
                          'options', (select jsonb_agg(q.options -> (p.v)::int order by p.i)
                                        from jsonb_array_elements_text(a.opt_order -> q.id::text) with ordinality p(v, i)),
                          'option_images', case when q.option_images is not null then
                                             (select jsonb_agg(q.option_images -> (p.v)::int order by p.i)
                                                from jsonb_array_elements_text(a.opt_order -> q.id::text) with ordinality p(v, i)) end,
                          'selected', (select (p.i - 1)::int
                                         from jsonb_array_elements_text(a.opt_order -> q.id::text) with ordinality p(v, i)
                                        where (p.v)::int = aa.selected_option)) as item
                   from unnest(a.q_order) with ordinality o(qid, ord)
                   join public.exam_questions q on q.id = o.qid and q.cancelled is null
                   left join public.attempt_answers aa on aa.attempt_id = a.id and aa.question_id = q.id
                 union all
                 -- লিখিত: শিক্ষকের দেওয়া ক্রমে
                 select 2, row_number() over (order by q.position, q.id), jsonb_build_object(
                          'id', q.id, 'kind', q.kind, 'section', q.section, 'body', q.body, 'marks', q.marks,
                          'image', q.image_path)
                   from public.exam_questions q
                  where q.exam_id = a.exam_id and q.kind = 'written'
               ) z), '[]'::jsonb),
           a.picked, a.session_token, now(), a.last_seq, a.status, a.end_reason,
           e.submit_on_hide and e.kind = 'mcq';
end $$;

-- উত্তর সেভ, সব একসাথে: ফোন কয়েক সেকেন্ড পরপর আর নেট ফিরলে পুরো উত্তরের তালিকা পাঠায়,
-- {"<question_id>": দেখানো ক্রমে অপশনের index বা null}। তালিকায় না থাকা প্রশ্নের উত্তর মুছে যায়।
-- p_seq প্রতিবার বাড়ে; দেরিতে পৌঁছানো পুরনো সেভ (ছোট seq) বাদ পড়ে, তাই অফলাইন থেকে ফেরার পর
-- উল্টাপাল্টা হয় না, আর একই সেভ দুবার এলেও ক্ষতি নেই।
-- সময়: deadline এর পর ৩০ সেকেন্ড পর্যন্ত (নেটের দেরির জন্য), তারপর আর নয়। নেট বন্ধ রাখলেও সময়
-- থামে না; নেট ফেরার আগে সময় শেষ হলে শেষ যে সেভ পৌঁছেছিল সেটাই গণ্য।
-- p_events: [{"k": "tab_hidden", "s": 12}, ...] ট্যাব বদল, নেট যাওয়া-আসা (শুধু রেকর্ড, শাস্তি নয়)
create function public.save_answers(p_attempt_id bigint, p_token uuid, p_seq bigint, p_answers jsonb,
                                    p_events jsonb default '[]')
returns table (saved_seq bigint, server_now timestamptz, deadline_at timestamptz)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  a public.exam_attempts;
  r record;
  v_num numeric;
  v_opt int;
begin
  select * into a from public.exam_attempts x where x.id = p_attempt_id and x.user_id = auth.uid() for update;
  if a.id is null then
    raise exception 'পরীক্ষা পাওয়া যায়নি' using errcode = '42501';
  end if;
  if a.status <> 'in_progress' then
    raise exception 'পরীক্ষা জমা হয়ে গেছে, উত্তর আর বদলানো যাবে না';
  end if;
  if a.session_token is distinct from p_token then
    raise exception 'এই পরীক্ষা অন্য ডিভাইস বা ট্যাবে খোলা হয়েছে' using errcode = '42501';
  end if;
  if now() > a.deadline_at + interval '30 seconds' then
    raise exception 'সময় শেষ, উত্তর আর বদলানো যাবে না';
  end if;

  -- ঘটনা রেকর্ড (প্রতিবার সর্বোচ্চ ৫০টা, এক পরীক্ষায় সর্বোচ্চ ১০০০টা)
  if jsonb_typeof(p_events) = 'array' and jsonb_array_length(p_events) > 0
     and (select count(*) from public.attempt_events ev where ev.attempt_id = a.id) < 1000 then
    insert into public.attempt_events (attempt_id, kind, seconds)
    select a.id, (ev ->> 'k')::public.exam_event_kind,
           case when jsonb_typeof(ev -> 's') = 'number' then least(greatest((ev ->> 's')::numeric, 0), 86400)::int end
      from jsonb_array_elements(p_events) with ordinality t(ev, n)
     where t.n <= 50 and ev ->> 'k' in ('tab_hidden', 'fullscreen_exit', 'copy_paste', 'offline', 'online');
  end if;

  if p_seq is null or p_seq <= a.last_seq then
    return query select a.last_seq, now(), a.deadline_at;   -- পুরনো বা একই সেভ: কিছু বদলায় না
    return;
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'উত্তরের তালিকা ঠিক নেই';
  end if;

  delete from public.attempt_answers aa
   where aa.attempt_id = a.id
     and not exists (select 1 from jsonb_each(p_answers) j
                      where j.key = aa.question_id::text and jsonb_typeof(j.value) = 'number');
  for r in select j.key, j.value from jsonb_each(p_answers) j where jsonb_typeof(j.value) = 'number' loop
    if not coalesce(case when r.key ~ '^\d{1,18}$' then r.key::bigint = any (a.q_order) end, false) then
      raise exception 'প্রশ্ন পাওয়া যায়নি';
    end if;
    -- পরীক্ষার মাঝে বাতিল হওয়া প্রশ্ন: আগে খোলা ফোন এখনো পাঠাতে পারে, তাই চুপচাপ বাদ
    continue when exists (select 1 from public.exam_questions q where q.id = r.key::bigint and q.cancelled is not null);
    v_num := (r.value #>> '{}')::numeric;
    if v_num < 0 or v_num > 20 or v_num <> trunc(v_num) then
      raise exception 'ভুল অপশন';
    end if;
    v_opt := (a.opt_order -> r.key ->> v_num::int)::int;   -- দেখানো index → আসল index
    if v_opt is null then
      raise exception 'ভুল অপশন';
    end if;
    insert into public.attempt_answers as aa (attempt_id, question_id, selected_option)
    values (a.id, r.key::bigint, v_opt)
    on conflict (attempt_id, question_id) do update
      set selected_option = excluded.selected_option, answered_at = now()
      where aa.selected_option is distinct from excluded.selected_option;
  end loop;

  update public.exam_attempts x set last_seq = p_seq where x.id = a.id;
  return query select p_seq, now(), a.deadline_at;
end $$;

-- MCQ অংশের নম্বর: সঠিকে পূর্ণ নম্বর, ভুলে negative_mark কাটা, বাদ দিলে ০।
-- বাতিল প্রশ্ন: drop হলে হিসাবেই নেই, award হলে সবাই (উত্তর না দিলেও) পূর্ণ নম্বর পায়
create function public.mcq_result(p_attempt_id bigint)
returns table (score numeric, correct int, wrong int, skipped int)
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(case when q.cancelled = 'award' then q.marks
                           when aa.selected_option = q.correct_option then q.marks
                           when aa.selected_option is not null then -e.negative_mark
                           else 0 end), 0),
         (count(*) filter (where q.cancelled = 'award' or aa.selected_option = q.correct_option))::int,
         (count(*) filter (where q.cancelled is null and aa.selected_option <> q.correct_option))::int,
         (count(*) filter (where q.cancelled is null and aa.selected_option is null))::int
    from public.exam_attempts a
    join public.exams e on e.id = a.exam_id
    join public.exam_questions q on q.exam_id = a.exam_id and q.kind = 'mcq' and q.cancelled is distinct from 'drop'
    left join public.attempt_answers aa on aa.attempt_id = a.id and aa.question_id = q.id
   where a.id = p_attempt_id
$$;
revoke execute on function public.mcq_result(bigint) from public, anon, authenticated;

-- MCQ অংশের নম্বর হিসাব আর জমা (ভেতরের কাজ; submit_exam, start_exam, claim_session আর expire_attempts
-- ব্যবহার করে)। p_reason না দিলে: সময় পেরোলে 'expired', নইলে 'submit'
create function public.grade_attempt(p_attempt_id bigint, p_status public.attempt_status,
                                     p_reason public.attempt_end_reason default null)
returns table (mcq_score numeric, mcq_total numeric, correct int, wrong int, skipped int)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  a public.exam_attempts;
  e public.exams;
  r record;
begin
  select * into a from public.exam_attempts x where x.id = p_attempt_id for update;
  select * into e from public.exams x where x.id = a.exam_id;

  update public.attempt_answers aa
     set is_correct = (aa.selected_option = q.correct_option)
    from public.exam_questions q
   where q.id = aa.question_id and aa.attempt_id = a.id;
  select * into r from public.mcq_result(a.id);

  update public.exam_attempts
     set status        = p_status,
         submitted_at  = now(),
         session_token = null,
         end_reason    = coalesce(p_reason, case when p_status = 'expired' then 'expired' else 'submit' end::public.attempt_end_reason),
         mcq_score     = case when e.kind = 'written' then null else r.score end,
         score         = case when e.kind = 'mcq' then r.score else null end,
         upload_until  = case when e.kind = 'mcq' then null
                              else now() + make_interval(mins => e.upload_grace_minutes) end
   where id = a.id;

  return query select case when e.kind = 'written' then null else r.score end,
                      public.exam_mcq_total(e.id), r.correct, r.wrong, r.skipped;
end $$;
revoke execute on function public.grade_attempt(bigint, public.attempt_status, public.attempt_end_reason) from public, anon, authenticated;

-- পরীক্ষার সব জমা দেওয়া attempt এর নম্বর আবার হিসাব (উত্তর-চাবি বদল বা প্রশ্ন বাতিলের পর)।
-- লিখিত/মিশ্রে ফল প্রকাশ হয়ে থাকলে মোট নম্বরও। কয়টা attempt এর নম্বর বদলাল তা ফেরত দেয়
create function public.regrade_exam(p_exam_id bigint) returns int
language plpgsql security definer set search_path = '' as $$
declare
  e public.exams;
  n int;
begin
  select * into e from public.exams where id = p_exam_id;
  update public.attempt_answers aa
     set is_correct = (aa.selected_option = q.correct_option)
    from public.exam_questions q, public.exam_attempts a
   where q.id = aa.question_id and a.id = aa.attempt_id and a.exam_id = p_exam_id and a.status <> 'in_progress';
  update public.exam_attempts a
     set mcq_score = case when e.kind = 'written' then null else s.score end,
         score     = case when e.kind = 'mcq' then s.score
                          when e.results_published_at is not null then coalesce(s.score, 0) + coalesce(a.written_score, 0)
                          else a.score end
    from (select x.id, r.score from public.exam_attempts x cross join lateral public.mcq_result(x.id) r
           where x.exam_id = p_exam_id and x.status <> 'in_progress') s
   where a.id = s.id
     and (a.mcq_score is distinct from case when e.kind = 'written' then null else s.score end);
  get diagnostics n = row_count;
  if e.ranks_computed_at is not null then
    perform public.refresh_exam_ranks(p_exam_id);
  end if;
  return n;
end $$;
revoke execute on function public.regrade_exam(bigint) from public, anon, authenticated;

-- জমা দেওয়া। MCQ এর নম্বর আর সঠিক/ভুল/বাদ কয়টা তা সাথে সাথে ফেরত দেয়, কিন্তু কোন প্রশ্ন
-- ভুল বা সঠিক উত্তর কী তা নয় (সেটা সময় শেষে exam_solution / my_answer_script)।
-- p_answers দিলে আগে শেষবারের মতো সেভ হয় (save_answers এর নিয়মে)।
-- লিখিত থাকলে p_picked এ যে প্রশ্নগুলোর উত্তর দিয়েছে (pick_rules মেনে)। জমার পর
-- upload_grace_minutes পর্যন্ত খাতার ছবি দেওয়া যায়।
-- p_reason: ফোন কেন জমা দিচ্ছে। 'submit' নিজে, 'time_up' টাইমার শেষ, 'left' পাতা ছেড়ে যাওয়া (রিলোড, অন্য
-- পাতা, বন্ধ; pagehide এ keepalive fetch, না পৌঁছালে পরের বার সাইট খুললে), 'back' back চেপে বের হওয়া
-- (ফোন আগে জিজ্ঞেস করে, শিক্ষার্থী "জমা দিয়ে বের হই" চাপলে),
-- 'tab_hidden' MCQ পরীক্ষায় অন্য ট্যাব/অ্যাপে যাওয়া
create function public.submit_exam(p_attempt_id bigint, p_token uuid, p_picked bigint[] default null,
                                   p_seq bigint default null, p_answers jsonb default null,
                                   p_reason public.attempt_end_reason default 'submit')
returns table (mcq_score numeric, mcq_total numeric, correct int, wrong int, skipped int, written_pending boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  a public.exam_attempts;
  e public.exams;
  r record;
begin
  select * into a from public.exam_attempts x where x.id = p_attempt_id and x.user_id = auth.uid();
  if a.id is null then
    raise exception 'পরীক্ষা পাওয়া যায়নি' using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in ('submit', 'time_up', 'left', 'back', 'tab_hidden') then
    raise exception 'জমার কারণ ঠিক নেই';
  end if;
  if a.status <> 'in_progress' then
    raise exception 'এই পরীক্ষা আগেই জমা দেওয়া হয়েছে';
  end if;
  if a.session_token is distinct from p_token then
    raise exception 'এই পরীক্ষা অন্য ডিভাইস বা ট্যাবে খোলা হয়েছে' using errcode = '42501';
  end if;
  if p_answers is not null and now() <= a.deadline_at + interval '30 seconds' then
    perform public.save_answers(p_attempt_id, p_token, p_seq, p_answers);
  end if;
  select * into a from public.exam_attempts x where x.id = p_attempt_id for update;
  select * into e from public.exams x where x.id = a.exam_id;

  if p_picked is not null then
    if exists (select 1 from unnest(p_picked) pid
                where not exists (select 1 from public.exam_questions q
                                   where q.id = pid and q.exam_id = e.id and q.kind = 'written')) then
      raise exception 'বাছাই করা প্রশ্ন এই পরীক্ষার লিখিত প্রশ্ন নয়';
    end if;
    for r in select q.section, count(*) as n from public.exam_questions q
              where q.id = any (p_picked) group by q.section loop
      if (e.pick_rules ->> r.section) is not null and r.n > (e.pick_rules ->> r.section)::int then
        raise exception '"%" থেকে সর্বোচ্চ %টি প্রশ্নের উত্তর দেওয়া যায়', r.section, e.pick_rules ->> r.section;
      end if;
    end loop;
    update public.exam_attempts set picked = p_picked where id = a.id;
  end if;

  return query
    select g.mcq_score, g.mcq_total, g.correct, g.wrong, g.skipped, e.kind <> 'mcq'
      from public.grade_attempt(a.id, case when now() > a.deadline_at + interval '30 seconds'
                                           then 'expired' else 'submitted' end::public.attempt_status, p_reason) g;
end $$;

-- খাতার পাতা দেওয়া যাবে কিনা: নিজের attempt, লিখিত প্রশ্ন, পরীক্ষা চলার সময় বা জমার পর
-- upload_until পর্যন্ত, আর pick করা প্রশ্ন। (শিক্ষার্থী exam_questions পড়তে পারে না, তাই function)
create function public.can_upload_script_page(p_attempt_id bigint, p_question_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.exam_attempts a
      join public.exam_questions q on q.exam_id = a.exam_id
     where a.id = p_attempt_id and q.id = p_question_id and q.kind = 'written'
       and a.user_id = auth.uid()
       and now() <= coalesce(a.upload_until, a.deadline_at)
       and (a.picked is null or p_question_id = any (a.picked)))
$$;

-- সময় পেরিয়ে যাওয়া কিন্তু জমা না দেওয়া পরীক্ষা নিজে থেকে জমা (যা উত্তর সেভ ছিল তা দিয়ে নম্বর)।
-- প্রতি মিনিটে pg_cron চালায়:
--   select cron.schedule('expire-exam-attempts', '* * * * *', 'select public.expire_attempts()');
create function public.expire_attempts() returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in select id from public.exam_attempts
            where status = 'in_progress' and deadline_at < now() - interval '1 minute'
            for update skip locked loop
    perform public.grade_attempt(r.id, 'expired', 'expired');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.expire_attempts() from public, anon, authenticated;

-- ================= একসাথে একটাই ডিভাইসে লগইন =================
-- লগইনের পর ফোন/ব্রাউজার claim_session() ডাকে; এই অ্যাকাউন্টের এখনকার লগইন (JWT এর session_id) সেটাই হয়।
-- নতুন লগইন জেতে: আগের ডিভাইসের প্রতিটি request সাথে সাথে আটকে যায় (check_request আর নিচের
-- restrictive policy), তার refresh token বাতিল হয়, আর সেখানে চলা পরীক্ষা শেষ সেভ পর্যন্ত জমা হয়ে যায়।
-- ফোন session_status() দিয়ে জানে যে অন্য ডিভাইসে লগইন হয়েছে আর লগআউট দেখায়
create table active_sessions (
  user_id    uuid primary key references profiles(id) on delete cascade,
  session_id uuid not null,            -- Supabase JWT এর session_id
  device     text,                     -- যেমন "Android · Chrome" (ফোন থেকে আসা, শুধু দেখানোর জন্য)
  since      timestamptz not null default now()
);
-- ডিভাইস বদলের ইতিহাস: শিক্ষার্থী নিজেরটা দেখে, staff দেখেন (ঘন ঘন বদল = একাউন্ট শেয়ারের সন্দেহ)
create table device_logins (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  device      text,
  at          timestamptz not null default now(),
  replaced    boolean not null default false,   -- আগে অন্য ডিভাইসে লগইন ছিল, সেটা বাদ গেছে
  submitted   int not null default 0            -- সেই ডিভাইসে চলা কয়টা পরীক্ষা জমা হলো
);
create index device_logins_user on device_logins (user_id, at desc);

-- এই request কি এখনকার লগইন থেকে?
create function public.session_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.active_sessions s
                  where s.user_id = auth.uid()
                    and s.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid)
$$;

create function public.claim_session(p_device text default null)
returns table (replaced boolean, submitted int)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_sid uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  v_old public.active_sessions;
  r record;
  n int := 0;
begin
  if auth.uid() is null or v_sid is null then
    raise exception 'লগইন করা নেই' using errcode = '42501';
  end if;
  select * into v_old from public.active_sessions s where s.user_id = auth.uid() for update;
  if v_old.session_id = v_sid then
    update public.active_sessions s set device = coalesce(left(btrim(p_device), 120), s.device) where s.user_id = auth.uid();
    return query select false, 0;
    return;
  end if;
  insert into public.active_sessions as s (user_id, session_id, device)
  values (auth.uid(), v_sid, left(btrim(p_device), 120))
  on conflict (user_id) do update set session_id = excluded.session_id, device = excluded.device, since = now();

  -- আগের ডিভাইসে চলা পরীক্ষা: সেখানে আর সেভ হবে না, তাই যা সেভ ছিল তা দিয়ে জমা
  for r in select x.id, x.deadline_at from public.exam_attempts x
            where x.user_id = auth.uid() and x.status = 'in_progress' for update loop
    perform public.grade_attempt(r.id, case when now() > r.deadline_at + interval '30 seconds'
                                            then 'expired' else 'submitted' end::public.attempt_status,
                                 case when now() > r.deadline_at + interval '30 seconds'
                                      then 'expired' else 'other_device' end::public.attempt_end_reason);
    n := n + 1;
  end loop;
  insert into public.device_logins (user_id, device, replaced, submitted)
  values (auth.uid(), left(btrim(p_device), 120), v_old.user_id is not null, n);

  -- আগের ডিভাইসের refresh token বাতিল (Supabase Auth এর টেবিল; না থাকলে বা অনুমতি না থাকলে বাদ,
  -- তখনও session_ok() তাকে আটকায়)
  if to_regclass('auth.sessions') is not null then
    begin
      execute 'delete from auth.sessions where user_id = $1 and id <> $2' using auth.uid(), v_sid;
    exception when others then null;
    end;
  end if;
  return query select v_old.user_id is not null, n;
end $$;

-- লগআউট হয়ে গেছে কিনা (আটকে যাওয়া ডিভাইসও ডাকতে পারে): active = এই লগইনই এখনকার
create function public.session_status()
returns table (active boolean, device text, since timestamptz)
language sql stable security definer set search_path = '' as $$
  select coalesce(s.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid, false), s.device, s.since
    from (select 1) one
    left join public.active_sessions s on s.user_id = auth.uid()
$$;

-- PostgREST এর প্রতিটি request এর আগে (pre-request): লগইন করা কিন্তু এখনকার লগইন নয় → 401।
-- claim_session আর session_status ছাড়া। নিচের DO block চালু করে; Storage আর Realtime এর জন্য
-- restrictive policy (ফাইলের শেষে)
create function public.check_request() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is not null
     and coalesce(current_setting('request.path', true), '') not in ('/rpc/claim_session', '/rpc/session_status')
     and not public.session_ok() then
    raise sqlstate 'PT401' using message = 'SESSION_REPLACED',
      detail = 'এই অ্যাকাউন্টে অন্য ডিভাইসে লগইন হয়েছে, এখানে আবার লগইন করুন';
  end if;
end $$;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    execute 'alter role authenticator set pgrst.db_pre_request = ''public.check_request''';
    notify pgrst, 'reload config';
  end if;
end $$;

-- ================= খাতা মূল্যায়ন =================
-- কে কাটতে পারেন: মূল্যায়নকারী আর admin (সব পরীক্ষা), শিক্ষক (নিজের কোর্সের)। manager নন।
-- পরীক্ষার সময় শেষ হওয়ার পরই কাটা শুরু হয়, যাতে সমাধান আর নম্বর বিভাজন আগে ফাঁস না হয়
create function public.can_mark_exam(p_exam_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.exams e
                  where e.id = p_exam_id and e.kind <> 'mcq'
                    and (coalesce(public.my_role() in ('evaluator', 'admin'), false) or public.teaches(e.course_id)))
$$;

-- এখনকার প্রতি নম্বরের রেট (কখনো ঠিক না করলে ০)
create function public.current_marking_rate() returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce((select per_mark from public.marking_rates
                    where effective_from <= now() order by effective_from desc, id desc limit 1), 0)
$$;

-- রেট বদলানো (শুধু admin)। আগে কাটা খাতার টাকা বদলায় না
create function public.set_marking_rate(p_per_mark numeric) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(public.my_role() <> 'admin', true) then
    raise exception 'শুধু admin রেট ঠিক করতে পারেন' using errcode = '42501';
  end if;
  if p_per_mark is null or p_per_mark < 0 then
    raise exception 'রেট ০ বা তার বেশি হতে হবে';
  end if;
  insert into public.marking_rates (per_mark) values (p_per_mark);
  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'marking.rate', 'marking_rates', null, jsonb_build_object('per_mark', p_per_mark));
end $$;

-- কাটার জন্য প্রশ্ন: সমাধান আর নম্বর বিভাজন সহ, পরীক্ষা শেষ হওয়ার পর
create function public.marking_questions(p_exam_id bigint)
returns table (question_id bigint, question_no int, section text, body text, marks numeric,
               solution text, scheme text, image_path text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_mark_exam(p_exam_id) then
    raise exception 'এই পরীক্ষার খাতা কাটার অনুমতি নেই' using errcode = '42501';
  end if;
  if not public.exam_closed(p_exam_id) then
    raise exception 'পরীক্ষার সময় শেষ হওয়ার পর খাতা কাটা যাবে';
  end if;
  return query
    select q.id, (row_number() over (order by q.position, q.id))::int, q.section, q.body, q.marks,
           q.explanation, q.scheme, q.image_path
      from public.exam_questions q
     where q.exam_id = p_exam_id and q.kind = 'written'
     order by q.position, q.id;
end $$;

-- প্রশ্নভিত্তিক অগ্রগতি: কতগুলো খাতা, কাটা হয়েছে, কেউ ধরে আছেন, ফেরত, বাকি।
-- খাতা কাটতে পারেন এমন সবাই আর manager দেখেন
create function public.marking_progress(p_exam_id bigint)
returns table (question_id bigint, question_no int, section text, marks numeric,
               scripts bigint, marked bigint, in_hand bigint, returned bigint, remaining bigint,
               moderation_left bigint, flagged bigint, calibration_refs bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.can_mark_exam(p_exam_id) or public.is_staff()) then
    raise exception 'অনুমতি নেই' using errcode = '42501';
  end if;
  return query
    with s as (   -- কোন খাতায় কোন প্রশ্নের ছবি আছে
      select distinct sp.attempt_id, sp.question_id from public.script_pages sp
        join public.exam_attempts a on a.id = sp.attempt_id
       where a.exam_id = p_exam_id and a.status <> 'in_progress'
    )
    select q.id, (row_number() over (order by q.position, q.id))::int, q.section, q.marks,
           count(s.attempt_id),
           count(m.attempt_id) filter (where m.status = 'marked'),
           count(m.attempt_id) filter (where m.status = 'claimed' and m.claimed_at > now() - interval '20 minutes'),
           count(m.attempt_id) filter (where m.status = 'returned'),
           count(s.attempt_id) - count(m.attempt_id) filter (where m.status = 'marked'),
           count(m.attempt_id) filter (where m.moderation in ('pending', 'flagged')),
           count(m.attempt_id) filter (where m.moderation = 'flagged'),
           (select count(*) from public.calibration_refs cr where cr.question_id = q.id)
      from public.exam_questions q
      left join s on s.question_id = q.id
      left join public.script_marks m on m.attempt_id = s.attempt_id and m.question_id = q.id
     where q.exam_id = p_exam_id and q.kind = 'written'
     group by q.id, q.position, q.section, q.marks
     order by q.position, q.id;
end $$;

-- ক্যালিব্রেশনের অবস্থা (ভেতরের কাজ): দরকার কিনা (শুধু evaluator রোল, প্রশ্নে নমুনা আছে, আর এই
-- প্রশ্নের কোনো খাতা এখনো কাটেননি), পার হয়েছেন কিনা (অন্তত দুই-তৃতীয়াংশ পার্থক্যসীমার মধ্যে, বা
-- শিক্ষকের অনুমতি), পরের নমুনা কোনটা
create function public.calibration_state(p_question_id bigint, p_user uuid)
returns table (required boolean, cleared boolean, refs int, done int, within int, next_attempt bigint, failed boolean)
language sql stable security definer set search_path = '' as $$
  with r as (select count(*)::int as n from public.calibration_refs where question_id = p_question_id),
       c as (select count(*)::int as done, (count(*) filter (where within))::int as ok
               from public.calibration_marks where user_id = p_user and question_id = p_question_id),
       ap as (select exists (select 1 from public.calibration_approvals
                              where user_id = p_user and question_id = p_question_id) as v),
       ev as (select coalesce((select role = 'evaluator' from public.profiles where id = p_user), false)
                     and not exists (select 1 from public.script_marks m
                                      where m.marker_id = p_user and m.question_id = p_question_id
                                        and m.status = 'marked')
                     and not exists (select 1 from public.script_moderations s
                                      where s.moderator_id = p_user and s.question_id = p_question_id
                                        and s.marked_at is not null) as v)
  select r.n > 0 and ev.v,
         not (r.n > 0 and ev.v) or ap.v or (c.done >= r.n and c.ok * 3 >= r.n * 2),
         r.n, c.done, c.ok,
         (select cr.attempt_id from public.calibration_refs cr
           where cr.question_id = p_question_id
             and not exists (select 1 from public.calibration_marks cm
                              where cm.user_id = p_user and cm.question_id = p_question_id and cm.attempt_id = cr.attempt_id)
           order by cr.created_at, cr.attempt_id limit 1),
         r.n > 0 and ev.v and not ap.v and c.done >= r.n and c.ok * 3 < r.n * 2
    from r, c, ap, ev
$$;
revoke execute on function public.calibration_state(bigint, uuid) from public, anon, authenticated;

-- পরের খাতা নেওয়া। task বলে কী করতে হবে:
--   'calibrate': নতুন মূল্যায়নকারীর নমুনা খাতা (শিক্ষকের নম্বর দেখানো হয় না, সম্মানী নেই)
--   'mark':      কাটা (আগে নিজের হাতে থাকা, তারপর ফেরত আসা কারণসহ, তারপর নতুন)
--   'moderate':  দ্বিতীয় যাচাই: অন্যের কাটা খাতা, প্রথম নম্বর না দেখে
-- ক্রম: নমুনা → হাতে থাকা → ফেরত আসা → দ্বিতীয় যাচাই → নতুন। অন্য কেউ ২০ মিনিটের মধ্যে ধরা খাতা নয়।
-- শিক্ষার্থীর নাম যায় না, শুধু খাতার কোড আর পাতার path
create function public.claim_script(p_exam_id bigint, p_question_id bigint)
returns table (attempt_id bigint, script_code text, pages text[], return_reason text, task text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_attempt bigint;
  v_task text;
  c record;
begin
  if not public.can_mark_exam(p_exam_id) then
    raise exception 'এই পরীক্ষার খাতা কাটার অনুমতি নেই' using errcode = '42501';
  end if;
  if not public.exam_closed(p_exam_id) then
    raise exception 'পরীক্ষার সময় শেষ হওয়ার পর খাতা কাটা যাবে';
  end if;
  if not exists (select 1 from public.exam_questions q where q.id = p_question_id and q.exam_id = p_exam_id and q.kind = 'written') then
    raise exception 'প্রশ্ন পাওয়া যায়নি';
  end if;

  -- ১. ক্যালিব্রেশন
  select * into c from public.calibration_state(p_question_id, auth.uid());
  if c.required and not c.cleared then
    if c.next_attempt is null then
      raise exception 'নমুনা খাতায় নম্বর শিক্ষকের সাথে মেলেনি। শিক্ষক দেখে অনুমতি দিলে এই প্রশ্ন কাটা শুরু করতে পারবেন';
    end if;
    v_attempt := c.next_attempt;
    v_task := 'calibrate';
  end if;

  -- ২. নিজের হাতে থাকা (কাটা বা দ্বিতীয় যাচাই)
  if v_attempt is null then
    select m.attempt_id into v_attempt from public.script_marks m
     where m.question_id = p_question_id and m.status = 'claimed' and m.marker_id = auth.uid() limit 1;
    if v_attempt is not null then
      v_task := 'mark';
    else
      select s.attempt_id into v_attempt from public.script_moderations s
       where s.question_id = p_question_id and s.moderator_id = auth.uid() and s.marked_at is null limit 1;
      if v_attempt is not null then v_task := 'moderate'; end if;
    end if;
  end if;

  -- ৩. ফেরত আসা
  if v_attempt is null then
    select a.id into v_attempt
      from public.exam_attempts a
      join public.script_marks m on m.attempt_id = a.id and m.question_id = p_question_id
     where a.exam_id = p_exam_id and m.status = 'returned'
     order by a.submitted_at
     limit 1
       for update of m skip locked;
    if v_attempt is not null then v_task := 'mark'; end if;
  end if;

  -- ৪. দ্বিতীয় যাচাই: অন্যের কাটা, বাছাই হওয়া, কেউ ধরে নেই
  if v_attempt is null then
    select m.attempt_id into v_attempt
      from public.script_marks m
      left join public.script_moderations s on s.attempt_id = m.attempt_id and s.question_id = m.question_id
     where m.question_id = p_question_id and m.status = 'marked' and m.moderation = 'pending'
       and m.marker_id is distinct from auth.uid()
       and (s.attempt_id is null or (s.marked_at is null and s.claimed_at < now() - interval '20 minutes'))
     order by m.marked_at
     limit 1
       for update of m skip locked;
    if v_attempt is not null then
      insert into public.script_moderations as sm (attempt_id, question_id, moderator_id, claimed_at)
      values (v_attempt, p_question_id, auth.uid(), now())
      on conflict (attempt_id, question_id) do update
        set moderator_id = auth.uid(), claimed_at = now()
        where sm.marked_at is null;
      v_task := 'moderate';
    end if;
  end if;

  -- ৫. নতুন (বা ২০ মিনিট পেরিয়ে ছেড়ে দেওয়া)
  if v_attempt is null then
    select a.id into v_attempt
      from public.exam_attempts a
      left join public.script_marks m on m.attempt_id = a.id and m.question_id = p_question_id
     where a.exam_id = p_exam_id and a.status <> 'in_progress'
       and (a.upload_until is null or a.upload_until < now())
       and exists (select 1 from public.script_pages sp where sp.attempt_id = a.id and sp.question_id = p_question_id)
       and (m.attempt_id is null or (m.status = 'claimed' and m.claimed_at < now() - interval '20 minutes'))
     order by a.submitted_at
     limit 1
       for update of a skip locked;
    if v_attempt is null then
      return;   -- এই প্রশ্নের সব খাতা কাটা হয়ে গেছে বা অন্যদের হাতে
    end if;
    v_task := 'mark';
  end if;

  if v_task = 'mark' then
    insert into public.script_marks as sm (attempt_id, question_id, status, marker_id, claimed_at)
    values (v_attempt, p_question_id, 'claimed', auth.uid(), now())
    on conflict (attempt_id, question_id) do update
      set status = 'claimed', marker_id = auth.uid(), claimed_at = now()   -- ফেরতের কারণ থেকে যায়
      where sm.status <> 'marked';
  end if;

  return query
    select a.id, a.script_code,
           array(select sp.storage_path from public.script_pages sp
                  where sp.attempt_id = a.id and sp.question_id = p_question_id order by sp.page_no),
           case when v_task = 'mark' then m.return_reason end,
           v_task
      from public.exam_attempts a
      left join public.script_marks m on m.attempt_id = a.id and m.question_id = p_question_id
     where a.id = v_attempt;
end $$;

-- নম্বর দেওয়া। নম্বর ০ থেকে পূর্ণমান, ০.৫ এর ঘরে। claim_script এর task অনুযায়ী:
--   নমুনা (calibrate): শিক্ষকের নম্বরের সাথে মেলানো হয়, সম্মানী নেই। সব নমুনা শেষে না মিললে শিক্ষক জানেন
--   দ্বিতীয় যাচাই (moderate): প্রথম নম্বরের সাথে পার্থক্য সীমার মধ্যে হলে 'agreed', বেশি হলে 'flagged'
--     আর কোর্সের শিক্ষক জানেন। সম্মানী = পূর্ণমান × রেট
--   কাটা (mark): হাতে নেওয়া খাতায় (admin যেকোনোটায়)। সম্মানী = পূর্ণমান × রেট (admin হলে ০)।
--     admin ছাড়া সবার প্রত্যেক প্রশ্নে প্রথম ২টা আর তারপর moderation_percent % খাতা দ্বিতীয় যাচাইয়ে যায়,
--     আর AI খসড়া থেকে পূর্ণমানের moderation_tolerance % এর বেশি দূরে দেওয়া নম্বরও
-- ফেরত দেয় এই খাতার সম্মানী
create function public.save_script_mark(p_attempt_id bigint, p_question_id bigint, p_marks numeric,
                                        p_note text default null, p_annotations jsonb default null)
returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  m public.script_marks;
  s public.script_moderations;
  q public.exam_questions;
  e public.exams;
  c record;
  v_pay numeric;
  v_ref numeric;
  v_sample boolean;
  v_ai boolean;
begin
  select * into q from public.exam_questions where id = p_question_id;
  if q.id is null or not public.can_mark_exam(q.exam_id) then
    raise exception 'এই পরীক্ষার খাতা কাটার অনুমতি নেই' using errcode = '42501';
  end if;
  select * into e from public.exams where id = q.exam_id;
  if p_marks is null or p_marks < 0 or p_marks > q.marks or p_marks * 2 <> trunc(p_marks * 2) then
    raise exception 'নম্বর ০ থেকে % এর মধ্যে, ০.৫ এর ঘরে হতে হবে', q.marks;
  end if;
  v_pay := case when public.my_role() = 'admin' then 0 else round(q.marks * public.current_marking_rate(), 2) end;

  -- নমুনা খাতা
  select * into c from public.calibration_state(p_question_id, auth.uid());
  if c.required and not c.cleared then
    select ref_marks into v_ref from public.calibration_refs where question_id = p_question_id and attempt_id = p_attempt_id;
    if v_ref is null or c.next_attempt is distinct from p_attempt_id then
      raise exception 'আগে নমুনা খাতাগুলো কাটুন';
    end if;
    insert into public.calibration_marks (user_id, question_id, attempt_id, marks, within)
    values (auth.uid(), p_question_id, p_attempt_id, p_marks, abs(p_marks - v_ref) <= q.marks * e.moderation_tolerance / 100);
    select * into c from public.calibration_state(p_question_id, auth.uid());
    if c.failed then
      insert into public.notifications (user_id, kind, exam_id, body, sent_by)
      select ct.teacher_id, 'calibration', e.id,
             e.title || ': একজন মূল্যায়নকারীর নমুনা খাতার নম্বর মেলেনি, দেখে অনুমতি দিন', auth.uid()
        from public.course_teachers ct where ct.course_id = e.course_id;
    end if;
    return 0;
  end if;

  -- দ্বিতীয় যাচাই
  select * into s from public.script_moderations x
   where x.attempt_id = p_attempt_id and x.question_id = p_question_id for update;
  if s.attempt_id is not null and s.moderator_id = auth.uid() and s.marked_at is null then
    select * into m from public.script_marks where attempt_id = p_attempt_id and question_id = p_question_id;
    update public.script_moderations
       set marks = p_marks, marked_at = now(), pay_amount = v_pay, first_marks = m.marks
     where attempt_id = p_attempt_id and question_id = p_question_id;
    if abs(m.marks - p_marks) <= q.marks * e.moderation_tolerance / 100 then
      update public.script_marks set moderation = 'agreed' where attempt_id = p_attempt_id and question_id = p_question_id;
    else
      update public.script_marks set moderation = 'flagged' where attempt_id = p_attempt_id and question_id = p_question_id;
      insert into public.notifications (user_id, kind, exam_id, body, sent_by)
      select ct.teacher_id, 'moderation_flag', e.id,
             e.title || ': খাতা ' || (select script_code from public.exam_attempts where id = p_attempt_id)
               || ' এ দুই মূল্যায়নকারীর নম্বরে পার্থক্য ' || m.marks || ' বনাম ' || p_marks || ', চূড়ান্ত নম্বর দিন',
             auth.uid()
        from public.course_teachers ct where ct.course_id = e.course_id;
    end if;
    return v_pay;
  end if;

  -- সাধারণ কাটা
  select * into m from public.script_marks x
   where x.attempt_id = p_attempt_id and x.question_id = p_question_id for update;
  if m.attempt_id is null or m.status = 'marked' then
    raise exception 'আগে খাতাটা নিন (এটা কাটা হয়ে গেছে বা কারো হাতে নেই)';
  end if;
  if m.status = 'returned' or (m.marker_id is distinct from auth.uid() and public.my_role() <> 'admin') then
    raise exception 'এই খাতা এখন অন্য কেউ কাটছেন';
  end if;

  -- AI এর খসড়া নম্বর থেকে অনেক দূরে হলে নমুনার বাইরেও দ্বিতীয় যাচাই
  v_ai := (select abs(d.marks - p_marks) > q.marks * e.moderation_tolerance / 100
             from public.ai_mark_drafts d where d.attempt_id = p_attempt_id and d.question_id = p_question_id);
  v_sample := coalesce(public.my_role() <> 'admin', true)
              and s.attempt_id is null   -- আগে একবার দ্বিতীয় যাচাই হয়ে থাকলে (ফেরতের পর আবার কাটা) আর নয়
              and (coalesce(v_ai, false)
                   or (e.moderation_percent > 0
                       and ((select count(*) from public.script_marks x
                              where x.marker_id = auth.uid() and x.question_id = p_question_id and x.status = 'marked') < 2
                            or random() * 100 < e.moderation_percent)));
  update public.script_marks
     set status = 'marked', marks = p_marks, note = nullif(btrim(p_note), ''), annotations = p_annotations,
         marker_id = auth.uid(), marked_at = now(), pay_amount = v_pay, return_reason = null,
         moderation = case when v_sample then 'pending'::public.moderation_status end
   where attempt_id = p_attempt_id and question_id = p_question_id;
  return v_pay;
end $$;

-- AI খসড়া কে দেখতে বা চাইতে পারেন: খাতাটা কাটার জন্য নিজের হাতে আছে এমন মূল্যায়নকারী/শিক্ষক, অথবা
-- admin বা কোর্সের শিক্ষক (পার্থক্য বা পুনর্মূল্যায়ন দেখতে)। কিন্তু যিনি এই খাতার দ্বিতীয় যাচাই করছেন
-- তিনি নন, আর নমুনা খাতায়ও নয় (তখন খাতা হাতে থাকে না), যাতে না দেখে কাটার নিয়ম থাকে
create function public.can_see_ai_draft(p_attempt_id bigint, p_question_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.exam_questions q
      join public.exams e on e.id = q.exam_id
      join public.exam_attempts a on a.id = p_attempt_id and a.exam_id = q.exam_id
     where q.id = p_question_id and q.kind = 'written' and public.can_mark_exam(e.id)
       and not exists (select 1 from public.script_moderations mo
                        where mo.attempt_id = p_attempt_id and mo.question_id = p_question_id
                          and mo.moderator_id = auth.uid() and mo.marked_at is null)
       and (exists (select 1 from public.script_marks m
                     where m.attempt_id = p_attempt_id and m.question_id = p_question_id
                       and m.status = 'claimed' and m.marker_id = auth.uid())
            or coalesce(public.my_role() = 'admin', false) or public.teaches(e.course_id)))
$$;

-- AI এর জন্য খাতার তথ্য (server route ব্যবহারকারীর লগইনে ডাকে, তাই অনুমতি এখানেই যাচাই হয়),
-- আর আগে তৈরি খসড়া থাকলে সেটা (draft; মূল্যায়নকারীর পাতা এটা দেখায়, আবার AI ডাকে না)
create function public.ai_draft_context(p_attempt_id bigint, p_question_id bigint)
returns table (question text, scheme text, solution text, marks numeric, pages text[], draft jsonb)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.can_see_ai_draft(p_attempt_id, p_question_id) then
    raise exception 'এই খাতার AI খসড়া দেখার অনুমতি নেই' using errcode = '42501';
  end if;
  return query
    select q.body, q.scheme, q.explanation, q.marks,
           coalesce((select array_agg(sp.storage_path order by sp.page_no) from public.script_pages sp
                      where sp.attempt_id = p_attempt_id and sp.question_id = p_question_id), '{}'),
           (select jsonb_build_object('marks', d.marks, 'parts', d.parts, 'comment', d.comment,
                                      'model', d.model, 'created_at', d.created_at)
              from public.ai_mark_drafts d where d.attempt_id = p_attempt_id and d.question_id = p_question_id)
      from public.exam_questions q where q.id = p_question_id;
end $$;

-- AI এর ফল রাখা: শুধু server (service role), কারণ মূল্যায়নকারী নিজে "AI নম্বর" বসাতে পারলে AI এর সাথে
-- পার্থক্যের যাচাই এড়ানো যেত। নম্বর ০ থেকে পূর্ণমান, ০.৫ এর ঘরে
create function public.save_ai_draft(p_attempt_id bigint, p_question_id bigint, p_marks numeric,
                                     p_parts jsonb, p_comment text, p_model text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_max numeric;
begin
  select q.marks into v_max from public.exam_questions q
    join public.exam_attempts a on a.exam_id = q.exam_id and a.id = p_attempt_id
   where q.id = p_question_id and q.kind = 'written';
  if v_max is null then
    raise exception 'খাতা পাওয়া যায়নি';
  end if;
  insert into public.ai_mark_drafts as d (attempt_id, question_id, marks, parts, comment, model)
  values (p_attempt_id, p_question_id, least(greatest(round(coalesce(p_marks, 0) * 2) / 2, 0), v_max),
          case when jsonb_typeof(p_parts) = 'array' then p_parts else '[]' end, left(p_comment, 800), left(p_model, 60))
  on conflict (attempt_id, question_id) do update
    set marks = excluded.marks, parts = excluded.parts, comment = excluded.comment, model = excluded.model, created_at = now();
end $$;
revoke execute on function public.save_ai_draft(bigint, bigint, numeric, jsonb, text, text) from public, anon, authenticated;

-- কাটা খাতা ফেরত (মান যাচাই): admin বা কোর্সের শিক্ষক। ফেরত গেলে ওই খাতার সম্মানী বাদ যায়,
-- খাতা আবার কাটার তালিকার সবার আগে যায়, আর যিনি কেটেছিলেন তিনি কারণসহ নোটিফিকেশন পান
create function public.return_script_mark(p_attempt_id bigint, p_question_id bigint, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.script_marks;
  e public.exams;
begin
  select e2.* into e from public.exams e2 join public.exam_questions q on q.exam_id = e2.id where q.id = p_question_id;
  if e.id is null or not (coalesce(public.my_role() = 'admin', false) or public.teaches(e.course_id)) then
    raise exception 'শুধু admin বা কোর্সের শিক্ষক খাতা ফেরত দিতে পারেন' using errcode = '42501';
  end if;
  if e.results_published_at is not null then
    raise exception 'ফল প্রকাশের পর খাতা ফেরত দেওয়া যায় না';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'ফেরত দেওয়ার কারণ লিখুন';
  end if;
  if exists (select 1 from public.script_marks x where x.attempt_id = p_attempt_id and x.question_id = p_question_id
                and x.moderation = 'flagged') then
    raise exception 'দ্বিতীয় যাচাইয়ে পার্থক্য আছে, ফেরত না দিয়ে চূড়ান্ত নম্বর দিন';
  end if;
  -- ফেরত গেলে দ্বিতীয় যাচাই বাতিল (কেউ ধরে থাকলে ছেড়ে দেওয়া; কাটা হয়ে থাকলে তাঁর সম্মানী থাকে)
  delete from public.script_moderations x
   where x.attempt_id = p_attempt_id and x.question_id = p_question_id and x.marked_at is null;
  update public.script_marks
     set status = 'returned', return_reason = btrim(p_reason), returned_by = auth.uid(), pay_amount = 0,
         moderation = null
   where attempt_id = p_attempt_id and question_id = p_question_id and status = 'marked'
  returning * into m;
  if m.attempt_id is null then
    raise exception 'কাটা খাতা পাওয়া যায়নি';
  end if;
  insert into public.notifications (user_id, kind, exam_id, body, sent_by)
  values (m.marker_id, 'script_returned', e.id, 'একটি খাতা আবার কাটতে হবে: ' || btrim(p_reason), auth.uid());
  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'script.return', 'script_marks', p_attempt_id || ':' || p_question_id,
          jsonb_build_object('marker', m.marker_id, 'reason', p_reason));
end $$;

-- লিখিত/মিশ্র পরীক্ষার ফল প্রকাশ (admin বা কোর্সের শিক্ষক): সব খাতা কাটা হলে মোট নম্বর বসে,
-- শিক্ষার্থীরা নোটিফিকেশন পায়, আর মেধাতালিকা তৈরি হয়। কয়জনের ফল প্রকাশ হলো তা ফেরত দেয়
create function public.publish_written_results(p_exam_id bigint) returns int
language plpgsql security definer set search_path = '' as $$
declare
  e public.exams;
  v_left int;
  n int;
begin
  select * into e from public.exams where id = p_exam_id for update;
  if e.id is null or not (coalesce(public.my_role() = 'admin', false) or public.teaches(e.course_id)) then
    raise exception 'শুধু admin বা কোর্সের শিক্ষক ফল প্রকাশ করতে পারেন' using errcode = '42501';
  end if;
  if e.kind = 'mcq' then
    raise exception 'MCQ পরীক্ষার ফল নিজে থেকেই আসে';
  end if;
  if e.results_published_at is not null then
    raise exception 'ফল আগেই প্রকাশ হয়েছে';
  end if;
  if not public.exam_closed(p_exam_id) or exists (
       select 1 from public.exam_attempts a where a.exam_id = p_exam_id
          and (a.status = 'in_progress' or a.upload_until > now())) then
    raise exception 'পরীক্ষা বা খাতা জমার সময় এখনো শেষ হয়নি';
  end if;
  select count(*) into v_left
    from (select distinct sp.attempt_id, sp.question_id from public.script_pages sp
            join public.exam_attempts a on a.id = sp.attempt_id where a.exam_id = p_exam_id) s
    left join public.script_marks m on m.attempt_id = s.attempt_id and m.question_id = s.question_id
   where m.status is distinct from 'marked';
  if v_left > 0 then
    raise exception 'এখনো %টি খাতা কাটা বাকি', v_left;
  end if;
  select count(*) into v_left
    from public.script_marks m join public.exam_questions q on q.id = m.question_id
   where q.exam_id = p_exam_id and m.moderation in ('pending', 'flagged');
  if v_left > 0 then
    raise exception 'এখনো %টি খাতার দ্বিতীয় যাচাই বাকি', v_left;
  end if;

  update public.exam_attempts a
     set written_score = coalesce((select sum(m.marks) from public.script_marks m where m.attempt_id = a.id), 0),
         score = coalesce(a.mcq_score, 0)
               + coalesce((select sum(m.marks) from public.script_marks m where m.attempt_id = a.id), 0)
   where a.exam_id = p_exam_id and a.status <> 'in_progress';
  get diagnostics n = row_count;

  update public.exams set results_published_at = now() where id = p_exam_id;
  perform public.refresh_exam_ranks(p_exam_id);
  insert into public.notifications (user_id, kind, exam_id, body, sent_by)
  select a.user_id, 'exam_result', p_exam_id, e.title || ': ফল প্রকাশ হয়েছে', auth.uid()
    from public.exam_attempts a where a.exam_id = p_exam_id and a.status <> 'in_progress';
  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'exam.results', 'exams', p_exam_id::text, jsonb_build_object('students', n));
  return n;
end $$;

-- শিক্ষার্থীর কাটা খাতা: প্রতি প্রশ্নে পাতা, নম্বর, মন্তব্য, লাল দাগ আর সমাধান, ফল প্রকাশের পর।
-- নিজেরটা, অথবা কোর্সের শিক্ষক বা staff
create function public.my_written_result(p_attempt_id bigint)
returns table (question_no int, section text, body text, full_marks numeric, obtained numeric,
               note text, annotations jsonb, pages text[], solution text, question_id bigint,
               recheck_status public.recheck_status, recheck_reply text, recheck_open boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.exam_attempts;
begin
  select * into v from public.exam_attempts x where x.id = p_attempt_id;
  if v.id is null or not (v.user_id = auth.uid() or public.is_staff()
       or exists (select 1 from public.exams e where e.id = v.exam_id and public.teaches(e.course_id))) then
    raise exception 'এই খাতা দেখার অনুমতি নেই';
  end if;
  if not exists (select 1 from public.exams e where e.id = v.exam_id and e.results_published_at is not null) then
    raise exception 'ফল প্রকাশের পর খাতা দেখা যাবে';
  end if;
  return query
    select (row_number() over (order by q.position, q.id))::int, q.section, q.body, q.marks,
           m.marks, m.note, m.annotations,
           array(select sp.storage_path from public.script_pages sp
                  where sp.attempt_id = v.id and sp.question_id = q.id order by sp.page_no),
           q.explanation, q.id, rr.status, rr.reply,
           -- আবেদন করা যায়: কাটা খাতা, সময়ের মধ্যে, আগে করেনি, পরীক্ষায় ৩টির কম
           m.attempt_id is not null and rr.id is null
             and now() <= e.results_published_at + make_interval(days => e.recheck_days)
             and (select count(*) from public.recheck_requests x where x.attempt_id = v.id) < 3
      from public.exam_questions q
      join public.exams e on e.id = q.exam_id
      left join public.script_marks m on m.attempt_id = v.id and m.question_id = q.id and m.status = 'marked'
      left join public.recheck_requests rr on rr.attempt_id = v.id and rr.question_id = q.id
     where q.exam_id = v.exam_id and q.kind = 'written'
     order by q.position, q.id;
end $$;

-- মূল্যায়নকারীর ড্যাশবোর্ড: যেসব পরীক্ষার খাতা কাটা যায় (সময় শেষ, লিখিত অংশ আছে), অগ্রগতিসহ
create function public.marking_exams()
returns table (exam_id bigint, title text, course text, kind public.exam_kind, closes_at timestamptz,
               results_published boolean, scripts bigint, marked bigint, remaining bigint, moderation_left bigint)
language sql stable security definer set search_path = '' as $$
  with s as (
    select a.exam_id, sp.attempt_id, sp.question_id from public.script_pages sp
      join public.exam_attempts a on a.id = sp.attempt_id
     group by a.exam_id, sp.attempt_id, sp.question_id
  )
  select e.id, e.title, c.title, e.kind, e.closes_at, e.results_published_at is not null,
         count(s.attempt_id),
         count(m.attempt_id) filter (where m.status = 'marked'),
         count(s.attempt_id) - count(m.attempt_id) filter (where m.status = 'marked'),
         count(m.attempt_id) filter (where m.moderation in ('pending', 'flagged'))
    from public.exams e
    join public.courses c on c.id = e.course_id
    left join s on s.exam_id = e.id
    left join public.script_marks m on m.attempt_id = s.attempt_id and m.question_id = s.question_id
   where e.kind <> 'mcq' and public.exam_closed(e.id)
     and (public.can_mark_exam(e.id) or public.is_staff())
   group by e.id, e.title, c.title, e.kind, e.closes_at, e.results_published_at
   order by e.closes_at desc
$$;

-- নিজের কাটা খাতার হিসাব (মাসভিত্তিক): কবে, কোন পরীক্ষার কোন প্রশ্ন, পূর্ণমান, সম্মানী।
-- task: 'mark' (প্রথমবার কাটা) বা 'moderate' (দ্বিতীয় যাচাই)
create function public.my_marking_log(p_period date)
returns table (marked_at timestamptz, exam text, question_no int, full_marks numeric, pay_amount numeric,
               status public.script_status, task text)
language sql stable security definer set search_path = '' as $$
  select x.at, e.title,
         (select count(*) from public.exam_questions q2
           where q2.exam_id = q.exam_id and q2.kind = 'written'
             and (q2.position, q2.id) <= (q.position, q.id))::int,
         q.marks, x.pay, x.status, x.task
    from (select m.question_id, m.marked_at as at, m.pay_amount as pay, m.status, 'mark' as task
            from public.script_marks m
           where m.marker_id = auth.uid() and m.status in ('marked', 'returned') and m.marked_at is not null
          union all
          select s.question_id, s.marked_at, s.pay_amount, 'marked'::public.script_status, 'moderate'
            from public.script_moderations s
           where s.moderator_id = auth.uid() and s.marked_at is not null) x
    join public.exam_questions q on q.id = x.question_id
    join public.exams e on e.id = q.exam_id
   where date_trunc('month', x.at at time zone 'Asia/Dhaka')::date = p_period
   order by x.at desc
$$;

-- ================= মান যাচাই: দ্বিতীয় যাচাই, ক্যালিব্রেশন, মূল্যায়নকারীর পরিসংখ্যান =================
-- পরীক্ষা চালান কে: admin, অথবা কোর্সের শিক্ষক (প্রশ্নপত্রও শুধু এঁরাই দেখেন; manager নন)
create function public.can_manage_exam(p_exam_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.exams e where e.id = p_exam_id
                  and (coalesce(public.my_role() = 'admin', false) or public.teaches(e.course_id)))
$$;

-- দ্বিতীয় যাচাইয়ে পার্থক্য বেশি হলে চূড়ান্ত নম্বর: admin বা কোর্সের শিক্ষক, যিনি দুজনের কেউ নন
create function public.resolve_moderation(p_attempt_id bigint, p_question_id bigint, p_final numeric,
                                          p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  q public.exam_questions;
  m public.script_marks;
  s public.script_moderations;
begin
  select * into q from public.exam_questions where id = p_question_id;
  if q.id is null or not public.can_manage_exam(q.exam_id) then
    raise exception 'শুধু admin বা কোর্সের শিক্ষক চূড়ান্ত নম্বর দিতে পারেন' using errcode = '42501';
  end if;
  select * into m from public.script_marks where attempt_id = p_attempt_id and question_id = p_question_id for update;
  if m.moderation is distinct from 'flagged' then
    raise exception 'এই খাতায় সিদ্ধান্তের অপেক্ষায় কোনো পার্থক্য নেই';
  end if;
  select * into s from public.script_moderations where attempt_id = p_attempt_id and question_id = p_question_id;
  if coalesce(public.my_role() <> 'admin', true) and auth.uid() in (m.marker_id, s.moderator_id) then
    raise exception 'আপনি এই খাতার একজন মূল্যায়নকারী, অন্য শিক্ষক বা admin চূড়ান্ত করবেন';
  end if;
  if p_final is null or p_final < 0 or p_final > q.marks or p_final * 2 <> trunc(p_final * 2) then
    raise exception 'নম্বর ০ থেকে % এর মধ্যে, ০.৫ এর ঘরে হতে হবে', q.marks;
  end if;
  update public.script_marks
     set marks = p_final, moderation = 'resolved', note = coalesce(nullif(btrim(p_note), ''), note)
   where attempt_id = p_attempt_id and question_id = p_question_id;
  update public.script_moderations
     set final_marks = p_final, resolved_by = auth.uid(), resolved_at = now()
   where attempt_id = p_attempt_id and question_id = p_question_id;
  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'moderation.resolve', 'script_marks', p_attempt_id || ':' || p_question_id,
          jsonb_build_object('first', m.marks, 'second', s.marks, 'final', p_final));
end $$;

-- দ্বিতীয় যাচাইয়ে পার্থক্য হওয়া খাতাগুলো (শিক্ষক বা admin এর সিদ্ধান্তের জন্য)
create function public.moderation_queue(p_exam_id bigint)
returns table (attempt_id bigint, question_id bigint, question_no int, script_code text, full_marks numeric,
               first_marks numeric, first_marker text, second_marks numeric, second_marker text,
               note text, pages text[], status public.moderation_status)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not (public.can_manage_exam(p_exam_id) or public.is_staff()) then
    raise exception 'অনুমতি নেই' using errcode = '42501';
  end if;
  return query
    select m.attempt_id, q.id, qn.no, a.script_code, q.marks,
           coalesce(s.first_marks, m.marks), p1.full_name, s.marks, p2.full_name, m.note,
           array(select sp.storage_path from public.script_pages sp
                  where sp.attempt_id = m.attempt_id and sp.question_id = q.id order by sp.page_no),
           m.moderation
      from public.script_marks m
      join public.exam_questions q on q.id = m.question_id
      join (select x.id, (row_number() over (order by x.position, x.id))::int as no
              from public.exam_questions x where x.exam_id = p_exam_id and x.kind = 'written') qn on qn.id = q.id
      join public.exam_attempts a on a.id = m.attempt_id
      join public.script_moderations s on s.attempt_id = m.attempt_id and s.question_id = m.question_id
      left join public.profiles p1 on p1.id = m.marker_id
      left join public.profiles p2 on p2.id = s.moderator_id
     where q.exam_id = p_exam_id and s.marked_at is not null
     order by (m.moderation = 'flagged') desc, s.marked_at desc;
end $$;

-- নমুনা খাতা ঠিক করা (admin বা কোর্সের শিক্ষক): একটা কাটা খাতা আর তার সঠিক নম্বর।
-- নম্বর না দিলে যা কাটা আছে সেটাই। এক প্রশ্নে সর্বোচ্চ ৩টি
create function public.set_calibration_ref(p_attempt_id bigint, p_question_id bigint, p_marks numeric default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  q public.exam_questions;
  v numeric;
begin
  select * into q from public.exam_questions where id = p_question_id;
  if q.id is null or q.kind <> 'written' or not public.can_manage_exam(q.exam_id) then
    raise exception 'শুধু admin বা কোর্সের শিক্ষক নমুনা খাতা ঠিক করতে পারেন' using errcode = '42501';
  end if;
  v := coalesce(p_marks, (select m.marks from public.script_marks m
                           where m.attempt_id = p_attempt_id and m.question_id = p_question_id and m.status = 'marked'));
  if v is null then
    raise exception 'আগে খাতাটা কেটে নিন, বা নম্বর দিন';
  end if;
  if v < 0 or v > q.marks or v * 2 <> trunc(v * 2) then
    raise exception 'নম্বর ০ থেকে % এর মধ্যে, ০.৫ এর ঘরে হতে হবে', q.marks;
  end if;
  if not exists (select 1 from public.script_pages sp where sp.attempt_id = p_attempt_id and sp.question_id = p_question_id) then
    raise exception 'এই খাতায় এই প্রশ্নের উত্তর নেই';
  end if;
  if (select count(*) from public.calibration_refs where question_id = p_question_id and attempt_id <> p_attempt_id) >= 3 then
    raise exception 'এক প্রশ্নে সর্বোচ্চ ৩টি নমুনা খাতা';
  end if;
  insert into public.calibration_refs (question_id, attempt_id, ref_marks, set_by)
  values (p_question_id, p_attempt_id, v, auth.uid())
  on conflict (question_id, attempt_id) do update set ref_marks = excluded.ref_marks, set_by = excluded.set_by;
  -- শিক্ষকের নম্বরই নমুনা, তাই এটার আর দ্বিতীয় যাচাই লাগে না
  update public.script_marks set moderation = null
   where attempt_id = p_attempt_id and question_id = p_question_id and moderation = 'pending';
  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'calibration.ref', 'calibration_refs', p_attempt_id || ':' || p_question_id,
          jsonb_build_object('marks', v));
end $$;

create function public.remove_calibration_ref(p_attempt_id bigint, p_question_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.exam_questions q where q.id = p_question_id and public.can_manage_exam(q.exam_id)) then
    raise exception 'অনুমতি নেই' using errcode = '42501';
  end if;
  delete from public.calibration_refs where question_id = p_question_id and attempt_id = p_attempt_id;
end $$;

-- নমুনায় না মেলা মূল্যায়নকারীকে কাটার অনুমতি (শিক্ষক দেখে সন্তুষ্ট হলে)
create function public.approve_calibration(p_user_id uuid, p_question_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  q public.exam_questions;
begin
  select * into q from public.exam_questions where id = p_question_id;
  if q.id is null or not public.can_manage_exam(q.exam_id) then
    raise exception 'শুধু admin বা কোর্সের শিক্ষক অনুমতি দিতে পারেন' using errcode = '42501';
  end if;
  insert into public.calibration_approvals (user_id, question_id, approved_by)
  values (p_user_id, p_question_id, auth.uid()) on conflict do nothing;
  insert into public.notifications (user_id, kind, exam_id, body, sent_by)
  values (p_user_id, 'calibration', q.exam_id, 'নমুনা খাতা দেখে অনুমতি দেওয়া হয়েছে, এখন খাতা কাটা শুরু করতে পারেন', auth.uid());
  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'calibration.approve', 'calibration_approvals', p_user_id::text,
          jsonb_build_object('question', p_question_id));
end $$;

-- মূল্যায়নকারীর নিজের নমুনার ফল: সব নমুনা শেষ হলে শিক্ষকের নম্বরও দেখায় (শেখার জন্য)
create function public.my_calibration(p_question_id bigint)
returns table (required boolean, cleared boolean, refs int, done int, within int, failed boolean, feedback jsonb)
language sql stable security definer set search_path = '' as $$
  select c.required, c.cleared, c.refs, c.done, c.within, c.failed,
         case when c.done >= c.refs and c.refs > 0 then (
           select jsonb_agg(jsonb_build_object('script_code', a.script_code, 'mine', cm.marks,
                                               'teacher', cr.ref_marks, 'within', cm.within) order by cm.created_at)
             from public.calibration_marks cm
             join public.calibration_refs cr on cr.question_id = cm.question_id and cr.attempt_id = cm.attempt_id
             join public.exam_attempts a on a.id = cm.attempt_id
            where cm.user_id = auth.uid() and cm.question_id = p_question_id) end
    from public.calibration_state(p_question_id, auth.uid()) c
$$;

-- শিক্ষকের জন্য: কোন মূল্যায়নকারী কোন প্রশ্নের নমুনায় কেমন করেছেন
create function public.calibration_overview(p_exam_id bigint)
returns table (user_id uuid, evaluator text, question_id bigint, question_no int, refs int, done int,
               within int, status text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.can_manage_exam(p_exam_id) then
    raise exception 'অনুমতি নেই' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name, q.id, q.no, c.refs, c.done, c.within,
           case when exists (select 1 from public.calibration_approvals ap where ap.user_id = p.id and ap.question_id = q.id) then 'approved'
                when c.done = 0 then 'not_started'
                when c.failed then 'failed'
                when c.cleared then 'passed'
                else 'in_progress' end
      from (select x.id, (row_number() over (order by x.position, x.id))::int as no
              from public.exam_questions x where x.exam_id = p_exam_id and x.kind = 'written') q
      cross join public.profiles p
      cross join lateral public.calibration_state(q.id, p.id) c
     where p.role = 'evaluator' and c.refs > 0
       and (c.required or c.done > 0)   -- আগে থেকে এই প্রশ্ন কাটছেন এমন কারো নমুনা লাগে না
     order by q.no, p.full_name;
end $$;

-- মূল্যায়নকারীর পরিসংখ্যান (প্রশ্নভিত্তিক): কয়টা কেটেছেন, গড়ে কত % নম্বর দিয়েছেন আর সবার গড়,
-- খাতাপ্রতি সময়, দ্বিতীয় যাচাইয়ে কতবার অমিল, কতবার ফেরত। flags: নরম, কড়া, খুব দ্রুত, প্রায়ই অমিল
create function public.marker_stats(p_exam_id bigint)
returns table (marker_id uuid, marker text, role public.user_role, question_id bigint, question_no int,
               scripts bigint, avg_percent numeric, question_avg_percent numeric, avg_seconds int,
               question_avg_seconds int, moderated bigint, flagged bigint, returned bigint, flags text[])
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not (public.can_manage_exam(p_exam_id) or public.is_staff()) then
    raise exception 'অনুমতি নেই' using errcode = '42501';
  end if;
  return query
    with qs as (
      select x.id, x.marks, (row_number() over (order by x.position, x.id))::int as no
        from public.exam_questions x where x.exam_id = p_exam_id and x.kind = 'written'
    ), mk as (
      select m.marker_id, m.question_id,
             100 * coalesce(s.first_marks, m.marks) / qs.marks as pct,
             least(greatest(extract(epoch from m.marked_at - m.claimed_at), 0), 1200) as secs,
             s.marked_at is not null as moderated,
             m.moderation in ('flagged', 'resolved') as flagged
        from public.script_marks m
        join qs on qs.id = m.question_id
        left join public.script_moderations s on s.attempt_id = m.attempt_id and s.question_id = m.question_id
       where m.status = 'marked'
    ), qavg as (
      select mk.question_id, avg(mk.pct) as pct, avg(mk.secs) as secs from mk group by mk.question_id
    ), ret as (
      select (al.meta ->> 'marker')::uuid as marker_id, qs.id as question_id, count(*) as n
        from public.audit_logs al
        join qs on al.action = 'script.return' and split_part(al.entity_id, ':', 2) = qs.id::text
       group by 1, 2
    ), agg as (
      select mk.marker_id, mk.question_id, count(*) as scripts, avg(mk.pct) as pct, avg(mk.secs) as secs,
             count(*) filter (where mk.moderated) as moderated, count(*) filter (where mk.flagged) as flagged
        from mk group by mk.marker_id, mk.question_id
    )
    select g.marker_id, p.full_name, p.role, g.question_id, qs.no, g.scripts,
           round(g.pct, 1), round(qa.pct, 1), g.secs::int, qa.secs::int, g.moderated, g.flagged, coalesce(r.n, 0),
           array_remove(array[
             case when g.scripts >= 5 and g.pct - qa.pct >= 15 then 'নরম (গড়ের চেয়ে বেশি নম্বর)' end,
             case when g.scripts >= 5 and qa.pct - g.pct >= 15 then 'কড়া (গড়ের চেয়ে কম নম্বর)' end,
             case when g.scripts >= 5 and g.secs < 0.4 * qa.secs then 'খুব দ্রুত কাটছেন' end,
             case when g.moderated >= 3 and g.flagged * 10 >= g.moderated * 3 then 'দ্বিতীয় যাচাইয়ে প্রায়ই অমিল' end
           ], null)
      from agg g
      join qs on qs.id = g.question_id
      join qavg qa on qa.question_id = g.question_id
      join public.profiles p on p.id = g.marker_id
      left join ret r on r.marker_id = g.marker_id and r.question_id = g.question_id
     order by qs.no, g.scripts desc;
end $$;

-- ================= সংশোধন আর পুনর্মূল্যায়ন =================
-- প্রকাশের পর খাতার নম্বর বদল (ভেতরের কাজ): মোট নম্বর আর মেধাক্রম আবার হিসাব, সংশোধনের রেকর্ড,
-- শিক্ষার্থীকে জানানো
create function public.set_written_mark(p_attempt_id bigint, p_question_id bigint, p_marks numeric, p_reason text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.exam_attempts;
  e public.exams;
  v_old numeric;
begin
  select * into a from public.exam_attempts where id = p_attempt_id;
  select * into e from public.exams where id = a.exam_id;
  select marks into v_old from public.script_marks where attempt_id = p_attempt_id and question_id = p_question_id for update;
  update public.script_marks set marks = p_marks where attempt_id = p_attempt_id and question_id = p_question_id;
  update public.exam_attempts x
     set written_score = w.total, score = coalesce(x.mcq_score, 0) + w.total
    from (select coalesce(sum(m.marks), 0) as total from public.script_marks m
           where m.attempt_id = p_attempt_id and m.status = 'marked') w
   where x.id = p_attempt_id;
  insert into public.exam_corrections (exam_id, question_id, attempt_id, action, old_value, new_value, reason, by_user)
  values (e.id, p_question_id, p_attempt_id, 'marks', to_jsonb(v_old), to_jsonb(p_marks), p_reason, auth.uid());
  if e.ranks_computed_at is not null then
    perform public.refresh_exam_ranks(e.id);
  end if;
  insert into public.notifications (user_id, kind, exam_id, body, sent_by)
  values (a.user_id, 'exam_corrected', e.id,
          e.title || ': তোমার খাতার একটি প্রশ্নের নম্বর ' || v_old || ' থেকে ' || p_marks || ' করা হয়েছে', auth.uid());
  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'exam.marks_correct', 'script_marks', p_attempt_id || ':' || p_question_id,
          jsonb_build_object('old', v_old, 'new', p_marks, 'reason', p_reason));
end $$;
revoke execute on function public.set_written_mark(bigint, bigint, numeric, text) from public, anon, authenticated;

-- ফল প্রকাশের পর খাতার নম্বর সংশোধন (admin বা কোর্সের শিক্ষক), কারণসহ।
-- প্রকাশের আগে ভুল ধরা পড়লে return_script_mark দিয়ে ফেরত দিন
create function public.correct_script_mark(p_attempt_id bigint, p_question_id bigint, p_marks numeric, p_reason text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  q public.exam_questions;
  e public.exams;
  m public.script_marks;
begin
  select * into q from public.exam_questions where id = p_question_id;
  if q.id is null or not public.can_manage_exam(q.exam_id) then
    raise exception 'শুধু admin বা কোর্সের শিক্ষক নম্বর সংশোধন করতে পারেন' using errcode = '42501';
  end if;
  select * into e from public.exams where id = q.exam_id;
  if e.results_published_at is null then
    raise exception 'ফল প্রকাশের আগে খাতাটা ফেরত দিয়ে আবার কাটান';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'সংশোধনের কারণ লিখুন';
  end if;
  select * into m from public.script_marks where attempt_id = p_attempt_id and question_id = p_question_id;
  if m.status is distinct from 'marked' then
    raise exception 'কাটা খাতা পাওয়া যায়নি';
  end if;
  if p_marks is null or p_marks < 0 or p_marks > q.marks or p_marks * 2 <> trunc(p_marks * 2) then
    raise exception 'নম্বর ০ থেকে % এর মধ্যে, ০.৫ এর ঘরে হতে হবে', q.marks;
  end if;
  if p_marks = m.marks then
    raise exception 'নম্বর আগের মতোই আছে';
  end if;
  perform public.set_written_mark(p_attempt_id, p_question_id, p_marks, btrim(p_reason));
end $$;

-- MCQ প্রশ্নের সংশোধন (admin বা কোর্সের শিক্ষক), পরীক্ষা চলার সময় বা পরে, কারণসহ:
--   'key' = সঠিক উত্তর বদল (p_new_option), 'drop' = বাতিল, মোট থেকে বাদ,
--   'award' = বাতিল, সবাই পূর্ণ নম্বর, 'restore' = বাতিল ফেরানো।
-- সাথে সাথে সব জমা দেওয়া খাতার নম্বর আবার হিসাব হয়, মেধাক্রমও; যাদের জমা হয়েছে তারা নোটিফিকেশন পায়।
-- পরীক্ষা চলার সময় নোটিফিকেশনে কারণ যায় না (যাতে উত্তর ফাঁস না হয়)। ফেরত দেয় কয়জনের নম্বর বদলাল
create function public.correct_exam_question(p_question_id bigint, p_action text, p_reason text,
                                             p_new_option smallint default null) returns int
language plpgsql security definer set search_path = '' as $$
declare
  q public.exam_questions;
  e public.exams;
  v_old jsonb;
  v_new jsonb;
  n int;
begin
  select * into q from public.exam_questions where id = p_question_id for update;
  if q.id is null or not public.can_manage_exam(q.exam_id) then
    raise exception 'শুধু admin বা কোর্সের শিক্ষক প্রশ্ন সংশোধন করতে পারেন' using errcode = '42501';
  end if;
  if q.kind <> 'mcq' then
    raise exception 'লিখিত প্রশ্নে খাতার নম্বর সংশোধন করুন';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'সংশোধনের কারণ লিখুন';
  end if;
  select * into e from public.exams where id = q.exam_id;

  if p_action = 'key' then
    if q.cancelled is not null then
      raise exception 'বাতিল প্রশ্নের উত্তর বদলানো যায় না, আগে ফেরান';
    end if;
    if p_new_option is null or p_new_option < 0 or p_new_option >= jsonb_array_length(q.options)
       or p_new_option = q.correct_option then
      raise exception 'নতুন সঠিক উত্তর বেছে নিন';
    end if;
    v_old := jsonb_build_object('correct_option', q.correct_option);
    v_new := jsonb_build_object('correct_option', p_new_option);
    update public.exam_questions set correct_option = p_new_option where id = q.id;
  elsif p_action in ('drop', 'award') then
    if q.cancelled is not null then
      raise exception 'প্রশ্নটি আগেই বাতিল';
    end if;
    v_old := jsonb_build_object('cancelled', null);
    v_new := jsonb_build_object('cancelled', p_action);
    update public.exam_questions set cancelled = p_action where id = q.id;
  elsif p_action = 'restore' then
    if q.cancelled is null then
      raise exception 'প্রশ্নটি বাতিল নয়';
    end if;
    v_old := jsonb_build_object('cancelled', q.cancelled);
    v_new := jsonb_build_object('cancelled', null);
    update public.exam_questions set cancelled = null where id = q.id;
  else
    raise exception 'অজানা সংশোধন';
  end if;

  insert into public.exam_corrections (exam_id, question_id, action, old_value, new_value, reason, by_user)
  values (e.id, q.id, p_action, v_old, v_new, btrim(p_reason), auth.uid());
  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'exam.correct', 'exam_questions', q.id::text,
          jsonb_build_object('action', p_action, 'old', v_old, 'new', v_new, 'reason', btrim(p_reason)));
  n := public.regrade_exam(e.id);
  insert into public.notifications (user_id, kind, exam_id, body, sent_by)
  select a.user_id, 'exam_corrected', e.id,
         e.title || ': একটি প্রশ্নে সংশোধন হয়েছে'
           || case when public.exam_closed(e.id) then ' (' || btrim(p_reason) || ')' else '' end
           || ', নম্বর আবার হিসাব করা হয়েছে', auth.uid()
    from public.exam_attempts a where a.exam_id = e.id and a.status <> 'in_progress';
  return n;
end $$;

-- পুনর্মূল্যায়নের আবেদন (শিক্ষার্থী নিজের খাতার একটা প্রশ্নের জন্য)
create function public.request_recheck(p_attempt_id bigint, p_question_id bigint, p_reason text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  a public.exam_attempts;
  e public.exams;
  m public.script_marks;
  v_id bigint;
begin
  select * into a from public.exam_attempts where id = p_attempt_id and user_id = auth.uid();
  if a.id is null then
    raise exception 'খাতা পাওয়া যায়নি' using errcode = '42501';
  end if;
  select * into e from public.exams where id = a.exam_id;
  if e.results_published_at is null then
    raise exception 'ফল প্রকাশের পর আবেদন করা যাবে';
  end if;
  if now() > e.results_published_at + make_interval(days => e.recheck_days) then
    raise exception 'আবেদনের সময় শেষ (ফল প্রকাশের % দিনের মধ্যে)', e.recheck_days;
  end if;
  select * into m from public.script_marks where attempt_id = a.id and question_id = p_question_id and status = 'marked';
  if m.attempt_id is null then
    raise exception 'এই প্রশ্নের কাটা খাতা নেই';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'কেন আবার দেখা দরকার, সংক্ষেপে লেখো';
  end if;
  if exists (select 1 from public.recheck_requests where attempt_id = a.id and question_id = p_question_id) then
    raise exception 'এই প্রশ্নে আগেই আবেদন করেছ';
  end if;
  if (select count(*) from public.recheck_requests where attempt_id = a.id) >= 3 then
    raise exception 'এক পরীক্ষায় সর্বোচ্চ ৩টি প্রশ্নে আবেদন করা যায়';
  end if;
  insert into public.recheck_requests (attempt_id, question_id, user_id, reason, old_marks)
  values (a.id, p_question_id, auth.uid(), btrim(p_reason), m.marks)
  returning id into v_id;
  insert into public.notifications (user_id, kind, exam_id, body, sent_by)
  select ct.teacher_id, 'recheck_request', e.id, e.title || ': খাতা ' || a.script_code || ' এ পুনর্মূল্যায়নের আবেদন', auth.uid()
    from public.course_teachers ct where ct.course_id = e.course_id;
  return v_id;
end $$;

-- আবেদনের সিদ্ধান্ত (admin বা কোর্সের শিক্ষক, যিনি প্রথমে কাটেননি): নতুন নম্বর দিলে বদলায়,
-- একই নম্বর দিলে "অপরিবর্তিত", নম্বর না দিলে বাতিল (কারণসহ)। শিক্ষার্থী নোটিফিকেশন পায়
create function public.resolve_recheck(p_request_id bigint, p_new_marks numeric, p_reply text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.recheck_requests;
  q public.exam_questions;
  e public.exams;
  m public.script_marks;
  v_status public.recheck_status;
begin
  select * into r from public.recheck_requests where id = p_request_id for update;
  if r.id is null then
    raise exception 'আবেদন পাওয়া যায়নি';
  end if;
  select * into q from public.exam_questions where id = r.question_id;
  if not public.can_manage_exam(q.exam_id) then
    raise exception 'শুধু admin বা কোর্সের শিক্ষক সিদ্ধান্ত দিতে পারেন' using errcode = '42501';
  end if;
  if r.status <> 'pending' then
    raise exception 'এই আবেদনের সিদ্ধান্ত আগেই হয়েছে';
  end if;
  select * into m from public.script_marks where attempt_id = r.attempt_id and question_id = r.question_id;
  if m.marker_id = auth.uid() and coalesce(public.my_role() <> 'admin', true) then
    raise exception 'আপনি খাতাটা কেটেছিলেন, অন্য শিক্ষক বা admin দেখবেন';
  end if;
  if length(btrim(coalesce(p_reply, ''))) < 3 then
    raise exception 'শিক্ষার্থীর জন্য উত্তর লিখুন';
  end if;
  select * into e from public.exams where id = q.exam_id;
  if p_new_marks is null then
    v_status := 'rejected';
  else
    if p_new_marks < 0 or p_new_marks > q.marks or p_new_marks * 2 <> trunc(p_new_marks * 2) then
      raise exception 'নম্বর ০ থেকে % এর মধ্যে, ০.৫ এর ঘরে হতে হবে', q.marks;
    end if;
    v_status := case when p_new_marks = m.marks then 'unchanged' else 'changed' end;
    if v_status = 'changed' then
      perform public.set_written_mark(r.attempt_id, r.question_id, p_new_marks, 'পুনর্মূল্যায়ন: ' || btrim(p_reply));
    end if;
  end if;
  update public.recheck_requests
     set status = v_status, new_marks = p_new_marks, reply = btrim(p_reply), resolved_by = auth.uid(), resolved_at = now()
   where id = r.id;
  insert into public.notifications (user_id, kind, exam_id, body, sent_by)
  values (r.user_id, 'recheck_result', e.id,
          e.title || ': পুনর্মূল্যায়ন ' || case v_status when 'changed' then 'শেষ, নম্বর ' || m.marks || ' থেকে ' || p_new_marks
                                                       when 'unchanged' then 'শেষ, নম্বর একই আছে' else 'আবেদন গ্রহণ হয়নি' end,
          auth.uid());
  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'recheck.resolve', 'recheck_requests', r.id::text,
          jsonb_build_object('status', v_status, 'old', m.marks, 'new', p_new_marks));
end $$;

-- পুনর্মূল্যায়নের আবেদনের তালিকা (admin বা কোর্সের শিক্ষক): শিক্ষার্থীর নাম নয়, খাতার কোড
create function public.recheck_queue(p_exam_id bigint default null)
returns table (request_id bigint, exam_id bigint, exam text, question_id bigint, question_no int,
               script_code text, reason text, old_marks numeric, full_marks numeric, created_at timestamptz,
               pages text[], marker text, marker_is_me boolean, status public.recheck_status,
               new_marks numeric, reply text)
language sql stable security definer set search_path = '' as $$
  select r.id, e.id, e.title, q.id,
         (select count(*) from public.exam_questions q2 where q2.exam_id = q.exam_id and q2.kind = 'written'
             and (q2.position, q2.id) <= (q.position, q.id))::int,
         a.script_code, r.reason, r.old_marks, q.marks, r.created_at,
         array(select sp.storage_path from public.script_pages sp
                where sp.attempt_id = r.attempt_id and sp.question_id = r.question_id order by sp.page_no),
         p.full_name, m.marker_id = auth.uid(), r.status, r.new_marks, r.reply
    from public.recheck_requests r
    join public.exam_questions q on q.id = r.question_id
    join public.exams e on e.id = q.exam_id
    join public.exam_attempts a on a.id = r.attempt_id
    left join public.script_marks m on m.attempt_id = r.attempt_id and m.question_id = r.question_id
    left join public.profiles p on p.id = m.marker_id
   where (p_exam_id is null or e.id = p_exam_id) and public.can_manage_exam(e.id)
   order by (r.status = 'pending') desc, r.created_at
$$;

-- ================= বিশ্লেষণ: সন্দেহজনক pattern, প্রশ্নের মান, অধ্যায়ভিত্তিক রিপোর্ট =================
-- পরীক্ষা শেষে প্রতিজনের সংকেত (শাস্তি নয়, শিক্ষক দেখে সিদ্ধান্ত নেন):
--   খুব কম সময়ে (সময়ের ২৫% এর কম) MCQ তে ৯০%+, বারবার ট্যাব বদল (৫ বার বা ২ মিনিট+),
--   মাঝপথে বের হওয়ায় জমা (অন্য ট্যাব/অ্যাপ, back, পাতা ছাড়া, আবার খোলা, অন্য ডিভাইসে লগইন;
--   end_reason এ কোনটা), আর বিরল ভুল উত্তরে অন্যের সাথে মিল: যে ভুল অপশন খুব কম জন
--   (৫% বা ২ জন) বেছেছে, এমন ৩টি বা বেশি প্রশ্নে দুজনের একই ভুল উত্তর
create function public.exam_integrity(p_exam_id bigint)
returns table (attempt_id bigint, user_id uuid, student text, user_code text, script_code text,
               status public.attempt_status, score numeric, minutes_used numeric, tab_hidden int,
               hidden_seconds int, offline int, end_reason public.attempt_end_reason, flags text[],
               similar_to text[])
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not (public.can_manage_exam(p_exam_id) or public.is_staff()) then
    raise exception 'অনুমতি নেই' using errcode = '42501';
  end if;
  if not public.exam_closed(p_exam_id) then
    raise exception 'পরীক্ষা শেষ হওয়ার পর দেখা যাবে';
  end if;
  return query
    select * from (
      with sub as (
        select a.*, extract(epoch from least(a.submitted_at, a.deadline_at) - a.started_at) as secs
          from public.exam_attempts a where a.exam_id = p_exam_id and a.status <> 'in_progress'
      ), n as (select count(*) as c from sub),
      ev as (
        select x.attempt_id, count(*) filter (where x.kind = 'tab_hidden') as th,
               coalesce(sum(x.seconds) filter (where x.kind = 'tab_hidden'), 0) as hs,
               count(*) filter (where x.kind = 'offline') as off
          from public.attempt_events x where x.attempt_id in (select id from sub) group by x.attempt_id
      ), wrong as (
        select aa.attempt_id, aa.question_id, aa.selected_option
          from public.attempt_answers aa
          join sub on sub.id = aa.attempt_id
          join public.exam_questions q on q.id = aa.question_id and q.cancelled is null
         where aa.selected_option <> q.correct_option
      ), freq as (
        select w.question_id, w.selected_option, count(*) as f from wrong w group by 1, 2
      ), rare as (
        select w.* from wrong w
          join freq f on f.question_id = w.question_id and f.selected_option = w.selected_option
         cross join n where f.f >= 2 and f.f <= greatest(2, n.c * 0.05)
      ), pairs as (
        select r1.attempt_id as a1, r2.attempt_id as a2
          from rare r1 join rare r2 on r2.question_id = r1.question_id and r2.selected_option = r1.selected_option
                                    and r2.attempt_id <> r1.attempt_id
         group by 1, 2 having count(*) >= 3
      ), sim as (
        select p.a1, array_agg(pr.user_code order by pr.user_code) as codes
          from pairs p join sub s2 on s2.id = p.a2 join public.profiles pr on pr.id = s2.user_id
         group by p.a1
      ), tot as (select public.exam_mcq_total(p_exam_id) as t)
      select s.id, s.user_id, pr.full_name as student, pr.user_code, s.script_code, s.status,
             coalesce(s.score, s.mcq_score), round((s.secs / 60)::numeric, 1),
             coalesce(ev.th, 0)::int, coalesce(ev.hs, 0)::int, coalesce(ev.off, 0)::int, s.end_reason,
             array_remove(array[
               case when s.secs < e.duration_minutes * 60 * 0.25 and tot.t > 0 and s.mcq_score >= tot.t * 0.9
                    then 'খুব কম সময়ে প্রায় পূর্ণ নম্বর' end,
               case when coalesce(ev.th, 0) >= 5 or coalesce(ev.hs, 0) >= 120 then 'বারবার ট্যাব বদল' end,
               case when s.end_reason in ('tab_hidden', 'back', 'left', 'reopened', 'other_device')
                    then 'মাঝপথে বের হওয়ায় জমা' end,
               case when sim.codes is not null then 'বিরল ভুল উত্তরে অন্যের সাথে মিল' end
             ], null) as flags,
             coalesce(sim.codes, '{}')
        from sub s
        join public.exams e on e.id = s.exam_id
        join public.profiles pr on pr.id = s.user_id
        left join ev on ev.attempt_id = s.id
        left join sim on sim.a1 = s.id
        cross join tot
    ) x
    order by cardinality(x.flags) desc, x.student;
end $$;

-- প্রশ্নের মান বিশ্লেষণ (admin বা কোর্সের শিক্ষক, পরীক্ষা শেষে):
--   correct_pct: কত % সঠিক (লিখিততে গড়ে পূর্ণমানের কত %), skip_pct: কত % উত্তর দেয়নি,
--   discrimination: মোট নম্বরে উপরের ২৭% আর নিচের ২৭% এর সঠিকের হারের পার্থক্য (০.২ এর কম দুর্বল,
--   ঋণাত্মক হলে উত্তর-চাবি ভুল হতে পারে), option_pct: প্রতিটি অপশন কত % বেছেছে।
--   flags: খুব সহজ/কঠিন, দুর্বল বা উল্টো পার্থক্য, কোনো ভুল অপশন সঠিকের চেয়ে বেশি বাছাই, অকেজো অপশন
create function public.exam_item_analysis(p_exam_id bigint)
returns table (question_id bigint, question_no int, kind text, section text, body text, chapter text,
               marks numeric, correct_option smallint, cancelled text, responses bigint, correct_pct numeric,
               skip_pct numeric, discrimination numeric, option_pct jsonb, flags text[])
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.can_manage_exam(p_exam_id) then
    raise exception 'অনুমতি নেই' using errcode = '42501';
  end if;
  if not public.exam_closed(p_exam_id) then
    raise exception 'পরীক্ষা শেষ হওয়ার পর দেখা যাবে';
  end if;
  return query
    with sub as (
      select a.id, coalesce(a.score, a.mcq_score, 0) as sc
        from public.exam_attempts a where a.exam_id = p_exam_id and a.status <> 'in_progress'
    ), grp as (
      select s.id, case when count(*) over () >= 4 and percent_rank() over (order by s.sc) >= 0.73 then 'u'
                        when count(*) over () >= 4 and percent_rank() over (order by s.sc) <= 0.27 then 'l' end as g
        from sub s
    ), n as (select count(*) as c from sub),
    oc as (
      select aa.question_id, aa.selected_option, count(*) as c
        from public.attempt_answers aa join sub on sub.id = aa.attempt_id group by 1, 2
    ), mc as (
      select q.id as qid, count(g.id) as resp,
             count(aa.attempt_id) filter (where aa.selected_option = q.correct_option) as correct,
             count(g.id) filter (where aa.selected_option is null) as skip,
             avg(case when aa.selected_option = q.correct_option then 1.0 else 0 end) filter (where g.g = 'u') as pu,
             avg(case when aa.selected_option = q.correct_option then 1.0 else 0 end) filter (where g.g = 'l') as pl
        from public.exam_questions q
        cross join grp g
        left join public.attempt_answers aa on aa.attempt_id = g.id and aa.question_id = q.id
       where q.exam_id = p_exam_id and q.kind = 'mcq'
       group by q.id
    ), wr as (
      select q.id as qid, count(m.attempt_id) as resp, avg(m.marks / q.marks) as pct,
             avg(m.marks / q.marks) filter (where g.g = 'u') as pu, avg(m.marks / q.marks) filter (where g.g = 'l') as pl
        from public.exam_questions q
        join public.script_marks m on m.question_id = q.id and m.status = 'marked'
        join grp g on g.id = m.attempt_id
       where q.exam_id = p_exam_id and q.kind = 'written'
       group by q.id
    ), base as (
      select q.id, (row_number() over (order by q.position, q.id))::int as no, q.kind, q.section,
             left(q.body, 200) as body, c.title as chapter, q.marks, q.correct_option, q.cancelled,
             coalesce(mc.resp, wr.resp, 0) as resp,
             round(100 * case when q.kind = 'mcq' then mc.correct::numeric / nullif(mc.resp, 0) else wr.pct end, 1) as cp,
             round(100 * mc.skip::numeric / nullif(mc.resp, 0), 1) as sp,
             round(coalesce(mc.pu, wr.pu) - coalesce(mc.pl, wr.pl), 2) as d,
             case when q.kind = 'mcq' then
               (select jsonb_agg(round(100.0 * coalesce((select oc.c from oc where oc.question_id = q.id
                                                          and oc.selected_option = i), 0) / nullif(n.c, 0), 1) order by i)
                  from generate_series(0, jsonb_array_length(q.options) - 1) i) end as opts,
             n.c as total
        from public.exam_questions q
        cross join n
        left join public.chapters c on c.id = q.chapter_id
        left join mc on mc.qid = q.id
        left join wr on wr.qid = q.id
       where q.exam_id = p_exam_id
    )
    select b.id, b.no, b.kind, b.section, b.body, b.chapter, b.marks, b.correct_option, b.cancelled,
           b.resp, b.cp, b.sp, b.d, b.opts,
           case when b.cancelled is not null or b.resp < 5 then '{}'::text[] else array_remove(array[
             case when b.cp > 90 then 'খুব সহজ' end,
             case when b.cp < 20 then 'খুব কঠিন' end,
             case when b.d < 0 then 'উল্টো পার্থক্য: দুর্বলরা বেশি সঠিক, উত্তর-চাবি দেখুন' end,
             case when b.d >= 0 and b.d < 0.2 then 'দুর্বল পার্থক্য' end,
             case when b.kind = 'mcq' and exists (
                    select 1 from jsonb_array_elements_text(b.opts) with ordinality o(v, i)
                     where o.i - 1 <> b.correct_option and (o.v)::numeric > b.cp)
                  then 'একটি ভুল অপশন সঠিকের চেয়ে বেশি বাছাই হয়েছে' end,
             case when b.kind = 'mcq' and b.total >= 20 and exists (
                    select 1 from jsonb_array_elements_text(b.opts) with ordinality o(v, i)
                     where o.i - 1 <> b.correct_option and (o.v)::numeric < 2)
                  then 'অকেজো অপশন (২% এর কম বাছাই)' end
           ], null) end
      from base b
     order by b.no;
end $$;

-- অধ্যায়ভিত্তিক রিপোর্ট: শেষ হওয়া পরীক্ষাগুলোর প্রশ্ন অধ্যায় ধরে, আমি কত % পেয়েছি আর ক্লাসের গড়।
-- MCQ অংশ পরীক্ষা শেষ হলেই, লিখিত অংশ ফল প্রকাশের পর। কোথায় দুর্বল তা বোঝার জন্য
create function public.my_chapter_report(p_course_id bigint)
returns table (chapter_id bigint, chapter text, subject text, questions bigint, my_percent numeric,
               class_percent numeric)
language sql stable security definer set search_path = '' as $$
  with ex as (
    select e.id, e.results_published_at is not null as wr
      from public.exams e where e.course_id = p_course_id and public.exam_closed(e.id)
  ), items as (
    select a.user_id, q.chapter_id, q.marks as possible,
           case when q.cancelled = 'award' or aa.selected_option = q.correct_option then q.marks else 0 end as got
      from public.exam_attempts a
      join ex on ex.id = a.exam_id
      join public.exam_questions q on q.exam_id = a.exam_id and q.kind = 'mcq' and q.cancelled is distinct from 'drop'
      left join public.attempt_answers aa on aa.attempt_id = a.id and aa.question_id = q.id
     where a.status <> 'in_progress' and q.chapter_id is not null
    union all
    select a.user_id, q.chapter_id, q.marks, m.marks
      from public.exam_attempts a
      join ex on ex.id = a.exam_id and ex.wr
      join public.script_marks m on m.attempt_id = a.id and m.status = 'marked'
      join public.exam_questions q on q.id = m.question_id
     where a.status <> 'in_progress' and q.chapter_id is not null
  )
  select c.id, c.title, s.name,
         count(*) filter (where i.user_id = auth.uid()),
         round(100 * sum(i.got) filter (where i.user_id = auth.uid())
                   / nullif(sum(i.possible) filter (where i.user_id = auth.uid()), 0), 1),
         round(100 * sum(i.got) / nullif(sum(i.possible), 0), 1)
    from items i
    join public.chapters c on c.id = i.chapter_id
    join public.subjects s on s.id = c.subject_id
   where public.can_see_course_results(p_course_id)
   group by c.id, c.title, s.name, s.position, c.position
   order by s.position, c.position
$$;

-- ================= প্রশ্নোত্তর (Q&A) =================
-- কে উত্তর দিতে পারে: পড়াশোনার প্রশ্নে কোর্সের শিক্ষক বা admin (manager নন, তিনি শুধু শিক্ষককে
-- জানান); ভর্তির প্রশ্নে manager বা admin (শিক্ষক নন)
create function public.can_answer_qa(p_question_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.qa_questions q
     where q.id = p_question_id
       and case q.kind
             when 'study' then public.teaches(q.course_id) or coalesce(public.my_role() = 'admin', false)
             else public.is_staff()
           end)
$$;

-- প্রশ্নোত্তরের তালিকা, নাম সহ। profiles এর RLS এ শিক্ষার্থী অন্যদের নাম দেখতে পায় না, তাই
-- এই function শুধু নামটুকু দেয় (ফোন বা অন্য কিছু নয়)। ভর্তির প্রশ্ন পাবলিক পেজে দেখায়,
-- তাই staff ছাড়া অন্যরা প্রশ্নকারীর নামের শুধু প্রথম শব্দ পান। কে কোন প্রশ্ন দেখবে তা RLS এর মতোই
create function public.qa_feed(p_course_id bigint, p_kind public.qa_kind default 'study')
returns table (id bigint, chapter_id bigint, body text, asker text, is_mine boolean,
               answered_at timestamptz, created_at timestamptz, answers jsonb)
language sql stable security definer set search_path = '' as $$
  select q.id, q.chapter_id, q.body,
         case when q.kind = 'enrollment' and not public.is_staff()
              then split_part(p.full_name, ' ', 1) else p.full_name end,
         coalesce(q.user_id = auth.uid(), false), q.answered_at, q.created_at,
         coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'body', a.body, 'by', ap.full_name,
                                                       'role', ap.role, 'created_at', a.created_at)
                                    order by a.created_at)
                     from public.qa_answers a
                     join public.profiles ap on ap.id = a.user_id
                    where a.question_id = q.id), '[]'::jsonb)
    from public.qa_questions q
    join public.profiles p on p.id = q.user_id
   where q.course_id = p_course_id
     and q.kind = p_kind
     and case q.kind
           when 'study' then public.can_see_course_results(q.course_id)
           else (q.answered_at is not null or q.user_id = auth.uid() or public.is_staff())
                and exists (select 1 from public.courses c
                             where c.id = q.course_id and (c.is_published or public.is_staff()))
         end
   order by q.created_at desc
$$;

-- প্রথম উত্তর এলে প্রশ্নে answered_at বসে, আর প্রশ্নকারী নোটিফিকেশন পান
create function public.on_qa_answer() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  q public.qa_questions;
begin
  update public.qa_questions set answered_at = coalesce(answered_at, new.created_at)
   where id = new.question_id
  returning * into q;
  if q.user_id <> new.user_id then
    insert into public.notifications (user_id, kind, question_id, body, sent_by)
    values (q.user_id, 'qa_answer', q.id, 'আপনার প্রশ্নের উত্তর এসেছে: ' || left(q.body, 60), new.user_id);
  end if;
  return new;
end $$;

create trigger qa_answer_added after insert on qa_answers
  for each row execute function public.on_qa_answer();

-- সব উত্তর মুছে গেলে প্রশ্ন আবার "উত্তর বাকি" হয়
create function public.on_qa_answer_removed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.qa_questions q set answered_at = null
   where q.id = old.question_id
     and not exists (select 1 from public.qa_answers a where a.question_id = old.question_id);
  return old;
end $$;

create trigger qa_answer_removed after delete on qa_answers
  for each row execute function public.on_qa_answer_removed();

-- উত্তর বাকি একটা প্রশ্নের জন্য শিক্ষককে জানানো (admin বা manager)।
-- p_teacher_id না দিলে কোর্সের সব শিক্ষক পান। একই শিক্ষককে একই প্রশ্নে ৩ ঘণ্টায় একবারের বেশি নয়।
-- যাদের জানানো হলো তাদের id আর ফোন ফেরত দেয়: p_sms = true হলে API route এই নম্বরে
-- SMS পাঠিয়ে sms_logs এ লেখে
create function public.remind_teacher(p_question_id bigint, p_teacher_id uuid default null,
                                      p_note text default null, p_sms boolean default false)
returns table (teacher_id uuid, phone text)
language plpgsql security definer set search_path = '' as $$
declare
  q public.qa_questions;
  n int;
begin
  if not public.is_staff() then
    raise exception 'শুধু admin বা manager শিক্ষককে জানাতে পারেন' using errcode = '42501';
  end if;
  select * into q from public.qa_questions where id = p_question_id;
  if q.id is null then
    raise exception 'প্রশ্ন পাওয়া যায়নি';
  end if;
  if q.kind <> 'study' then
    raise exception 'এটা ভর্তির প্রশ্ন; manager কে জানাতে remind_manager() ব্যবহার করুন';
  end if;
  if q.answered_at is not null then
    raise exception 'এই প্রশ্নের উত্তর দেওয়া হয়ে গেছে';
  end if;
  if not exists (select 1 from public.course_teachers ct
                  where ct.course_id = q.course_id and (p_teacher_id is null or ct.teacher_id = p_teacher_id)) then
    raise exception 'এই কোর্সে এই শিক্ষক যুক্ত নেই';
  end if;

  return query
    with targets as (
      select ct.teacher_id as tid from public.course_teachers ct
       where ct.course_id = q.course_id
         and (p_teacher_id is null or ct.teacher_id = p_teacher_id)
         and not exists (select 1 from public.notifications x
                          where x.kind = 'qa_reminder' and x.question_id = q.id and x.user_id = ct.teacher_id
                            and x.created_at > now() - interval '3 hours')
    ), sent as (
      insert into public.notifications (user_id, kind, question_id, body, sent_by, via_sms)
      select t.tid, 'qa_reminder', q.id,
             coalesce(nullif(btrim(p_note), ''), 'একটি প্রশ্নের উত্তর বাকি, দয়া করে উত্তর দিন'),
             auth.uid(), p_sms
        from targets t
      returning user_id
    )
    select s.user_id, p.phone from sent s join public.profiles p on p.id = s.user_id;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'গত ৩ ঘণ্টার মধ্যে আগেই জানানো হয়েছে';
  end if;

  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'qa.remind', 'qa_questions', q.id::text,
          jsonb_build_object('teachers', n, 'sms', p_sms));
end $$;

-- একজন শিক্ষকের সব বাকি প্রশ্নের জন্য একবারে জানানো (যেগুলোতে গত ৩ ঘণ্টায় জানানো হয়নি)।
-- কয়টি প্রশ্নের জন্য জানানো হলো তা ফেরত দেয়। SMS গেলে একটাই যায়: "আপনার Nটি প্রশ্নের উত্তর বাকি"
create function public.remind_teacher_all(p_teacher_id uuid, p_note text default null,
                                          p_sms boolean default false) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if not public.is_staff() then
    raise exception 'শুধু admin বা manager শিক্ষককে জানাতে পারেন' using errcode = '42501';
  end if;
  insert into public.notifications (user_id, kind, question_id, body, sent_by, via_sms)
  select p_teacher_id, 'qa_reminder', q.id,
         coalesce(nullif(btrim(p_note), ''), 'একটি প্রশ্নের উত্তর বাকি, দয়া করে উত্তর দিন'),
         auth.uid(), p_sms
    from public.qa_questions q
    join public.course_teachers ct on ct.course_id = q.course_id and ct.teacher_id = p_teacher_id
   where q.kind = 'study'
     and q.answered_at is null
     and not exists (select 1 from public.notifications x
                      where x.kind = 'qa_reminder' and x.question_id = q.id and x.user_id = p_teacher_id
                        and x.created_at > now() - interval '3 hours');
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'জানানোর মতো কোনো প্রশ্ন নেই (উত্তর বাকি নেই, বা গত ৩ ঘণ্টায় জানানো হয়েছে)';
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'qa.remind', 'profiles', p_teacher_id::text,
          jsonb_build_object('questions', n, 'sms', p_sms));
  return n;
end $$;

-- উত্তর বাকি একটা ভর্তির প্রশ্নের জন্য manager কে জানানো (শুধু admin)।
-- p_manager_id না দিলে সব manager পান। একই manager কে একই প্রশ্নে ৩ ঘণ্টায় একবারের বেশি নয়।
-- ফেরত আসা ফোনে API route চাইলে SMS পাঠায় (p_sms)
create function public.remind_manager(p_question_id bigint, p_manager_id uuid default null,
                                      p_note text default null, p_sms boolean default false)
returns table (manager_id uuid, phone text)
language plpgsql security definer set search_path = '' as $$
declare
  q public.qa_questions;
  n int;
begin
  if coalesce(public.my_role() <> 'admin', true) then
    raise exception 'শুধু admin manager কে জানাতে পারেন' using errcode = '42501';
  end if;
  select * into q from public.qa_questions where id = p_question_id;
  if q.id is null then
    raise exception 'প্রশ্ন পাওয়া যায়নি';
  end if;
  if q.kind <> 'enrollment' then
    raise exception 'এটা পড়াশোনার প্রশ্ন; শিক্ষককে জানাতে remind_teacher() ব্যবহার করুন';
  end if;
  if q.answered_at is not null then
    raise exception 'এই প্রশ্নের উত্তর দেওয়া হয়ে গেছে';
  end if;
  if not exists (select 1 from public.profiles m
                  where m.role = 'manager' and (p_manager_id is null or m.id = p_manager_id)) then
    raise exception 'এমন কোনো manager নেই';
  end if;

  return query
    with targets as (
      select m.id as mid from public.profiles m
       where m.role = 'manager'
         and (p_manager_id is null or m.id = p_manager_id)
         and not exists (select 1 from public.notifications x
                          where x.kind = 'qa_reminder' and x.question_id = q.id and x.user_id = m.id
                            and x.created_at > now() - interval '3 hours')
    ), sent as (
      insert into public.notifications (user_id, kind, question_id, body, sent_by, via_sms)
      select t.mid, 'qa_reminder', q.id,
             coalesce(nullif(btrim(p_note), ''), 'ভর্তির একটি প্রশ্নের উত্তর বাকি, দয়া করে উত্তর দিন'),
             auth.uid(), p_sms
        from targets t
      returning user_id
    )
    select s.user_id, p.phone from sent s join public.profiles p on p.id = s.user_id;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'গত ৩ ঘণ্টার মধ্যে আগেই জানানো হয়েছে';
  end if;

  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'qa.remind_manager', 'qa_questions', q.id::text,
          jsonb_build_object('managers', n, 'sms', p_sms));
end $$;

-- একজন manager এর কাছে সব বাকি ভর্তির প্রশ্নের জন্য একবারে (গত ৩ ঘণ্টায় যেগুলোতে জানানো হয়নি)।
-- কয়টি প্রশ্নের জন্য জানানো হলো তা ফেরত দেয়; SMS গেলে একটাই
create function public.remind_manager_all(p_manager_id uuid, p_note text default null,
                                          p_sms boolean default false) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if coalesce(public.my_role() <> 'admin', true) then
    raise exception 'শুধু admin manager কে জানাতে পারেন' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_manager_id and role = 'manager') then
    raise exception 'এমন কোনো manager নেই';
  end if;
  insert into public.notifications (user_id, kind, question_id, body, sent_by, via_sms)
  select p_manager_id, 'qa_reminder', q.id,
         coalesce(nullif(btrim(p_note), ''), 'ভর্তির একটি প্রশ্নের উত্তর বাকি, দয়া করে উত্তর দিন'),
         auth.uid(), p_sms
    from public.qa_questions q
   where q.kind = 'enrollment'
     and q.answered_at is null
     and not exists (select 1 from public.notifications x
                      where x.kind = 'qa_reminder' and x.question_id = q.id and x.user_id = p_manager_id
                        and x.created_at > now() - interval '3 hours');
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'জানানোর মতো কোনো প্রশ্ন নেই (উত্তর বাকি নেই, বা গত ৩ ঘণ্টায় জানানো হয়েছে)';
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'qa.remind_manager', 'profiles', p_manager_id::text,
          jsonb_build_object('questions', n, 'sms', p_sms));
  return n;
end $$;

-- নিজের নোটিফিকেশন পড়া হয়েছে চিহ্ন দেওয়া। p_ids না দিলে সবগুলো
create function public.mark_notifications_read(p_ids bigint[] default null) returns int
language sql security definer set search_path = '' as $$
  with done as (
    update public.notifications set read_at = now()
     where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids))
    returning 1
  )
  select count(*)::int from done
$$;

-- ================= অগ্রগতির রিপোর্ট view =================
-- সব view security_invoker: যে দেখছে তার RLS মেনে data আসে।
-- শিক্ষার্থী নিজেরটা, শিক্ষক নিজের কোর্সের, admin ও manager সব দেখে

-- কোর্স অগ্রগতি: কবে কোন বিষয়ের কোন অধ্যায়ের কত নম্বর লেকচার এসেছে
create view public.course_progress with (security_invoker = on) as
select l.created_at        as published_at,
       l.id                as lesson_id,
       l.course_id,
       c.title             as course,
       s.name              as subject,
       ch.title            as chapter,
       l.lecture_no,
       l.title             as lecture,
       l.video_status,
       l.bunny_video_id,                       -- লিংক নয়; দেখার লিংক token সহ আলাদা তৈরি হয়
       l.duration_seconds,
       l.is_preview
  from public.lessons l
  join public.courses c        on c.id = l.course_id
  left join public.chapters ch on ch.id = l.chapter_id
  left join public.subjects s  on s.id = ch.subject_id;

-- পরীক্ষার ফলাফল, প্রতি attempt এ এক লাইন
create view public.exam_results with (security_invoker = on) as
select a.submitted_at,
       a.id                as attempt_id,
       a.user_id,
       p.user_code,
       p.full_name         as student,
       e.course_id,
       e.id                as exam_id,
       e.title             as exam,
       a.score             as obtained,
       t.total             as total_marks,
       round(100 * a.score / nullif(t.total, 0), 1) as percent,
       a.status
  from public.exam_attempts a
  join public.exams e    on e.id = a.exam_id
  join public.profiles p on p.id = a.user_id
  cross join lateral (select public.exam_total_marks(e.id) as total) t
 where a.status <> 'in_progress';

-- শিক্ষার্থীর অগ্রগতি, প্রতি কোর্সে এক লাইন: কত ভিডিও শেষ, কয়টা পরীক্ষা, গড় নম্বর
create view public.student_progress with (security_invoker = on) as
select en.user_id,
       p.user_code,
       p.full_name   as student,
       p.institute,
       p.guardian_phone,
       en.course_id,
       c.title       as course,
       v.total       as videos_total,
       v.completed   as videos_completed,
       round(100.0 * v.completed / nullif(v.total, 0), 1) as video_percent,
       x.taken       as exams_taken,
       x.avg_percent as exam_avg_percent,
       greatest(v.last_watch, x.last_exam) as last_activity
  from public.enrollments en
  join public.profiles p on p.id = en.user_id
  join public.courses c  on c.id = en.course_id
  cross join lateral (
    select count(*) filter (where l.video_status = 'ready') as total,
           count(*) filter (where lp.completed)             as completed,
           max(lp.updated_at)                               as last_watch
      from public.lessons l
      left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = en.user_id
     where l.course_id = en.course_id
  ) v
  cross join lateral (
    select count(*) as taken, round(avg(r.percent), 1) as avg_percent, max(r.submitted_at) as last_exam
      from public.exam_results r
     where r.user_id = en.user_id and r.course_id = en.course_id
  ) x
 where en.status = 'active';

-- শিক্ষকের অগ্রগতি, প্রতি মাসে এক লাইন: নেওয়া ক্লাস, মোট সম্মানী, পেয়েছেন, বাকি
create view public.teacher_progress with (security_invoker = on) as
with done as (
  select teacher_id,
         date_trunc('month', starts_at at time zone 'Asia/Dhaka')::date as period,
         count(*)        as classes,
         sum(pay_amount) as earned
    from public.class_assignments
   where status = 'done'
   group by 1, 2
), paid as (
  select teacher_id, period, sum(amount) as paid, max(paid_at) as last_paid_at
    from public.teacher_payouts
   group by 1, 2
)
select coalesce(d.period, pd.period)                             as period,
       pr.id                                                      as teacher_id,
       pr.user_code,
       pr.full_name                                               as teacher,
       coalesce(d.classes, 0)                                     as total_classes,
       coalesce(d.earned, 0)                                      as total_payment,
       coalesce(pd.paid, 0)                                       as payment_received,
       greatest(coalesce(d.earned, 0) - coalesce(pd.paid, 0), 0) as payment_due,
       pd.last_paid_at
  from done d
  full join paid pd on pd.teacher_id = d.teacher_id and pd.period = d.period
  join public.profiles pr on pr.id = coalesce(d.teacher_id, pd.teacher_id);

-- শিক্ষকভিত্তিক উত্তর বাকি প্রশ্ন: admin ও manager এর "শিক্ষককে জানান" অংশ, শিক্ষক নিজেরটা দেখেন।
-- last_reminded_at দেখে বোঝা যায় শেষ কবে জানানো হয়েছে (৩ ঘণ্টার মধ্যে আবার জানানো যায় না)
create view public.qa_pending_by_teacher with (security_invoker = on) as
select ct.teacher_id,
       pr.full_name                    as teacher,
       pr.phone,
       count(*)                        as pending,
       min(q.created_at)               as oldest_at,
       max(r.last_reminded_at)         as last_reminded_at,
       count(*) filter (where r.last_reminded_at is null
                           or r.last_reminded_at < now() - interval '3 hours') as can_remind
  from public.qa_questions q
  join public.course_teachers ct on ct.course_id = q.course_id
  join public.profiles pr on pr.id = ct.teacher_id
  left join lateral (
       select max(x.created_at) as last_reminded_at from public.notifications x
        where x.kind = 'qa_reminder' and x.question_id = q.id and x.user_id = ct.teacher_id) r on true
 where q.kind = 'study'
   and q.answered_at is null
   and (public.is_staff() or ct.teacher_id = auth.uid())
 group by ct.teacher_id, pr.full_name, pr.phone;

-- manager ভিত্তিক উত্তর বাকি ভর্তির প্রশ্ন: admin এর "ম্যানেজারকে জানান" অংশ, manager নিজেরটা দেখেন।
-- ভর্তির প্রশ্ন সব manager এর কাছে যায়, তাই প্রতিটি manager এর জন্য একই বাকি প্রশ্ন গোনা হয়
create view public.qa_pending_by_manager with (security_invoker = on) as
select pr.id                           as manager_id,
       pr.full_name                    as manager,
       pr.phone,
       count(*)                        as pending,
       min(q.created_at)               as oldest_at,
       max(r.last_reminded_at)         as last_reminded_at,
       count(*) filter (where r.last_reminded_at is null
                           or r.last_reminded_at < now() - interval '3 hours') as can_remind
  from public.qa_questions q
  cross join public.profiles pr
  left join lateral (
       select max(x.created_at) as last_reminded_at from public.notifications x
        where x.kind = 'qa_reminder' and x.question_id = q.id and x.user_id = pr.id) r on true
 where q.kind = 'enrollment'
   and q.answered_at is null
   and pr.role = 'manager'
   and (public.my_role() = 'admin' or pr.id = auth.uid())
 group by pr.id, pr.full_name, pr.phone;

revoke all on public.course_progress, public.exam_results,
              public.student_progress, public.teacher_progress,
              public.qa_pending_by_teacher, public.qa_pending_by_manager from anon;

-- ================= RLS (মূল কয়েকটা policy) =================
alter table profiles            enable row level security;
alter table courses             enable row level security;
alter table course_teachers     enable row level security;
alter table subjects            enable row level security;
alter table chapters            enable row level security;
alter table lessons             enable row level security;
alter table study_materials     enable row level security;
alter table payments            enable row level security;
alter table enrollments         enable row level security;
alter table lesson_progress     enable row level security;
alter table bookmarks           enable row level security;
alter table student_notes       enable row level security;
alter table qa_questions        enable row level security;
alter table qa_answers          enable row level security;
alter table live_sessions       enable row level security;
-- [JaaS] alter table live_attendance     enable row level security;
alter table live_stream_keys    enable row level security;   -- [Broadcast]
alter table live_views          enable row level security;   -- [Broadcast]
alter table live_comments       enable row level security;   -- [Broadcast]
alter table exams               enable row level security;
alter table exam_questions      enable row level security;
alter table exam_attempts       enable row level security;
alter table attempt_answers     enable row level security;
alter table script_pages        enable row level security;
alter table script_marks        enable row level security;
alter table marking_rates       enable row level security;
alter table script_moderations  enable row level security;
alter table calibration_refs    enable row level security;   -- policy নেই: শিক্ষকের নম্বর মূল্যায়নকারী দেখেন না
alter table calibration_marks   enable row level security;   -- policy নেই: my_calibration() দিয়ে
alter table calibration_approvals enable row level security;
alter table recheck_requests    enable row level security;
alter table attempt_events      enable row level security;   -- policy নেই: exam_integrity() দিয়ে
alter table exam_corrections    enable row level security;
alter table exam_ranks          enable row level security;   -- policy নেই: লিডারবোর্ড function দিয়ে
alter table ai_mark_drafts      enable row level security;   -- policy নেই: ai_draft_context() দিয়ে
alter table active_sessions     enable row level security;   -- policy নেই: session_status() দিয়ে
alter table device_logins       enable row level security;
alter table admission_circulars enable row level security;
alter table audit_logs          enable row level security;
alter table sms_logs            enable row level security;
alter table webhook_events      enable row level security;
alter table teacher_rates       enable row level security;
alter table class_assignments   enable row level security;
alter table teacher_payouts     enable row level security;
alter table expenses            enable row level security;
alter table notices             enable row level security;
alter table notifications       enable row level security;

-- profiles: নিজেরটা দেখা যায়, admin ও manager সবারটা দেখে
create policy profiles_select on profiles for select
  using (id = auth.uid() or public.is_staff());

-- role আর user_code কেউ নিজে বদলাতে পারবে না; নাম, ছবি আর নিজের তথ্যগুলো পারবে
revoke update on profiles from authenticated;
grant update (full_name, avatar_url, institute, guardian_phone, department, batch)
  on profiles to authenticated;
create policy profiles_update_own on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- কোর্স: published হলে সবাই দেখবে, ড্রাফট দেখে admin, manager আর সেই কোর্সের শিক্ষক
create policy courses_select on courses for select
  using (is_published or public.is_staff() or public.teaches(id));

-- কোর্সে কে পড়ান সেটা পাবলিক তথ্য। যুক্ত করা হয় assign_class() বা admin দিয়ে
create policy course_teachers_select on course_teachers for select using (true);

-- payments: নিজের আবেদন দেখা আর নতুন আবেদন (শুধু pending)। admin ও manager সব দেখে
create policy payments_select on payments for select
  using (user_id = auth.uid() or public.is_staff());
create policy payments_insert on payments for insert
  with check (user_id = auth.uid() and status = 'pending' and reviewed_by is null);
-- update/delete এর policy নেই, তাই বদলানো যায় শুধু approve/reject function দিয়ে

-- enrollments: শুধু দেখা যায়। তৈরি বা বদলায় approve_payment(), manual_enroll(),
-- extend_enrollment(), revoke_enrollment() দিয়ে
create policy enrollments_select on enrollments for select
  using (user_id = auth.uid() or public.is_staff());

-- exam_questions: স্টুডেন্টের জন্য কোনো policy নেই, তাই উত্তর কখনো দেখা যায় না। manager ও দেখেন না
-- (প্রশ্নপত্র যত কম মানুষের কাছে, ফাঁসের ঝুঁকি তত কম)। পরীক্ষা শুরুর পর বদল আটকায় exam_paper_frozen
create policy exam_questions_staff on exam_questions for all
  using (public.my_role() = 'admin'
         or exists (select 1 from public.exams e
                    where e.id = exam_id and public.teaches(e.course_id)));

-- নিজের data: bookmark, নোট, progress
create policy bookmarks_own on bookmarks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notes_own on student_notes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy progress_own on lesson_progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- live_sessions: ভর্তি স্টুডেন্ট আর কোর্সের teacher দেখে (Realtime ও এই নিয়ম মানে)
create policy live_select on live_sessions for select
  using (public.is_enrolled(course_id) or public.teaches(course_id)
         or public.my_role() = 'admin');

-- sms_logs আর audit_logs: শুধু দেখা যায়, লেখে server বা function
create policy sms_logs_staff on sms_logs for select using (public.is_staff());
create policy audit_admin on audit_logs for select using (public.my_role() = 'admin');

-- teacher_rates: admin ও manager দেখে, শিক্ষক নিজেরটা দেখে, বদলায় শুধু admin
create policy rates_select on teacher_rates for select
  using (public.is_staff() or teacher_id = auth.uid());
create policy rates_admin_write on teacher_rates for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- ক্লাস আর সম্মানী: admin ও manager সব দেখে, শিক্ষক নিজেরটা।
-- লেখা যায় শুধু উপরের function দিয়ে (insert/update policy নেই)
create policy classes_select on class_assignments for select
  using (public.is_staff() or teacher_id = auth.uid());
create policy payouts_select on teacher_payouts for select
  using (public.is_staff() or teacher_id = auth.uid());

-- অন্য খরচ: শুধু admin
create policy expenses_admin on expenses for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- নোটিশ: admin ও manager পাঠায়; স্টুডেন্ট ও শিক্ষক নিজের জন্য পাঠানো ওয়েবসাইট নোটিশ দেখে
-- মূল্যায়নকারীদের নোটিশ পাঠান শুধু admin
create policy notices_staff on notices for all
  using (public.is_staff())
  with check (public.is_staff() and sent_by = auth.uid()
              and (audience <> 'evaluators' or public.my_role() = 'admin'));
create policy notices_read on notices for select
  using (channel <> 'sms' and (
         (audience = 'all_students' and public.my_role() = 'student')
      or (audience = 'course' and (public.is_enrolled(course_id) or public.teaches(course_id)))
      or (audience = 'teachers' and public.my_role() = 'teacher')
      or (audience = 'evaluators' and public.my_role() = 'evaluator')));

-- সিলেবাস (বিষয়, অধ্যায়, লেকচারের নাম) কোর্স দেখা গেলেই দেখা যায়।
-- ভিডিও চালানো আটকায় Bunny token API, যেটা এনরোলমেন্ট যাচাই করে
create policy subjects_select on subjects for select
  using (exists (select 1 from public.courses c where c.id = course_id));
create policy chapters_select on chapters for select
  using (exists (select 1 from public.courses c where c.id = course_id));
create policy lessons_select on lessons for select
  using (exists (select 1 from public.courses c where c.id = course_id));

-- স্টাডি ম্যাটেরিয়ালের তালিকা: কোর্সে ভর্তি শিক্ষার্থী, কোর্সের শিক্ষক, admin ও manager
create policy materials_select on study_materials for select
  using (public.can_see_course_results(course_id));

-- আপলোড: শিক্ষক নিজের কোর্সে যোগ, বদল আর মুছতে পারেন; admin ও manager সব কোর্সে।
-- ধরন (kind) আর অধ্যায় (chapter_id) আপলোডের সময় শিক্ষক বেছে দেন, তাতেই শিক্ষার্থীর পেজে সাজানো হয়
create policy materials_write on study_materials for all
  using (public.teaches(course_id) or public.is_staff())
  with check (public.teaches(course_id) or public.is_staff());

-- শিক্ষক নিজের কোর্সের শিক্ষার্থীদের নাম, এনরোলমেন্ট আর ভিডিও অগ্রগতি দেখে
create policy profiles_teacher_select on profiles for select
  using (public.teaches_student(id));
create policy enrollments_teacher_select on enrollments for select
  using (public.teaches(course_id));
create policy progress_staff_select on lesson_progress for select
  using (public.is_staff()
         or exists (select 1 from public.lessons l
                    where l.id = lesson_id and public.teaches(l.course_id)));

-- পরীক্ষা: শিক্ষার্থী নিজের কোর্সের প্রকাশিত পরীক্ষা দেখে, শিক্ষক নিজের কোর্সের, staff সব
create policy exams_select on exams for select
  using (public.is_staff() or public.teaches(course_id)
         or (is_published and public.is_enrolled(course_id)));
-- পরীক্ষা তৈরি আর বদল: admin সব কোর্সে, শিক্ষক নিজের কোর্সে। শুরুর পর সময় আর নিয়ম বন্ধ (exam_rules_frozen),
-- প্রকাশের আগে যাচাই (exam_publish_check)। মোছা যায় শুধু প্রকাশ না করা পরীক্ষা।
-- ফল প্রকাশ আর মেধাক্রমের column function দিয়ে বসে, তাই সেগুলো লেখার অনুমতি নেই; created_by নিজে বসে
create policy exams_insert on exams for insert
  with check (public.my_role() = 'admin' or public.teaches(course_id));
create policy exams_update on exams for update
  using (public.my_role() = 'admin' or public.teaches(course_id))
  with check (public.my_role() = 'admin' or public.teaches(course_id));
create policy exams_delete on exams for delete
  using ((public.my_role() = 'admin' or public.teaches(course_id)) and not is_published);
revoke insert, update on exams from authenticated;
grant insert (course_id, title, kind, duration_minutes, negative_mark, opens_at, closes_at, pick_rules,
              upload_grace_minutes, shuffle, submit_on_hide, moderation_percent, moderation_tolerance,
              recheck_days, solution_pdf_path, is_published) on exams to authenticated;
grant update (course_id, title, kind, duration_minutes, negative_mark, opens_at, closes_at, pick_rules,
              upload_grace_minutes, shuffle, submit_on_hide, moderation_percent, moderation_tolerance,
              recheck_days, solution_pdf_path, is_published) on exams to authenticated;

-- প্রশ্নের ছবি (bucket 'question-images', path <exam_id>/<file>): কে রাখতে আর কে দেখতে পারেন
create function public.question_image_exam(p_path text) returns bigint
language sql immutable set search_path = '' as $$
  select case when split_part(p_path, '/', 1) ~ '^\d{1,18}$' then split_part(p_path, '/', 1)::bigint end
$$;
-- রাখা, বদলানো, মোছা: admin বা কোর্সের শিক্ষক, পরীক্ষা শুরুর আগে
create function public.question_image_writable(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.can_manage_exam(public.question_image_exam(p_path))
                  and not public.exam_started(public.question_image_exam(p_path)), false)
$$;
-- দেখা: যাঁরা প্রশ্ন বসান, staff, খাতা কাটার লোক; আর পরীক্ষা শুরুর পর কোর্সে ভর্তি শিক্ষার্থী
create function public.question_image_readable(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.can_manage_exam(public.question_image_exam(p_path)) or public.is_staff()
                  or public.can_mark_exam(public.question_image_exam(p_path))
                  or (public.exam_started(public.question_image_exam(p_path))
                      and exists (select 1 from public.exams e
                                   where e.id = public.question_image_exam(p_path) and e.is_published
                                     and public.is_enrolled(e.course_id))), false)
$$;
create policy attempts_select on exam_attempts for select
  using (user_id = auth.uid() or public.is_staff()
         or exists (select 1 from public.exams e
                    where e.id = exam_id and public.teaches(e.course_id)));
-- attempts এ insert/update policy নেই: start_exam, submit_exam আর ফল প্রকাশের function লেখে।
-- attempt_answers এ কোনো policy নেই, তাই সময় শেষের আগে কেউ নিজের সঠিক/ভুল দেখতে পায় না

-- খাতার পাতা: শিক্ষার্থী নিজের লিখিত প্রশ্নের পাতা দেয় পরীক্ষা চলার সময় আর জমার পর
-- upload_until পর্যন্ত (pick করা প্রশ্নেই)। মুছতেও পারে ওই সময়ের মধ্যে।
-- দেখে: নিজে, staff, কোর্সের শিক্ষক, আর যিনি ওই খাতাটা কাটছেন বা কেটেছেন।
-- Storage এর 'scripts' bucket এও একই নিয়মে policy (path এর প্রথম অংশ = user_id)
create policy script_pages_insert on script_pages for insert
  with check (public.can_upload_script_page(attempt_id, question_id));
create policy script_pages_delete on script_pages for delete
  using (exists (
    select 1 from public.exam_attempts a
     where a.id = attempt_id and a.user_id = auth.uid()
       and now() <= coalesce(a.upload_until, a.deadline_at)));
create policy script_pages_select on script_pages for select
  using (exists (
    select 1 from public.exam_attempts a join public.exams e on e.id = a.exam_id
     where a.id = attempt_id
       and (a.user_id = auth.uid() or public.is_staff() or public.teaches(e.course_id)))
     or exists (select 1 from public.script_marks m
                 where m.attempt_id = script_pages.attempt_id and m.question_id = script_pages.question_id
                   and m.marker_id = auth.uid()));

-- খাতার নম্বর: শিক্ষার্থী নিজেরটা ফল প্রকাশের পর; যিনি কেটেছেন; staff আর কোর্সের শিক্ষক।
-- লেখা হয় শুধু claim_script / save_script_mark / return_script_mark দিয়ে
create policy script_marks_select on script_marks for select
  using (marker_id = auth.uid() or public.is_staff()
         or exists (select 1 from public.exam_attempts a join public.exams e on e.id = a.exam_id
                     where a.id = attempt_id
                       and (public.teaches(e.course_id)
                            or (a.user_id = auth.uid() and e.results_published_at is not null))));

-- দ্বিতীয় যাচাই: যিনি করেছেন, staff আর কোর্সের শিক্ষক দেখেন। লেখে claim_script / save_script_mark /
-- resolve_moderation। প্রথম মূল্যায়নকারী দ্বিতীয় নম্বর দেখেন না (ফল প্রকাশের আগে প্রভাবিত না হতে)
create policy script_moderations_select on script_moderations for select
  using (moderator_id = auth.uid() or public.is_staff()
         or exists (select 1 from public.exam_questions q join public.exams e on e.id = q.exam_id
                     where q.id = question_id and public.teaches(e.course_id)));

-- পুনর্মূল্যায়নের আবেদন: নিজেরটা, staff আর কোর্সের শিক্ষক দেখেন।
-- লেখা হয় request_recheck / resolve_recheck দিয়ে
create policy recheck_select on recheck_requests for select
  using (user_id = auth.uid() or public.is_staff()
         or exists (select 1 from public.exam_attempts a join public.exams e on e.id = a.exam_id
                     where a.id = attempt_id and public.teaches(e.course_id)));

-- সংশোধন: staff আর কোর্সের শিক্ষক সব দেখেন। শিক্ষার্থী পরীক্ষা শেষ হলে প্রশ্নের সংশোধন
-- (কেন নম্বর বদলাল) আর নিজের খাতার নম্বর সংশোধন দেখে। পরীক্ষা চলার সময় নয়, যাতে উত্তর ফাঁস না হয়
create policy corrections_select on exam_corrections for select
  using (public.is_staff()
         or exists (select 1 from public.exams e where e.id = exam_id and public.teaches(e.course_id))
         or (attempt_id is null and public.exam_closed(exam_id)
             and exists (select 1 from public.exams e where e.id = exam_id and public.is_enrolled(e.course_id)))
         or exists (select 1 from public.exam_attempts a where a.id = attempt_id and a.user_id = auth.uid()));

-- নমুনায় অনুমতি: নিজেরটা, staff আর কোর্সের শিক্ষক
create policy calibration_approvals_select on calibration_approvals for select
  using (user_id = auth.uid() or public.is_staff()
         or exists (select 1 from public.exam_questions q join public.exams e on e.id = q.exam_id
                     where q.id = question_id and public.teaches(e.course_id)));

-- খাতার রেট: staff, শিক্ষক আর মূল্যায়নকারী দেখেন; বদলান শুধু admin (set_marking_rate)
create policy marking_rates_select on marking_rates for select
  using (coalesce(public.my_role() in ('admin', 'manager', 'teacher', 'evaluator'), false));

-- [Broadcast] লাইভ কমেন্ট: ক্লাস যারা দেখতে পারে, তারা সবার কমেন্ট দেখে আর নিজে লেখে।
-- মুছে ফেলা কমেন্ট শুধু শিক্ষক বা admin দেখেন। update/delete policy নেই, সেগুলো moderate_comment() দিয়ে
create policy live_comments_select on live_comments for select
  using (public.can_watch_live(session_id)
         and (deleted_at is null or public.can_host_live(session_id)));
create policy live_comments_insert on live_comments for insert
  with check (public.can_watch_live(session_id));

-- [Broadcast] উপস্থিতি: নিজেরটা, আর ক্লাসের শিক্ষক বা admin ও manager সবারটা দেখেন।
-- লেখা হয় শুধু live_heartbeat() দিয়ে। live_stream_keys এ কোনো policy নেই
create policy live_views_select on live_views for select
  using (user_id = auth.uid() or public.can_host_live(session_id) or public.is_staff());

-- [JaaS] উপস্থিতি JaaS webhook থেকে আসলে
-- create policy attendance_select on live_attendance for select
--   using (user_id = auth.uid() or public.is_staff()
--          or exists (select 1 from public.live_sessions s
--                     where s.id = session_id and public.teaches(s.course_id)));

-- প্রশ্নোত্তর দেখা:
--   পড়াশোনার প্রশ্ন: কোর্সে ভর্তি শিক্ষার্থী, কোর্সের শিক্ষক, admin ও manager সব দেখে
--   ভর্তির প্রশ্ন: উত্তর পাওয়াগুলো সবাই (লগইন ছাড়াও), উত্তর বাকিগুলো শুধু প্রশ্নকারী আর staff
create policy qa_questions_select on qa_questions for select
  using (case kind
           when 'study' then public.can_see_course_results(course_id)
           else (answered_at is not null or user_id = auth.uid() or public.is_staff())
                and exists (select 1 from public.courses c where c.id = course_id)
         end);
-- প্রশ্ন করা, নিজের নামে (answered_at নিজে বসানো যায় না):
--   পড়াশোনার প্রশ্ন শুধু কোর্সে ভর্তি শিক্ষার্থী; ভর্তির প্রশ্ন যেকোনো লগইন করা ইউজার, প্রকাশিত কোর্সে
create policy qa_questions_insert on qa_questions for insert
  with check (user_id = auth.uid() and answered_at is null
              and case kind
                    when 'study' then public.is_enrolled(course_id)
                    else exists (select 1 from public.courses c where c.id = course_id and c.is_published)
                  end);
-- উত্তর আসার আগে নিজের প্রশ্ন মোছা যায়; admin অনুচিত প্রশ্ন সরাতে পারেন। update policy নেই
create policy qa_questions_delete on qa_questions for delete
  using ((user_id = auth.uid() and answered_at is null) or public.my_role() = 'admin');

-- উত্তর: প্রশ্ন যে দেখে সে উত্তরও দেখে। লেখেন নিজের নামে: পড়াশোনার প্রশ্নে কোর্সের শিক্ষক
-- বা admin, ভর্তির প্রশ্নে manager বা admin (can_answer_qa)
create policy qa_answers_select on qa_answers for select
  using (exists (select 1 from public.qa_questions q where q.id = question_id));
create policy qa_answers_insert on qa_answers for insert
  with check (user_id = auth.uid() and public.can_answer_qa(question_id));
create policy qa_answers_delete on qa_answers for delete
  using (user_id = auth.uid() or public.my_role() = 'admin');

-- নোটিফিকেশন: নিজেরটা দেখা যায়। admin ও manager পাঠানো রিমাইন্ডারগুলোও দেখেন (কে কবে জানিয়েছে)।
-- লেখে trigger, remind_teacher() আর remind_manager(); পড়া চিহ্ন দেয় mark_notifications_read()
create policy notifications_select on notifications for select
  using (user_id = auth.uid() or (kind = 'qa_reminder' and public.is_staff()));

-- [Broadcast] Realtime: নতুন কমেন্ট আর লাইভ শুরু/শেষের খবর সাথে সাথে browser এ যায়।
-- Supabase Realtime RLS মেনে চলে, তাই প্রত্যেকে শুধু নিজের অনুমতির কমেন্টই পায়
alter publication supabase_realtime add table live_comments, live_sessions;

-- নোটিফিকেশনও সাথে সাথে যায়: শিক্ষার্থী উত্তর আসার খবর, শিক্ষক রিমাইন্ডার পান
alter publication supabase_realtime add table notifications;

-- ডিভাইস বদলের ইতিহাস: নিজেরটা, আর admin ও manager সবারটা
create policy device_logins_select on device_logins for select
  using (user_id = auth.uid() or public.is_staff());

-- একসাথে একটাই ডিভাইস: লগইন করা ব্যবহারকারীর প্রতিটি টেবিলে বাড়তি শর্ত (restrictive, অন্য policy র
-- সাথে AND হয়), এখনকার লগইন না হলে কিছুই পড়া বা লেখা যায় না। REST এ check_request আগেই আটকায়;
-- এটা Realtime আর সরাসরি টেবিল পড়ার জন্য। (select ...) এ মোড়ানো, তাই প্রতি query তে একবারই হিসাব হয়।
-- পরে নতুন টেবিল যোগ হলে তাতেও এই policy দিন। Storage (খাতার ছবি, লেকচার নোট) এও একই শর্ত
do $$
declare
  t text;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity order by c.relname loop
    execute format('create policy one_device on public.%I as restrictive for all to authenticated '
                   'using ((select public.session_ok())) with check ((select public.session_ok()))', t);
  end loop;
  if to_regclass('storage.objects') is not null then
    execute 'create policy one_device on storage.objects as restrictive for all to authenticated '
            'using ((select public.session_ok())) with check ((select public.session_ok()))';
    -- প্রশ্নের ছবির private bucket আর তার নিয়ম
    execute 'insert into storage.buckets (id, name, public) values (''question-images'', ''question-images'', false) '
            'on conflict (id) do nothing';
    execute 'create policy question_images_read on storage.objects for select to authenticated '
            'using (bucket_id = ''question-images'' and public.question_image_readable(name))';
    execute 'create policy question_images_insert on storage.objects for insert to authenticated '
            'with check (bucket_id = ''question-images'' and public.question_image_writable(name))';
    execute 'create policy question_images_update on storage.objects for update to authenticated '
            'using (bucket_id = ''question-images'' and public.question_image_writable(name))';
    execute 'create policy question_images_delete on storage.objects for delete to authenticated '
            'using (bucket_id = ''question-images'' and public.question_image_writable(name))';
  end if;
end $$;
