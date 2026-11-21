-- শিক্ষকের ড্যাশবোর্ডের (teacher_dashboard.html) জন্য:
--   ১. স্টাডি ম্যাটেরিয়ালের PDF এর private Storage bucket 'materials' আর তার নিয়ম
--   ২. my_qa_reminders: অ্যাডমিন বা ম্যানেজার উত্তর দিতে মনে করালে শিক্ষকের ঘণ্টায় কে বলেছেন আর কোন প্রশ্ন

-- ================= ১. ম্যাটেরিয়ালের PDF =================
-- path: <course_id>/<uuid>.pdf
-- লেখা (আপলোড, বদল, মোছা): কোর্সের শিক্ষক আর admin/manager (study_materials এর materials_write এর মতোই)
-- দেখা: কোর্সে ভর্তি শিক্ষার্থী, কোর্সের শিক্ষক আর staff (materials_select এর মতোই)
create function public.material_writable(p_path text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_path !~ '^[0-9]+/[0-9a-f-]{36}\.pdf$' then
    return false;
  end if;
  return coalesce(public.teaches(split_part(p_path, '/', 1)::bigint) or public.is_staff(), false);
end $$;

create function public.material_readable(p_path text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_path !~ '^[0-9]+/[0-9a-f-]{36}\.pdf$' then
    return false;
  end if;
  return coalesce(public.can_see_course_results(split_part(p_path, '/', 1)::bigint), false);
end $$;

do $$
begin
  if to_regclass('storage.objects') is not null then
    execute $q$insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
               values ('materials', 'materials', false, 52428800, array['application/pdf'])
               on conflict (id) do nothing$q$;
    execute 'create policy materials_read on storage.objects for select to authenticated '
            'using (bucket_id = ''materials'' and public.material_readable(name))';
    execute 'create policy materials_insert on storage.objects for insert to authenticated '
            'with check (bucket_id = ''materials'' and public.material_writable(name))';
    execute 'create policy materials_update on storage.objects for update to authenticated '
            'using (bucket_id = ''materials'' and public.material_writable(name))';
    execute 'create policy materials_delete on storage.objects for delete to authenticated '
            'using (bucket_id = ''materials'' and public.material_writable(name))';
  end if;
end $$;

-- ================= ২. উত্তর দিতে মনে করানো (শিক্ষকের জন্য) =================
-- নিজের রিমাইন্ডারগুলো (পড়া হয়নি আগে), কে বলেছেন (নাম আর ভূমিকা: শিক্ষক অন্যের profile পড়তে পারেন না, তাই এখানে),
-- কোন প্রশ্ন আর উত্তর হয়েছে কিনা। পড়া চিহ্ন দেয় mark_notifications_read()
create function public.my_qa_reminders()
returns table (id bigint, question_id bigint, note text, by_name text, by_role public.user_role, via_sms boolean,
               created_at timestamptz, read_at timestamptz, question text, answered boolean)
language sql stable security definer set search_path = '' as $$
  select n.id, n.question_id, n.body, p.full_name, p.role, n.via_sms, n.created_at, n.read_at, q.body, q.answered_at is not null
    from public.notifications n
    join public.qa_questions q on q.id = n.question_id
    left join public.profiles p on p.id = n.sent_by
   where n.user_id = auth.uid() and n.kind = 'qa_reminder'
   order by (n.read_at is null) desc, n.created_at desc
   limit 30
$$;
