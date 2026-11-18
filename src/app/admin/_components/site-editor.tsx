"use client";

import { useActionState, useState, type ReactNode } from "react";
import { ACCOUNT_TYPES, type SectionKey, type SiteContent } from "@/lib/content-schema";
import { saveSection } from "../actions";
import { ListEditor, MediaInput, SaveBar, Text, useDirty, useUnsavedWarning } from "./fields";

// সাইটের লেখা: প্রতিটি অংশ আলাদা ফর্ম, আলাদা সেভ। সেভ করলেই হোমপেজ/ফুটার/আমাদের সম্পর্কে নতুন হয়
export function SiteEditor({ content }: { content: SiteContent }) {
  return (
    <div className="space-y-6">
      <Section k="payment" title="ভর্তির পেমেন্ট (bKash)" icon="account_balance_wallet" initial={content.payment}>
        {(v, set) => (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Text label="bKash নম্বর" value={v.bkash_number} onChange={(x) => set({ bkash_number: x })} inputMode="tel" placeholder="01XXXXXXXXX"
                hint="ভর্তির modal এ কপির বোতামসহ দেখায়। ফাঁকা থাকলে ভর্তির আবেদন নেওয়া হয় না।" />
              <div>
                <label className="label" htmlFor="pay-type">অ্যাকাউন্টের ধরন</label>
                <select id="pay-type" className="field" value={v.account_type} onChange={(e) => set({ account_type: e.target.value as typeof v.account_type })}>
                  {Object.entries(ACCOUNT_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <p className="mt-1 text-xs muted">পার্সোনাল হলে শিক্ষার্থীকে &quot;Send Money&quot;, এজেন্ট হলে &quot;Cash Out&quot;, মার্চেন্ট হলে &quot;Payment&quot; করতে বলা হয়।</p>
              </div>
            </div>
            <Text label="নির্দেশনা" value={v.note} onChange={(x) => set({ note: x })} multiline rows={2} placeholder="Reference এ আপনার আইডি লিখুন।" />
            <Text label="কতক্ষণে যাচাই হয়" value={v.review_time} onChange={(x) => set({ review_time: x })} placeholder="সাধারণত ১২ ঘণ্টার মধ্যে যাচাই হয়।" />
          </>
        )}
      </Section>

      <Section k="hero" title="হোমপেজের উপরের অংশ (hero)" icon="web_asset" initial={content.hero}>
        {(v, set) => (
          <>
            <MediaInput label="hero এর ছবি" value={v.image_url} onChange={(x) => set({ image_url: x })} folder="hero" maxSide={1920} aspect="aspect-[4/3]"
              hint="৪:৩ মাপের ছবি ভালো দেখায়। না দিলে শুধু লেখা থাকে, পুরো চওড়ায়।" />
            <Text label="উপরের ছোট লেখা (badge)" value={v.badge} onChange={(x) => set({ badge: x })} placeholder="নতুন কোর্স উপলব্ধ" />
            <div className="grid gap-4 md:grid-cols-2">
              <Text label="শিরোনাম" value={v.title} onChange={(x) => set({ title: x })} />
              <Text label="শিরোনামের রঙিন অংশ" value={v.highlight} onChange={(x) => set({ highlight: x })} hint="শিরোনামের পরে সবুজ রঙে" />
            </div>
            <Text label="নিচের লেখা" value={v.subtitle} onChange={(x) => set({ subtitle: x })} multiline rows={3} />
            <div className="grid gap-4 md:grid-cols-2">
              <Text label="প্রধান বোতামের লেখা" value={v.primary_label} onChange={(x) => set({ primary_label: x })} />
              <Text label="প্রধান বোতামের লিংক" value={v.primary_href} onChange={(x) => set({ primary_href: x })} hint="যেমন #courses, /courses/hsc-27-math বা https://…" />
              <Text label="দ্বিতীয় বোতামের লেখা" value={v.secondary_label} onChange={(x) => set({ secondary_label: x })} hint="ফাঁকা রাখলে বোতাম থাকে না" />
              <Text label="দ্বিতীয় বোতামের লিংক" value={v.secondary_href} onChange={(x) => set({ secondary_href: x })} />
            </div>
          </>
        )}
      </Section>

      <Section k="features" title="কেন আমরা" icon="star" initial={content.features}>
        {(v, set) => (
          <>
            <Text label="অংশের শিরোনাম" value={v.title} onChange={(x) => set({ title: x })} />
            <ListEditor items={v.items} onChange={(items) => set({ items })} blank={{ icon: "check_circle", title: "", text: "" }} addLabel="আরেকটা যোগ করুন" max={12}
              fields={[{ key: "icon", label: "আইকন", icon: true, placeholder: "আইকনের নাম, যেমন videocam" }, { key: "title", label: "শিরোনাম" }, { key: "text", label: "লেখা", multiline: true }]}
              emptyText="কিছু না থাকলে অংশটা হোমপেজে দেখায় না।" />
            <p className="text-xs muted">
              আইকনের নাম <a href="https://fonts.google.com/icons" target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline dark:text-primary-fixed">Google Material Symbols</a> থেকে
              (ছোট হাতের ইংরেজি, যেমন videocam, quiz, school, monitoring)।
            </p>
          </>
        )}
      </Section>

      <Section k="branches" title="ব্রাঞ্চ" icon="location_on" initial={content.branches}>
        {(v, set) => (
          <>
            <Text label="অংশের শিরোনাম" value={v.title} onChange={(x) => set({ title: x })} />
            <ListEditor items={v.items} onChange={(items) => set({ items })} blank={{ name: "", address: "", phone: "", map_url: "" }} addLabel="ব্রাঞ্চ যোগ করুন" max={24}
              fields={[{ key: "name", label: "নাম" }, { key: "phone", label: "ফোন" }, { key: "address", label: "ঠিকানা", multiline: true }, { key: "map_url", label: "Google Maps লিংক (https://…)", wide: true }]}
              emptyText="কিছু না থাকলে অংশটা হোমপেজে দেখায় না।" />
          </>
        )}
      </Section>

      <Section k="cta" title="হোমপেজের শেষের আহ্বান" icon="campaign" initial={content.cta}>
        {(v, set) => (
          <>
            <Text label="শিরোনাম" value={v.title} onChange={(x) => set({ title: x })} hint="ফাঁকা রাখলে অংশটা দেখায় না" />
            <Text label="লেখা" value={v.text} onChange={(x) => set({ text: x })} multiline rows={2} />
            <div className="grid gap-4 md:grid-cols-2">
              <Text label="বোতামের লেখা" value={v.button_label} onChange={(x) => set({ button_label: x })} />
              <Text label="বোতামের লিংক" value={v.button_href} onChange={(x) => set({ button_href: x })} placeholder="/sign-in" />
            </div>
          </>
        )}
      </Section>

      <Section k="contact" title="যোগাযোগ আর ফুটার" icon="call" initial={content.contact}>
        {(v, set) => (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Text label="ফোন" value={v.phone} onChange={(x) => set({ phone: x })} inputMode="tel" />
              <Text label="WhatsApp নম্বর" value={v.whatsapp} onChange={(x) => set({ whatsapp: x })} inputMode="tel" placeholder="01XXXXXXXXX" />
              <Text label="ইমেইল" value={v.email} onChange={(x) => set({ email: x })} inputMode="email" />
              <Text label="Facebook পাতা" value={v.facebook} onChange={(x) => set({ facebook: x })} placeholder="https://facebook.com/…" />
              <Text label="YouTube চ্যানেল" value={v.youtube} onChange={(x) => set({ youtube: x })} placeholder="https://youtube.com/@…" />
            </div>
            <Text label="ঠিকানা" value={v.address} onChange={(x) => set({ address: x })} multiline rows={2} />
            <Text label="ফুটারের লেখা" value={v.footer_text} onChange={(x) => set({ footer_text: x })} multiline rows={2} />
          </>
        )}
      </Section>

      <Section k="about" title="আমাদের সম্পর্কে" icon="info" initial={content.about}>
        {(v, set) => (
          <>
            <Text label="শিরোনাম" value={v.title} onChange={(x) => set({ title: x })} />
            <Text label="পরিচিতি" value={v.intro} onChange={(x) => set({ intro: x })} multiline rows={5} />
            <MediaInput label="ছবি (ঐচ্ছিক)" value={v.image_url} onChange={(x) => set({ image_url: x })} folder="about" maxSide={1920} aspect="aspect-[16/7]" />
            <div className="grid gap-4 md:grid-cols-2">
              <Text label="আমাদের লক্ষ্য" value={v.mission} onChange={(x) => set({ mission: x })} multiline rows={3} />
              <Text label="আমাদের রূপকল্প" value={v.vision} onChange={(x) => set({ vision: x })} multiline rows={3} />
            </div>
            <ListEditor items={v.points} onChange={(points) => set({ points })} blank={{ title: "", text: "" }} addLabel="বিশেষত্ব যোগ করুন" max={12}
              fields={[{ key: "title", label: "শিরোনাম", wide: true }, { key: "text", label: "লেখা", multiline: true }]} />
          </>
        )}
      </Section>
    </div>
  );
}

function Section<K extends SectionKey>({ k, title, icon, initial, children }: {
  k: K; title: string; icon: string; initial: SiteContent[K];
  children: (v: SiteContent[K], set: (patch: Partial<SiteContent[K]>) => void) => ReactNode;
}) {
  const [value, setValue] = useState(initial);
  const [state, action, pending] = useActionState(saveSection, undefined);
  const json = JSON.stringify(value);
  const { dirty, markSubmitted } = useDirty(json, state?.savedAt);
  useUnsavedWarning(dirty && !pending);

  return (
    <form id={k} action={action} onSubmit={markSubmitted} className="card scroll-mt-24 space-y-4 p-5 md:p-6" noValidate>
      <input type="hidden" name="key" value={k} />
      <input type="hidden" name="payload" value={json} />
      <h2 className="flex items-center gap-2 text-lg font-bold"><span className="icon text-primary dark:text-primary-fixed">{icon}</span>{title}</h2>
      {children(value, (patch) => setValue((v) => ({ ...v, ...patch })))}
      <div className="border-t border-outline-variant/30 pt-4">
        <SaveBar pending={pending} dirty={dirty} savedAt={state?.savedAt} error={state?.error} />
      </div>
    </form>
  );
}
