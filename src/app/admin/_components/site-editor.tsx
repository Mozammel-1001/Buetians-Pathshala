"use client";

import { useActionState, useState, type ReactNode } from "react";
import { ACCOUNT_TYPES, FEATURE_VARIANTS, TONE_LABELS, type AboutStat, type AboutWhy, type Feature, type SectionKey, type SiteContent } from "@/lib/content-schema";
import { saveSection } from "../actions";
// প্ল্যাটফর্ম অংশ ফেরালে MediaInput আবার import করতে হবে (নিচের comment করা অংশে লাগে)
import { ListEditor, SaveBar, Text, useDirty, useUnsavedWarning } from "./fields";

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
            <Text label="উপরের ছোট লেখা (badge)" value={v.badge} onChange={(x) => set({ badge: x })} placeholder="নতুন কোর্স উপলব্ধ" hint="পাশে সবুজ বিন্দু জ্বলে-নেভে" />
            <div className="grid gap-4 md:grid-cols-2">
              <Text label="শিরোনামের প্রথম অংশ (সবুজ)" value={v.title} onChange={(x) => set({ title: x })} />
              <Text label="শিরোনামের বাকি অংশ" value={v.highlight} onChange={(x) => set({ highlight: x })} multiline rows={2} hint="নতুন লাইন দিলে সাইটেও নতুন লাইনে" />
            </div>
            <Text label="নিচের লেখা" value={v.subtitle} onChange={(x) => set({ subtitle: x })} multiline rows={3} />
            <div className="grid gap-4 md:grid-cols-2">
              <Text label="প্রধান বোতামের লেখা" value={v.primary_label} onChange={(x) => set({ primary_label: x })} />
              <Text label="প্রধান বোতামের লিংক" value={v.primary_href} onChange={(x) => set({ primary_href: x })} hint="যেমন /sign-up, /courses/hsc-27-math বা https://…" />
              {/* বোতাম বন্ধ: <Text label="দ্বিতীয় বোতামের লেখা (▶ আইকনসহ)" value={v.secondary_label} onChange={(x) => set({ secondary_label: x })} hint="ফাঁকা রাখলে বোতাম থাকে না" /> */}
              {/* বোতাম বন্ধ: <Text label="দ্বিতীয় বোতামের লিংক" value={v.secondary_href} onChange={(x) => set({ secondary_href: x })} hint="যেমন ডেমো ক্লাসের YouTube লিংক" /> */}
            </div>
            <div>
              <p className="label">ডানের ছবিগুলো (slider, ৩ সেকেন্ড পরপর বদলায়)</p>
              <ListEditor items={v.images.map((src) => ({ src }))} onChange={(items) => set({ images: items.map((x) => x.src).filter(Boolean) })}
                blank={{ src: "" }} addLabel="ছবি যোগ করুন" max={8} emptyText="এখনো কোনো ছবি নেই। ছবি না থাকলে হোমপেজে শুধু লেখা থাকে, মাঝখানে। প্রথম ছবি দিতে নিচের বোতাম চাপুন।"
                fields={[{ key: "src", label: "ছবি", image: { folder: "hero", aspect: "aspect-[3/4]" } }]} />
              <p className="mt-1 text-xs muted">লম্বালম্বি (৩:৪) ছবি ভালো দেখায়। উপরে-নিচে তীর দিয়ে ক্রম বদলান।</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Text label="ছবির কোণের কার্ড: ছোট লেখা" value={v.card_kicker} onChange={(x) => set({ card_kicker: x })} placeholder="Success Story" />
              <Text label="ছবির কোণের কার্ড: বড় লেখা" value={v.card_title} onChange={(x) => set({ card_title: x })} placeholder="Qualified Candidates" hint="দুটোই ফাঁকা রাখলে কার্ড থাকে না" />
            </div>
          </>
        )}
      </Section>

      <Section k="stats" title="পরিসংখ্যান (hero এর নিচে)" icon="monitoring" initial={content.stats}>
        {(v, set) => (
          <ListEditor items={v.items} onChange={(items) => set({ items })} blank={{ value: "", suffix: "+", label: "" }} addLabel="আরেকটা যোগ করুন" max={6}
            fields={[{ key: "value", label: "সংখ্যা", placeholder: "যেমন 3035" }, { key: "suffix", label: "পাশের চিহ্ন", placeholder: "+ বা %" }, { key: "label", label: "লেখা", placeholder: "শিক্ষার্থী", wide: true }]}
            emptyText="কিছু না থাকলে অংশটা দেখায় না। সংখ্যাগুলো দেখার সময় ০ থেকে গুনে ওঠে।" />
        )}
      </Section>

      <Section k="courses" title="কোর্স অংশের শিরোনাম" icon="school" initial={content.courses}>
        {(v, set) => (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Text label="শিরোনাম" value={v.title} onChange={(x) => set({ title: x })} />
              <Text label="শিরোনামের সবুজ অংশ" value={v.highlight} onChange={(x) => set({ highlight: x })} />
            </div>
            <Text label="নিচের লেখা" value={v.subtitle} onChange={(x) => set({ subtitle: x })} multiline rows={2} />
            <div className="grid gap-4 md:grid-cols-2">
              <Text label="প্রথম ফিল্টার বোতাম" value={v.all_label} onChange={(x) => set({ all_label: x })} hint="বাকি বোতাম আসে কোর্সের ক্যাটাগরি থেকে" />
              <Text label="নিচের লাল বোতাম" value={v.button_label} onChange={(x) => set({ button_label: x })} hint="সব কোর্সের পাতায় নেয়; ফাঁকা রাখলে থাকে না" />
            </div>
            <p className="pt-2 text-sm font-bold">সব কোর্সের পাতা (/courses)</p>
            <div className="grid gap-4 md:grid-cols-2">
              <Text label="শিরোনাম" value={v.page_title} onChange={(x) => set({ page_title: x })} />
              <Text label="শিরোনামের সবুজ অংশ" value={v.page_highlight} onChange={(x) => set({ page_highlight: x })} />
            </div>
            <Text label="নিচের লেখা" value={v.page_subtitle} onChange={(x) => set({ page_subtitle: x })} multiline rows={2} />
          </>
        )}
      </Section>

      <Section k="features" title="কেন আমরা (bento কার্ড)" icon="star" initial={content.features}>
        {(v, set) => (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Text label="শিরোনাম" value={v.title} onChange={(x) => set({ title: x })} />
              <Text label="শিরোনামের সবুজ অংশ" value={v.highlight} onChange={(x) => set({ highlight: x })} />
            </div>
            <ListEditor<Feature> items={v.items} onChange={(items) => set({ items })} addLabel="কার্ড যোগ করুন" max={12}
              blank={{ variant: "plain", icon: "", title: "", text: "", points: "", image_url: "" }}
              fields={[
                { key: "variant", label: "ধরন", options: FEATURE_VARIANTS },
                { key: "title", label: "শিরোনাম" },
                { key: "icon", label: "আইকন", icon: true, placeholder: "আইকনের নাম, যেমন videocam", showIf: (it) => it.variant === "large" },
                { key: "text", label: "ছোট লেখা", multiline: true },
                { key: "points", label: "টিক চিহ্নের তালিকা (প্রতি লাইনে একটা)", multiline: true, showIf: (it) => it.variant === "large" || it.variant === "plain" },
                { key: "image_url", label: "পেছনের ছবি", image: { folder: "features" }, showIf: (it) => it.variant === "image" },
              ]}
              emptyText="কিছু না থাকলে অংশটা হোমপেজে দেখায় না।" />
            <p className="text-xs muted">
              ডেমোর সাজ: প্রথমটা &quot;বড়&quot; (বাঁয়ে দুই সারি জুড়ে), তারপর চারটা ছোট, মোট ৫টা। আইকনের নাম{" "}
              <a href="https://fonts.google.com/icons" target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline dark:text-primary-fixed">Google Material Symbols</a> থেকে।
            </p>
          </>
        )}
      </Section>

      {/* হোমপেজে অংশটা বন্ধ, তাই এখানেও (ফেরাতে comment তুলে দিন)
      <Section k="platform" title="প্ল্যাটফর্ম অংশ" icon="devices" initial={content.platform}>
        {(v, set) => (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Text label="শিরোনামের প্রথম লাইন" value={v.title} onChange={(x) => set({ title: x })} />
              <Text label="শিরোনামের সবুজ লাইনগুলো" value={v.highlight} onChange={(x) => set({ highlight: x })} multiline rows={2} hint="প্রতি লাইন আলাদা করে নিচ থেকে উঠে আসে" />
            </div>
            <Text label="লেখা" value={v.text} onChange={(x) => set({ text: x })} multiline rows={3} hint="প্রতি লাইন একটু পরপর উঠে আসে" />
            <MediaInput label="ডানের ছবি" value={v.image_url} onChange={(x) => set({ image_url: x })} folder="platform" aspect="aspect-[4/5]" />
            <Text label="ছবির উপরের লেখা" value={v.chip} onChange={(x) => set({ chip: x })} />
            <div className="grid gap-4 md:grid-cols-2">
              <Text label="প্রথম বোতাম (অ্যাপ)" value={v.app_label} onChange={(x) => set({ app_label: x })} />
              <Text label="প্রথম বোতামের লিংক" value={v.app_href} onChange={(x) => set({ app_href: x })} hint="যেমন Play Store এর লিংক; ফাঁকা থাকলে চাপলে কিছু হয় না" />
              <Text label="দ্বিতীয় বোতাম" value={v.web_label} onChange={(x) => set({ web_label: x })} />
              <Text label="দ্বিতীয় বোতামের লিংক" value={v.web_href} onChange={(x) => set({ web_href: x })} />
            </div>
          </>
        )}
      </Section>
      */}

      {/* হোমপেজে অংশটা বন্ধ, তাই এখানেও (ফেরাতে comment তুলে দিন)
      <Section k="branches" title="ব্রাঞ্চ" icon="location_on" initial={content.branches}>
        {(v, set) => (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Text label="শিরোনাম" value={v.title} onChange={(x) => set({ title: x })} />
              <Text label="শিরোনামের সবুজ অংশ" value={v.highlight} onChange={(x) => set({ highlight: x })} />
            </div>
            <ListEditor items={v.items} onChange={(items) => set({ items })} blank={{ name: "", address: "", phone: "", map_url: "" }} addLabel="ব্রাঞ্চ যোগ করুন" max={24}
              fields={[{ key: "name", label: "নাম" }, { key: "phone", label: "ফোন" }, { key: "address", label: "ঠিকানা", multiline: true }, { key: "map_url", label: "Google Maps লিংক (https://…)", wide: true }]}
              emptyText="কিছু না থাকলে অংশটা হোমপেজে দেখায় না।" />
          </>
        )}
      </Section>
      */}

      <Section k="cta" title="শেষের আহ্বান (আমাদের সম্পর্কে পাতায়; হোমে বন্ধ)" icon="campaign" initial={content.cta}>
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
              {/* Instagram আপাতত footer এ নেই: <Text label="Instagram" value={v.instagram} onChange={(x) => set({ instagram: x })} placeholder="https://instagram.com/…" /> */}
              <Text label="Telegram" value={v.telegram} onChange={(x) => set({ telegram: x })} placeholder="https://t.me/…" />
            </div>
            <Text label="ঠিকানা" value={v.address} onChange={(x) => set({ address: x })} multiline rows={2} />
            <Text label="ফুটারের লেখা" value={v.footer_text} onChange={(x) => set({ footer_text: x })} multiline rows={2} />
          </>
        )}
      </Section>

      <Section k="about" title="আমাদের সম্পর্কে (পাতা)" icon="info" initial={content.about}>
        {(v, set) => (
          <>
            <Text label="উপরের ছোট লেখা (badge)" value={v.badge} onChange={(x) => set({ badge: x })} />
            <div className="grid gap-4 md:grid-cols-2">
              <Text label="শিরোনামের প্রথম অংশ" value={v.title} onChange={(x) => set({ title: x })} />
              <Text label="শিরোনামের সবুজ অংশ" value={v.highlight} onChange={(x) => set({ highlight: x })} />
            </div>
            <Text label="নিচের লেখা" value={v.subtitle} onChange={(x) => set({ subtitle: x })} multiline rows={4} />

            {(["mission", "vision"] as const).map((k) => (
              <div key={k} className="space-y-3 rounded-2xl border border-outline-variant/40 p-4 dark:border-outline-variant/20">
                <p className="font-bold">{k === "mission" ? "বাঁয়ের কার্ড (লক্ষ্য)" : "ডানের কার্ড (রূপকল্প)"}</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <Text label="ছোট চিহ্ন" value={v[k].label} onChange={(x) => set({ [k]: { ...v[k], label: x } })} />
                  <Text label="শিরোনাম" value={v[k].title} onChange={(x) => set({ [k]: { ...v[k], title: x } })} />
                </div>
                <Text label="লেখা" value={v[k].text} onChange={(x) => set({ [k]: { ...v[k], text: x } })} multiline rows={4} />
                <Text label="নিচের ট্যাগগুলো (প্রতি লাইনে একটা)" value={v[k].tags} onChange={(x) => set({ [k]: { ...v[k], tags: x } })} multiline rows={3} />
              </div>
            ))}

            <div>
              <p className="label">পরিসংখ্যান (সংখ্যা দৃশ্যে এলে ০ থেকে গুনে ওঠে)</p>
              <ListEditor<AboutStat> items={v.stats} onChange={(stats) => set({ stats })} addLabel="আরেকটা যোগ করুন" max={6}
                blank={{ icon: "group", tone: "green", value: "", suffix: "+", label: "" }}
                fields={[
                  { key: "icon", label: "আইকন", icon: true, placeholder: "আইকনের নাম, যেমন group" },
                  { key: "tone", label: "রং", options: TONE_LABELS },
                  { key: "value", label: "সংখ্যা", placeholder: "যেমন 3043" },
                  { key: "suffix", label: "পাশের চিহ্ন", placeholder: "+ বা %" },
                  { key: "label", label: "লেখা", placeholder: "শিক্ষার্থী", wide: true },
                ]}
                emptyText="কিছু না থাকলে অংশটা দেখায় না।" />
            </div>

            <div className="space-y-3 rounded-2xl border border-outline-variant/40 p-4 dark:border-outline-variant/20">
              <p className="font-bold">&quot;আমরা কেন আলাদা?&quot; অংশ</p>
              <div className="grid gap-4 md:grid-cols-3">
                <Text label="ছোট চিহ্ন" value={v.why.chip} onChange={(x) => set({ why: { ...v.why, chip: x } })} />
                <Text label="শিরোনাম" value={v.why.title} onChange={(x) => set({ why: { ...v.why, title: x } })} />
                <Text label="শিরোনামের সবুজ অংশ" value={v.why.highlight} onChange={(x) => set({ why: { ...v.why, highlight: x } })} />
              </div>
              <ListEditor<AboutWhy> items={v.why.items} onChange={(items) => set({ why: { ...v.why, items } })} addLabel="কার্ড যোগ করুন" max={12}
                blank={{ icon: "check_circle", tone: "green", title: "", text: "" }}
                fields={[
                  { key: "icon", label: "আইকন", icon: true, placeholder: "আইকনের নাম, যেমন lightbulb" },
                  { key: "tone", label: "রং", options: TONE_LABELS },
                  { key: "title", label: "শিরোনাম", wide: true },
                  { key: "text", label: "লেখা", multiline: true },
                ]}
                emptyText="কিছু না থাকলে অংশটা দেখায় না।" />
            </div>
            <p className="text-xs muted">নিচের সবুজ আহ্বান &quot;শেষের আহ্বান&quot; অংশ থেকে আসে। আইকনের নাম <a href="https://fonts.google.com/icons" target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline dark:text-primary-fixed">Google Material Symbols</a> থেকে।</p>
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
