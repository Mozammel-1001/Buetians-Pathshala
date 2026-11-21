"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { adminSearch, type Hit } from "../search-actions";
import { bn } from "@/lib/content-schema";

// অ্যাডমিন প্যানেলের পাশের মেনু (বড় পর্দায়), ছোট পর্দার চিপ আর উপরের খোঁজা-ঘড়ি: admin_dashboard.html এর NAV_ITEMS অনুযায়ী
export type NavEntry =
  | { group: string }
  | { href: string; icon: string; label: string; count?: number; live?: boolean };

const isItem = (e: NavEntry): e is Exclude<NavEntry, { group: string }> => "href" in e;
const useActive = () => {
  const path = usePathname();
  return (href: string) => (href === "/admin" || href === "/manager" ? path === href : path === href || path.startsWith(href + "/"));
};

function Extra({ item }: { item: Exclude<NavEntry, { group: string }> }) {
  if (item.count) return <span className="nav-count">{bn(item.count)}</span>;
  if (item.live) return <span className="ml-auto h-2.5 w-2.5 animate-pulse rounded-full bg-error" />;
  return null;
}

export function SideNav({ entries }: { entries: NavEntry[] }) {
  const active = useActive();
  return (
    <nav className="custom-scrollbar flex grow flex-col gap-1 overflow-y-auto pr-1 font-bold" aria-label="প্যানেল">
      {entries.map((e, i) =>
        isItem(e) ? (
          <Link key={e.href} href={e.href} aria-current={active(e.href) ? "page" : undefined} className="nav-link">
            <span className="icon">{e.icon}</span><span>{e.label}</span><Extra item={e} />
          </Link>
        ) : (
          <div key={i} className="px-4 pt-4 pb-1 text-[11px] font-bold text-outline dark:text-outline-variant">{e.group}</div>
        ),
      )}
    </nav>
  );
}

