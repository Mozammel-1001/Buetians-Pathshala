-- ভর্তি বিজ্ঞপ্তি (admission_circular.html): সাইটের "ভর্তি পরীক্ষার বিজ্ঞপ্তি" পাতায় সবাই দেখবে, যোগ/বদল/মোছা শুধু admin।
-- আগে টেবিলে RLS চালু ছিল কিন্তু কোনো policy ছিল না, তাই কেউ দেখতে পেত না।
-- প্রতিটি বদল audit_logs এ (কোর্সের মতো): admission_circulars.insert / update / delete

alter table public.admission_circulars
  add column updated_at timestamptz not null default now(),
  add constraint admission_circulars_url_https check (apply_url is null or apply_url ~ '^https?://'),
  add constraint admission_circulars_len check (length(institution) between 1 and 80 and length(title) between 3 and 200 and (body is null or length(body) <= 20000));

create policy circulars_select on public.admission_circulars for select using (true);
create policy circulars_insert on public.admission_circulars for insert with check (public.my_role() = 'admin');
create policy circulars_update on public.admission_circulars for update using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy circulars_delete on public.admission_circulars for delete using (public.my_role() = 'admin');

grant select on public.admission_circulars to anon, authenticated;
grant insert, update, delete on public.admission_circulars to authenticated;

create index admission_circulars_deadline on public.admission_circulars (deadline);

-- audit_content এখন site_content ছাড়া সব টেবিলে id ধরে (আগে courses ছাড়া সবখানে key ধরত)
create or replace function public.audit_content() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  changed text[];
  meta jsonb;
  entity_id text := coalesce(n, o)->>(case when tg_table_name = 'site_content' then 'key' else 'id' end);
begin
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into changed
      from jsonb_object_keys(n) k
     where k not in ('updated_at', 'updated_by') and n->k is distinct from o->k;
    if changed is null then return null; end if;
    meta := jsonb_build_object('fields', to_jsonb(changed), 'title', n->>'title');
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

create trigger admission_circulars_audit after insert or update or delete on public.admission_circulars
  for each row execute function public.audit_content();
