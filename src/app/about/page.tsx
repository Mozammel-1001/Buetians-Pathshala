import type { Metadata } from "next";
import Image from "next/image";
import { getSiteContent } from "@/lib/content";

export const metadata: Metadata = { title: "আমাদের সম্পর্কে" };

// আমাদের সম্পর্কে: অ্যাডমিন প্যানেল → সাইটের লেখা → আমাদের সম্পর্কে
export default async function AboutPage() {
  const { about, contact } = await getSiteContent();
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 md:px-8">
      <h1 className="text-3xl font-bold md:text-5xl">{about.title}</h1>
      {about.intro && <p className="mt-5 text-lg leading-relaxed whitespace-pre-line muted">{about.intro}</p>}
      {about.image_url && (
        <div className="relative mt-8 aspect-[16/7] overflow-hidden rounded-3xl">
          <Image src={about.image_url} alt="" fill unoptimized sizes="(min-width: 1024px) 960px, 100vw" className="object-cover" />
        </div>
      )}
      {(about.mission || about.vision) && (
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {about.mission && <div className="card p-6"><h2 className="text-xl font-bold">আমাদের লক্ষ্য</h2><p className="mt-2 whitespace-pre-line muted">{about.mission}</p></div>}
          {about.vision && <div className="card p-6"><h2 className="text-xl font-bold">আমাদের রূপকল্প</h2><p className="mt-2 whitespace-pre-line muted">{about.vision}</p></div>}
        </div>
      )}
      {about.points.length > 0 && (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {about.points.map((p, i) => (
            <div key={i} className="card p-6"><h3 className="font-bold">{p.title}</h3>{p.text && <p className="mt-1 text-sm muted">{p.text}</p>}</div>
          ))}
        </div>
      )}
      {(contact.phone || contact.email || contact.address) && (
        <div className="card mt-10 space-y-2 p-6 text-sm">
          <h2 className="text-xl font-bold">যোগাযোগ</h2>
          {contact.phone && <p><span className="muted">ফোন:</span> <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="font-bold">{contact.phone}</a></p>}
          {contact.email && <p><span className="muted">ইমেইল:</span> <a href={`mailto:${contact.email}`} className="font-bold">{contact.email}</a></p>}
          {contact.address && <p className="whitespace-pre-line"><span className="muted">ঠিকানা:</span> {contact.address}</p>}
        </div>
      )}
    </main>
  );
}
