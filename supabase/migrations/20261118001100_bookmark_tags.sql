-- বুকমার্ক পাতা (bookmarks.html): প্রতিটি বুকমার্কে ছোট একটা ট্যাগ (যেমন "গ", "JS"), যেটা দিয়ে খোঁজা আর
-- "সাম্প্রতিক ট্যাগ" এ ছাঁকা যায়। শিক্ষার্থী নিজেই বদলায় (bookmarks_own policy আগে থেকেই আছে)
alter table public.bookmarks
  add column tag text check (tag is null or length(btrim(tag)) between 1 and 12);