export function ChipNav({ entries }: { entries: NavEntry[] }) {
  const active = useActive();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  });
  return (
    <div className="no-scrollbar -mx-5 mb-3 overflow-x-auto px-5 md:mb-6 lg:hidden">
      <div ref={ref} className="flex w-max gap-2">
        {entries.filter(isItem).map((e) => (
          <Link key={e.href} href={e.href} aria-current={active(e.href) ? "page" : undefined} className="chip-link">
            <span className="icon text-[18px]">{e.icon}</span>{e.label}
            {e.count ? <span className="rounded-full bg-error px-1.5 text-[11px] text-white">{bn(e.count)}</span> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}

const DAYS = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
export function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const t = () => setNow(new Date());
    t();
    const id = setInterval(t, 20000);
    return () => clearInterval(id);
  }, []);
  if (!now) return <span className="inline-block h-4 w-32" />;
  const h = now.getHours();
  return <span suppressHydrationWarning>{DAYS[now.getDay()]}, {bn(String(h % 12 || 12).padStart(2, "0"))}:{bn(String(now.getMinutes()).padStart(2, "0"))} {h < 12 ? "এএম" : "পিএম"}</span>;
}

// উপরের খোঁজা (admin_dashboard.html এর gsearch): লেখার সাথে সাথে ইউজার, পেমেন্ট আর কোর্সের ফলাফল ড্রপডাউনে আসে।
// Enter চাপলে TrxID হলে পেমেন্টে, নইলে ইউজারে খোঁজে
const KIND = { user: { icon: "person", label: "ইউজার" }, payment: { icon: "receipt_long", label: "পেমেন্ট" }, course: { icon: "book", label: "কোর্স" } } as const;
export function GlobalSearch({ canUsers, root = "/admin" }: { canUsers: boolean; root?: "/admin" | "/manager" }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const box = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim().length < 2) { start(() => setHits(null)); return; }
      start(async () => {
        const all = await adminSearch(q);
        // ম্যানেজার প্যানেলে: ইউজারের খোঁজ এনরোলমেন্টে, পেমেন্ট নিজের প্যানেলে; কোর্সের পাতা নেই
        setHits(root === "/manager" ? all.filter((h) => h.kind !== "course").map((h) => ({ ...h, href: h.href.replace("/admin/users?q=", "/manager/enrollments?q=").replace("/admin/", "/manager/") })) : all);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [q, root]);
  useEffect(() => {
    const out = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", out);
    return () => document.removeEventListener("mousedown", out);
  }, []);
  const go = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    setOpen(false);
    const trx = /^[A-Za-z0-9]{8,12}$/.test(v) && /[A-Za-z]/.test(v) && /\d/.test(v);
    router.push(trx || !canUsers ? `${root}/payments?status=all&q=${encodeURIComponent(v)}` : `${root}/users?q=${encodeURIComponent(v)}`);
  };
  return (
    <form ref={box} onSubmit={go} role="search" className="relative w-full md:max-w-md">
      <span className="icon pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-on-surface-variant dark:text-surface-variant">{pending ? "progress_activity" : "search"}</span>
      <input name="q" type="search" autoComplete="off" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        placeholder="শিক্ষার্থী, ফোন, TrxID বা কোর্স খুঁজুন..." aria-label="খুঁজুন"
        className="w-full rounded-full border border-outline-variant/30 bg-surface-container-lowest py-2.5 pr-4 pl-12 text-sm focus:border-primary focus:outline-none dark:border-outline-variant/10 dark:bg-inverse-surface" />
      {open && hits && (
        <div className="view-in absolute top-full right-0 left-0 z-[70] mt-2 max-h-96 overflow-y-auto rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-2 shadow-2xl dark:bg-inverse-surface">
          {hits.length === 0 ? <p className="p-4 text-center text-sm muted">কিছু পাওয়া যায়নি</p> : (["user", "payment", "course"] as const).map((k) => {
            const list = hits.filter((h) => h.kind === k);
            if (!list.length) return null;
            return (
              <div key={k} className="mb-1">
                <div className="px-3 pt-2 pb-1 text-[11px] font-bold text-outline">{KIND[k].label}</div>
                {list.map((h) => (
                  <Link key={h.href + h.title} href={h.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-container-low dark:hover:bg-white/5">
                    <span className="icon text-[20px] text-primary dark:text-primary-fixed">{KIND[k].icon}</span>
                    <span className="min-w-0"><span className="block truncate text-sm font-bold">{h.title}</span><span className="block truncate text-xs muted">{h.sub}</span></span>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </form>
  );
}

// নোটিফিকেশন ঘণ্টা: এখন যা দেখা দরকার (যাচাই বাকি পেমেন্ট, উত্তর বাকি প্রশ্ন, লাইভ ক্লাস ...); কিছু থাকলে লাল বিন্দু
export type Alert = { icon: string; color: string; text: string; href: string };
export function Bell({ items }: { items: Alert[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const out = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", out);
    return () => document.removeEventListener("mousedown", out);
  }, []);
  return (
    <div ref={box} className="relative">
      <button type="button" className="icon-btn relative h-10! w-10! border border-outline-variant/30" aria-label="নোটিফিকেশন" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="icon">notifications</span>
        {items.length > 0 && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 animate-pulse rounded-full bg-error ring-2 ring-surface-container-lowest" />}
      </button>
      {open && (
        <div className="view-in absolute top-full right-0 z-[70] mt-2 w-80 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-2 shadow-2xl dark:bg-inverse-surface">
          <div className="px-3 pt-2 pb-1 text-sm font-bold">নোটিফিকেশন</div>
          {items.length === 0 ? <p className="p-4 text-center text-sm muted">নতুন কিছু নেই</p> : items.map((a) => (
            <Link key={a.href + a.text} href={a.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-container-low dark:hover:bg-white/5">
              <span className={`icon ${a.color}`}>{a.icon}</span><span className="grow text-sm font-bold">{a.text}</span><span className="icon text-[18px] muted">chevron_right</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
