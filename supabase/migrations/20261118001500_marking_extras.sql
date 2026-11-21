-- খাতা মূল্যায়নকারীর পাতার (evaluator_dashboard.html) জন্য বাকি অংশ:
--   ১. খাতার ছবির private Storage bucket 'scripts' আর তার নিয়ম (init এ শুধু কথা ছিল, bucket বা policy ছিল না)
--   ২. claim_script এ "এড়িয়ে যান" (p_skip), release_script (হাতে নেওয়া খাতা ছেড়ে দেওয়া)
--   ৩. marking_free: এই প্রশ্নে আমি এখন কতগুলো খাতা পেতে পারি
--   ৪. marked_scripts: কাটা খাতার তালিকা (মূল্যায়নকারী নিজেরটা, শিক্ষক/admin সব)
--   ৫. my_returned_scripts: আমার কাটা যে খাতা ফেরত এসেছে
--   ৬. calibration_detail, calibration_ref_list: নমুনা খাতার তালিকা ও কারো নমুনার ফল (শিক্ষক/admin)
--   ৭. marking_settings: পরীক্ষার যাচাইয়ের নিয়ম (পার্থক্যসীমা, দ্বিতীয় যাচাইয়ের %, আবেদনের দিন, কোন সেকশনে কয়টি)

-- ================= ১. খাতার ছবি =================
-- path: <user_id>/<attempt_id>/<question_id>-<page>.jpg
-- দেখা: নিজের খাতা, staff, কোর্সের শিক্ষক, যিনি ওই খাতা কাটছেন বা কেটেছেন বা দ্বিতীয় যাচাই করছেন,
-- আর নমুনা খাতা (যিনি কাটার অনুমতি পান)
create function public.script_page_readable(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.script_pages sp
      join public.exam_attempts a on a.id = sp.attempt_id
      join public.exams e on e.id = a.exam_id
     where sp.storage_path = p_path
       and (a.user_id = auth.uid() or public.is_staff() or public.teaches(e.course_id)
            or exists (select 1 from public.script_marks m
                        where m.attempt_id = sp.attempt_id and m.question_id = sp.question_id and m.marker_id = auth.uid())
            or exists (select 1 from public.script_moderations s
                        where s.attempt_id = sp.attempt_id and s.question_id = sp.question_id and s.moderator_id = auth.uid())
            or (public.can_mark_exam(e.id)
                and exists (select 1 from public.calibration_refs cr
                             where cr.attempt_id = sp.attempt_id and cr.question_id = sp.question_id))))
$$;

