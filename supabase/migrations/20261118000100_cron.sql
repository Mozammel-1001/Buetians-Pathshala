-- প্রতি মিনিটের কাজ (pg_cron, Supabase এর free plan এও আছে):
--   সময় পেরোনো পরীক্ষা নিজে জমা, আর পরীক্ষা শেষ হলে মেধাক্রম একবার হিসাব
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('expire-exam-attempts', '* * * * *', 'select public.expire_attempts()');
select cron.schedule('refresh-exam-ranks', '* * * * *', 'select public.refresh_due_ranks()');
