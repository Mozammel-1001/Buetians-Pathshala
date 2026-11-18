import Link from "next/link";
import { getSiteContent } from "@/lib/content";

// নিচের বার: যোগাযোগ আর সামাজিক মাধ্যম, অ্যাডমিন প্যানেল → সাইটের লেখা → যোগাযোগ থেকে
export async function SiteFooter() {
  const { contact } = await getSiteContent();
  const social = [
    ["Facebook", contact.facebook],
    ["YouTube", contact.youtube],
  ].filter(([, u]) => u);
  const wa = contact.whatsapp.replace(/\D/g, "");
  return (
    <footer className="mt-20 border-t border-outline-variant/30 bg-surface-container-low/60 dark:bg-white/5">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm md:grid-cols-3 md:px-8">
        <div>
          <p className="text-lg font-bold text-primary dark:text-primary-fixed">বুয়েটিয়ান&apos;স পাঠশালা</p>
          {contact.footer_text && <p className="mt-2 whitespace-pre-line muted">{contact.footer_text}</p>}
        </div>
        <div className={`space-y-1.5 ${contact.phone || wa || contact.email || contact.address ? "" : "hidden"}`}>
          <p className="font-bold">যোগাযোগ</p>
          {contact.phone && <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2 muted hover:text-primary"><span className="icon text-[18px]">call</span>{contact.phone}</a>}
          {wa && <a href={`https://wa.me/${wa.startsWith("0") ? "88" + wa : wa}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 muted hover:text-primary"><span className="icon text-[18px]">chat</span>WhatsApp</a>}
          {contact.email && <a href={`mailto:${contact.email}`} className="flex items-center gap-2 muted hover:text-primary"><span className="icon text-[18px]">mail</span>{contact.email}</a>}
          {contact.address && <p className="flex gap-2 whitespace-pre-line muted"><span className="icon text-[18px]">location_on</span>{contact.address}</p>}
        </div>
        <div className="space-y-1.5">
          <p className="font-bold">আরও</p>
          <Link href="/#courses" className="block muted hover:text-primary">কোর্সসমূহ</Link>
          <Link href="/about" className="block muted hover:text-primary">আমাদের সম্পর্কে</Link>
          {social.map(([name, u]) => (
            <a key={name} href={u} target="_blank" rel="noopener noreferrer" className="block muted hover:text-primary">{name}</a>
          ))}
        </div>
      </div>
      <p className="border-t border-outline-variant/20 py-5 text-center text-xs muted">© {"২০২৬"} বুয়েটিয়ান&apos;স পাঠশালা</p>
    </footer>
  );
}
