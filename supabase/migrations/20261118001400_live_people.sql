-- লাইভ ক্লাসের পাতা (live_class.html): কমেন্টের পাশে লেখকের নাম আর ব্যাজ (শিক্ষক / অ্যাডমিন)।
-- শিক্ষার্থী RLS এ অন্যের profile দেখে না, তাই এই function: ক্লাস যে দেখতে পারে সে শুধু
-- এই ক্লাসে কমেন্ট করা মানুষ আর ক্লাসের শিক্ষকের নাম আর ভূমিকা পায় (ফোন নম্বর বা অন্য কিছু না)
create function public.live_people(p_session_id uuid)
returns table (id uuid, full_name text, role public.user_role)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_watch_live(p_session_id) then
    raise exception 'এই ক্লাস দেখার অনুমতি নেই';
  end if;
  return query
    select p.id, p.full_name, p.role
      from public.profiles p
     where p.id in (select c.user_id from public.live_comments c where c.session_id = p_session_id
                    union
                    select s.teacher_id from public.live_sessions s where s.id = p_session_id);
end $$;

revoke execute on function public.live_people(uuid) from public, anon;
grant execute on function public.live_people(uuid) to authenticated;
