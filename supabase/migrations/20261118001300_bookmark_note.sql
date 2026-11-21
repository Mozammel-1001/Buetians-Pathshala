-- লেকচারের পাতা (online_class.html): বুকমার্ক সেভের সময় "একটি ঐচ্ছিক নোট যোগ করুন..." ঘর।
-- শিরোনাম যায় আগের tag এ (১২ অক্ষর), এই নোট এখানে। শিক্ষার্থী নিজেই লেখে (bookmarks_own policy আগে থেকেই আছে)
alter table public.bookmarks
  add column note text check (note is null or length(note) <= 500);