-- আপলোড বা মোছা: শুধু নিজের খাতার path, জমার সময় পর্যন্ত, আর বাছাই করা প্রশ্নে (can_upload_script_page এর মতোই)
create function public.script_upload_open(p_path text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_path !~ '^[0-9a-f-]{36}/[0-9]+/[0-9]+-[0-9]+\.[a-z]+$'
     or split_part(p_path, '/', 1) <> auth.uid()::text then
    return false;
  end if;
  return exists (
    select 1 from public.exam_attempts a
     where a.id = split_part(p_path, '/', 2)::bigint and a.user_id = auth.uid()
       and now() <= coalesce(a.upload_until, a.deadline_at)
       and (a.picked is null or split_part(split_part(p_path, '/', 3), '-', 1)::bigint = any (a.picked)));
end $$;

do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'insert into storage.buckets (id, name, public) values (''scripts'', ''scripts'', false) '
            'on conflict (id) do nothing';
    execute 'create policy scripts_read on storage.objects for select to authenticated '
            'using (bucket_id = ''scripts'' and public.script_page_readable(name))';
    execute 'create policy scripts_insert on storage.objects for insert to authenticated '
            'with check (bucket_id = ''scripts'' and public.script_upload_open(name))';
    execute 'create policy scripts_delete on storage.objects for delete to authenticated '
            'using (bucket_id = ''scripts'' and public.script_upload_open(name))';
  end if;
end $$;

-- ================= ২. হাতে নেওয়া খাতা ছেড়ে দেওয়া =================
-- "এড়িয়ে যান" বা পাতা ছাড়ার সময়। ফেরত আসা খাতা হলে আবার ফেরত অবস্থায়, নইলে কাটা হয়নি অবস্থায়;
-- দ্বিতীয় যাচাইয়ের দাবি ছেড়ে দিলে আবার অন্য কেউ পাবেন। নমুনা খাতায় কিছু ধরা থাকে না
create function public.release_script(p_attempt_id bigint, p_question_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'লগইন করুন' using errcode = '42501';
  end if;
  delete from public.script_marks
   where attempt_id = p_attempt_id and question_id = p_question_id
     and status = 'claimed' and marker_id = auth.uid() and return_reason is null;
  update public.script_marks set status = 'returned', claimed_at = null
   where attempt_id = p_attempt_id and question_id = p_question_id
     and status = 'claimed' and marker_id = auth.uid() and return_reason is not null;
  delete from public.script_moderations
   where attempt_id = p_attempt_id and question_id = p_question_id
     and moderator_id = auth.uid() and marked_at is null;
end $$;

-- ================= ৩. এই প্রশ্নে এখন কতগুলো খাতা পাওয়া যাবে =================
-- claim_script যা দিতে পারত তার গণনা (নতুন, ফেরত, নিজের হাতে থাকা, দ্বিতীয় যাচাইয়ের), নমুনা বাদে
create function public.marking_free(p_exam_id bigint)
returns table (question_id bigint, free bigint)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.can_mark_exam(p_exam_id) then
    raise exception 'এই পরীক্ষার খাতা কাটার অনুমতি নেই' using errcode = '42501';
  end if;
  return query
    select q.id,
           (select count(*) from public.exam_attempts a
              left join public.script_marks m on m.attempt_id = a.id and m.question_id = q.id
             where a.exam_id = p_exam_id and a.status <> 'in_progress'
               and (a.upload_until is null or a.upload_until < now())
               and exists (select 1 from public.script_pages sp where sp.attempt_id = a.id and sp.question_id = q.id)
               and (m.attempt_id is null or m.status = 'returned'
                    or (m.status = 'claimed' and (m.marker_id = auth.uid() or m.claimed_at < now() - interval '20 minutes'))))
           + (select count(*) from public.script_marks m
                left join public.script_moderations s on s.attempt_id = m.attempt_id and s.question_id = m.question_id
               where m.question_id = q.id and m.status = 'marked' and m.moderation = 'pending'
                 and m.marker_id is distinct from auth.uid()
                 and (s.attempt_id is null
                      or (s.marked_at is null and (s.moderator_id = auth.uid() or s.claimed_at < now() - interval '20 minutes'))))
      from public.exam_questions q
     where q.exam_id = p_exam_id and q.kind = 'written'
     order by q.position, q.id;
end $$;

-- ================= ৪. কাটা খাতার তালিকা =================
-- মূল্যায়নকারী শুধু নিজের কাটাগুলো (আর দ্বিতীয় যাচাইয়ের অবস্থা শুধু "বাকি" হলে); শিক্ষক ও admin সবগুলো,
-- দ্বিতীয় নম্বর আর কে কেটেছেন সহ। শিক্ষার্থীর নাম নয়, খাতার কোড
create function public.marked_scripts(p_exam_id bigint, p_question_id bigint)
returns table (attempt_id bigint, script_code text, marks numeric, note text, marked_at timestamptz,
               marker_id uuid, marker text, moderation public.moderation_status,
               second_marks numeric, second_marker text, first_marks numeric,
               is_ref boolean, pages text[], annotations jsonb)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_manage boolean := public.can_manage_exam(p_exam_id);
begin
  if not public.can_mark_exam(p_exam_id) then
    raise exception 'এই পরীক্ষার খাতা কাটার অনুমতি নেই' using errcode = '42501';
  end if;
  if not exists (select 1 from public.exam_questions q where q.id = p_question_id and q.exam_id = p_exam_id and q.kind = 'written') then
    raise exception 'প্রশ্ন পাওয়া যায়নি';
  end if;
  return query
    select m.attempt_id, a.script_code, m.marks, m.note, m.marked_at, m.marker_id, p1.full_name,
           case when v_manage or m.moderation = 'pending' then m.moderation end,
           case when v_manage then s.marks end, case when v_manage then p2.full_name end,
           case when v_manage then coalesce(s.first_marks, m.marks) end,
           exists (select 1 from public.calibration_refs cr where cr.question_id = m.question_id and cr.attempt_id = m.attempt_id),
           array(select sp.storage_path from public.script_pages sp
                  where sp.attempt_id = m.attempt_id and sp.question_id = m.question_id order by sp.page_no),
           m.annotations
      from public.script_marks m
      join public.exam_attempts a on a.id = m.attempt_id
      left join public.script_moderations s on s.attempt_id = m.attempt_id and s.question_id = m.question_id and s.marked_at is not null
      left join public.profiles p1 on p1.id = m.marker_id
      left join public.profiles p2 on p2.id = s.moderator_id
     where m.question_id = p_question_id and a.exam_id = p_exam_id and m.status = 'marked'
       and (v_manage or m.marker_id = auth.uid())
     order by m.marked_at desc;
end $$;

-- ================= ৫. আমার ফেরত আসা খাতা =================
create function public.my_returned_scripts()
returns table (exam_id bigint, exam text, question_id bigint, question_no int, section text, script_code text,
               marks numeric, return_reason text, returned_by text)
language sql stable security definer set search_path = '' as $$
  select e.id, e.title, q.id,
         (select count(*) from public.exam_questions q2
           where q2.exam_id = q.exam_id and q2.kind = 'written' and (q2.position, q2.id) <= (q.position, q.id))::int,
         q.section, a.script_code, m.marks, m.return_reason, p.full_name
    from public.script_marks m
    join public.exam_questions q on q.id = m.question_id
    join public.exams e on e.id = q.exam_id
    join public.exam_attempts a on a.id = m.attempt_id
    left join public.profiles p on p.id = m.returned_by
   where m.marker_id = auth.uid() and m.status = 'returned' and e.results_published_at is null
   order by e.closes_at desc, a.submitted_at
$$;

-- ================= ৬. নমুনা খাতা: শিক্ষক ও admin এর জন্য =================
create function public.calibration_ref_list(p_exam_id bigint)
returns table (question_id bigint, question_no int, attempt_id bigint, script_code text, ref_marks numeric)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.can_manage_exam(p_exam_id) then
    raise exception 'অনুমতি নেই' using errcode = '42501';
  end if;
  return query
    select q.id, q.no, cr.attempt_id, a.script_code, cr.ref_marks
      from (select x.id, (row_number() over (order by x.position, x.id))::int as no
              from public.exam_questions x where x.exam_id = p_exam_id and x.kind = 'written') q
      join public.calibration_refs cr on cr.question_id = q.id
      join public.exam_attempts a on a.id = cr.attempt_id
     order by q.no, cr.created_at;
end $$;

-- একজন মূল্যায়নকারীর নমুনার ফল (তাঁর নম্বর বনাম শিক্ষকের নম্বর), "দেখে অনুমতি দিন" এর আগে দেখতে
create function public.calibration_detail(p_user_id uuid, p_question_id bigint)
returns table (script_code text, marks numeric, teacher_marks numeric, within boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  q public.exam_questions;
begin
  select * into q from public.exam_questions where id = p_question_id;
  if q.id is null or not public.can_manage_exam(q.exam_id) then
    raise exception 'অনুমতি নেই' using errcode = '42501';
  end if;
  return query
    select a.script_code, cm.marks, cr.ref_marks, cm.within
      from public.calibration_marks cm
      join public.calibration_refs cr on cr.question_id = cm.question_id and cr.attempt_id = cm.attempt_id
      join public.exam_attempts a on a.id = cm.attempt_id
     where cm.user_id = p_user_id and cm.question_id = p_question_id
     order by cm.created_at;
end $$;

-- ================= ৭. পরীক্ষার নিয়ম (মূল্যায়নকারীর পাতায় দেখানোর জন্য) =================
-- exams টেবিল মূল্যায়নকারী সরাসরি পড়তে পারেন না, তাই এই নিয়মগুলো আলাদা function এ
create function public.marking_settings(p_exam_id bigint)
returns table (tolerance numeric, moderation_percent int, recheck_days int, pick jsonb, kind public.exam_kind)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.can_mark_exam(p_exam_id) or public.is_staff()) then
    raise exception 'অনুমতি নেই' using errcode = '42501';
  end if;
  return query
    select e.moderation_tolerance, e.moderation_percent, e.recheck_days, e.pick_rules, e.kind
      from public.exams e where e.id = p_exam_id;
end $$;

-- ================= ৮. claim_script: এড়িয়ে যাওয়া খাতা বাদ দিয়ে =================
-- আগের claim_script (দুই আর্গুমেন্টের) বদলে p_skip যোগ। আগের মতো দুই আর্গুমেন্টে ডাকলেও চলে
drop function public.claim_script(bigint, bigint);

create function public.claim_script(p_exam_id bigint, p_question_id bigint, p_skip bigint[] default '{}')
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
     where a.exam_id = p_exam_id and m.status = 'returned' and a.id <> all (p_skip)
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
       and m.marker_id is distinct from auth.uid() and m.attempt_id <> all (p_skip)
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
     where a.exam_id = p_exam_id and a.status <> 'in_progress' and a.id <> all (p_skip)
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
