"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Course } from "@/lib/content-schema";
import { deleteCourse, saveCourse } from "../actions";
import { Field, ListEditor, MediaInput, SaveBar, Text, useDirty, useUnsavedWarning } from "./fields";
import { useConfirmSubmit } from "./kit";

type Form = {
  slug: string; title: string; subtitle: string; description: string;
  key_points: { text: string }[]; highlights: { text: string }[]; prizes: { title: string; items: string }[]; price: string; price_before: string; thumbnail_url: string; category: string; badge: string;
  batch_name: string; starts_on: string; enroll_deadline: string; class_schedule: string; duration_label: string; medium: string; total_seats: string; promo_video_url: string;
  routine: { day: string; time: string; topic: string }[]; faqs: { q: string; a: string }[];
  routine_url: string; syllabus_url: string; is_published: boolean; position: string;
};

const toForm = (c: Course | null): Form => ({
  slug: c?.slug ?? "", title: c?.title ?? "", subtitle: c?.subtitle ?? "", description: c?.description ?? "",
  key_points: (c?.key_points ?? []).map((text) => ({ text })),
  highlights: (c?.highlights ?? []).map((text) => ({ text })),
  prizes: (c?.prizes ?? []).map((p) => ({ title: p.title ?? "", items: (p.items ?? []).join("\n") })),
  price: c ? String(Number(c.price)) : "", price_before: c?.price_before != null ? String(Number(c.price_before)) : "",
  thumbnail_url: c?.thumbnail_url ?? "", category: c?.category ?? "", badge: c?.badge ?? "", batch_name: c?.batch_name ?? "", starts_on: c?.starts_on ?? "",
  enroll_deadline: c?.enroll_deadline ?? "", class_schedule: c?.class_schedule ?? "", duration_label: c?.duration_label ?? "", medium: c?.medium ?? "", total_seats: c?.total_seats ? String(c.total_seats) : "", promo_video_url: c?.promo_video_url ?? "",
  routine: (c?.routine ?? []).map((r) => ({ day: r.day ?? "", time: r.time ?? "", topic: r.topic ?? "" })),
  faqs: (c?.faqs ?? []).map((f) => ({ q: f.q ?? "", a: f.a ?? "" })),
  routine_url: c?.routine_url ?? "", syllabus_url: c?.syllabus_url ?? "", is_published: c?.is_published ?? false,
  position: String(c?.position ?? 0),
});

// কোর্স বানানো/সম্পাদনা: ছবি, নাম, বিবরণ, মূল বিষয়, দাম, ব্যাচ, রুটিন, প্রশ্নোত্তর, প্রকাশ
export function CourseEditor({ course }: { course: Course | null }) {
  const [form, setForm] = useState<Form>(() => toForm(course));
  const [state, action, pending] = useActionState(saveCourse, undefined);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const fe = state?.fieldErrors ?? {};
  const { dirty, markSubmitted } = useDirty(JSON.stringify(form), state?.savedAt);
  useUnsavedWarning(dirty && !pending);

  const payload = { ...form, key_points: form.key_points.map((k) => k.text), highlights: form.highlights.map((k) => k.text), prizes: form.prizes.map((p) => ({ title: p.title, items: p.items.split("\n") })) };
  const folder = `courses/${form.slug || "new"}`;

  return (
    <div className="space-y-6">
      <form action={action} onSubmit={markSubmitted} className="space-y-6" noValidate>
        <input type="hidden" name="id" value={course?.id ?? ""} />
        <input type="hidden" name="payload" value={JSON.stringify(payload)} />

        <Card title="পরিচয়" icon="badge">
          <div className="grid gap-4 md:grid-cols-2">
            <Text label="কোর্সের নাম" value={form.title} onChange={(v) => set("title", v)} error={fe.title} placeholder="উচ্চতর গণিত ১ম পত্র" />
            <Text label="ঠিকানা (URL)" value={form.slug} onChange={(v) => set("slug", v.toLowerCase().replace(/\s+/g, "-"))} error={fe.slug}
              placeholder="hsc-27-math" hint={`সাইটে: /courses/${form.slug || "…"} (ছোট হাতের ইংরেজি, সংখ্যা, -)`} />
          </div>
          <Text label="এক লাইনের পরিচয়" value={form.subtitle} onChange={(v) => set("subtitle", v)} placeholder="HSC উচ্চতর গণিতের পুরো সিলেবাস" hint="কার্ডে ছবির নিচে দেখায়" />
          <div className="grid gap-4 md:grid-cols-2">
            <Text label="ক্যাটাগরি" value={form.category} onChange={(v) => set("category", v)} placeholder="যেমন একাডেমিক, ভর্তি প্রস্তুতি"
              hint="হোমপেজে আর সব কোর্সের পাতায় এই নামে ফিল্টার হয়; একই ক্যাটাগরির কোর্সে হুবহু একই বানান দিন" />
            <Text label="কার্ডের কোণের ব্যাজ (ঐচ্ছিক)" value={form.badge} onChange={(v) => set("badge", v)} placeholder="যেমন নতুন, জনপ্রিয়" />
          </div>
          <MediaInput label="কোর্সের ছবি" value={form.thumbnail_url} onChange={(v) => set("thumbnail_url", v)} folder={folder}
            error={fe.thumbnail_url} hint="১৬:৯ মাপের ছবি ভালো দেখায় (যেমন ১৬০০×৯০০)। আপলোডের সময় নিজে ছোট হয়ে যায়।" />
          <Text label="বিস্তারিত বিবরণ" value={form.description} onChange={(v) => set("description", v)} multiline rows={7} error={fe.description}
            hint="নতুন লাইন যেমন লিখবেন সাইটে তেমনই দেখাবে।" />
        </Card>

        <Card title="ওভারভিউর হাইলাইট" icon="play_arrow">
          <ListEditor items={form.highlights} onChange={(v) => set("highlights", v)} blank={{ text: "" }} addLabel="আরেকটা যোগ করুন" max={20}
            fields={[{ key: "text", label: "হাইলাইট", placeholder: "যেমন: ৫০+ লাইভ ইন্টারেক্টিভ ক্লাস", wide: true }]} emptyText="কোর্সের পাতায় বিবরণের নিচে ▶ চিহ্ন দিয়ে দেখায়। ফাঁকা থাকলে দেখায় না।" />
        </Card>

        <Card title="পুরস্কার" icon="emoji_events">
          <ListEditor items={form.prizes} onChange={(v) => set("prizes", v)} blank={{ title: "", items: "" }} addLabel="আরেকটা পুরস্কারের অংশ" max={6}
            fields={[{ key: "title", label: "শিরোনাম", placeholder: "যেমন: 🏆 মাসিক মেগা পুরষ্কার", wide: true }, { key: "items", label: "পুরস্কারগুলো (প্রতি লাইনে একটা)", placeholder: "১ম পুরষ্কার - স্মার্টওয়াচ", wide: true, multiline: true }]}
            emptyText="কোর্সের পাতায় হাইলাইটের নিচে আলাদা অংশে দেখায়। ফাঁকা থাকলে দেখায় না।" />
        </Card>

        <Card title="কোর্সে যা থাকছে" icon="checklist">
          <ListEditor items={form.key_points} onChange={(v) => set("key_points", v)} blank={{ text: "" }} addLabel="আরেকটা যোগ করুন" max={20}
            fields={[{ key: "text", label: "বিষয়", placeholder: "যেমন: সাপ্তাহিক MCQ ও লিখিত পরীক্ষা", wide: true }]} emptyText="হোমপেজের কার্ডে প্রথম ২টা দেখায়, কোর্সের পাতায় সবগুলো।" />
        </Card>

        <Card title="দাম" icon="payments">
          <div className="grid gap-4 md:grid-cols-2">
            <Text label="দাম (৳)" value={form.price} onChange={(v) => set("price", v)} inputMode="decimal" error={fe.price} placeholder="২৫০০" hint="০ দিলে ফ্রি" />
            <Text label="ছাড়ের আগের দাম (৳, ঐচ্ছিক)" value={form.price_before} onChange={(v) => set("price_before", v)} inputMode="decimal"
              error={fe.price_before} hint="দিলে সাইটে কেটে দেখায়" />
          </div>
        </Card>

        <Card title="ব্যাচ আর সময়" icon="event">
          <div className="grid gap-4 md:grid-cols-2">
            <Text label="ব্যাচের নাম" value={form.batch_name} onChange={(v) => set("batch_name", v)} placeholder="HSC ২৭ ব্যাচ" hint="কার্ডে নামের নিচে সবুজে" />
            <Text label="ক্লাসের সময়" value={form.class_schedule} onChange={(v) => set("class_schedule", v)} placeholder="সপ্তাহে ৩ দিন, রাত ৮টা" />
            <Text label="ক্লাস শুরু" type="date" value={form.starts_on} onChange={(v) => set("starts_on", v)} />
            <Text label="ভর্তির শেষ দিন" type="date" value={form.enroll_deadline} onChange={(v) => set("enroll_deadline", v)} />
            <Text label="মেয়াদ" value={form.duration_label} onChange={(v) => set("duration_label", v)} placeholder="৬ মাস" />
            <Text label="মাধ্যম" value={form.medium} onChange={(v) => set("medium", v)} placeholder="বাংলা" />
            <Text label="মোট আসন (ঐচ্ছিক)" value={form.total_seats} onChange={(v) => set("total_seats", v.replace(/[^\d০-৯]/g, ""))} placeholder="৫০" />
          </div>
          <Text label="প্রোমো ভিডিওর লিংক (ঐচ্ছিক)" value={form.promo_video_url} onChange={(v) => set("promo_video_url", v)} error={fe.promo_video_url}
            placeholder="https://www.youtube.com/watch?v=..." hint="কোর্সের পাতায় ছবির উপর প্লে বোতাম আসে; চাপলে ভিডিও খোলে" />
        </Card>

        <Card title="রুটিন" icon="calendar_month">
          <ListEditor items={form.routine} onChange={(v) => set("routine", v)} blank={{ day: "", time: "", topic: "" }} addLabel="সারি যোগ করুন" max={200}
            fields={[{ key: "day", label: "দিন / তারিখ", placeholder: "শনিবার বা ১২ জানুয়ারি" }, { key: "time", label: "সময়", placeholder: "রাত ৮টা" }, { key: "topic", label: "বিষয়", placeholder: "ভেক্টর: প্রথম ক্লাস", wide: true }]}
            emptyText="রুটিনের সারি দিন, নয়তো নিচে PDF/ছবি দিন, বা দুটোই।" />
          <div className="grid gap-4 md:grid-cols-2">
            <MediaInput label="রুটিনের PDF বা ছবি (ঐচ্ছিক)" kind="file" value={form.routine_url} onChange={(v) => set("routine_url", v)} folder={folder} error={fe.routine_url} />
            <MediaInput label="সিলেবাসের PDF (ঐচ্ছিক)" kind="pdf" value={form.syllabus_url} onChange={(v) => set("syllabus_url", v)} folder={folder} error={fe.syllabus_url} />
          </div>
        </Card>

        <Card title="সাধারণ প্রশ্ন" icon="help">
          <ListEditor items={form.faqs} onChange={(v) => set("faqs", v)} blank={{ q: "", a: "" }} addLabel="প্রশ্ন যোগ করুন" max={30}
            fields={[{ key: "q", label: "প্রশ্ন", wide: true }, { key: "a", label: "উত্তর", multiline: true }]} />
        </Card>

        <Card title="প্রকাশ" icon="public">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={form.is_published} onChange={(e) => set("is_published", e.target.checked)} className="mt-1 h-5 w-5 accent-primary" />
            <span><b>সাইটে প্রকাশিত</b><span className="block text-sm muted">বন্ধ থাকলে শুধু অ্যাডমিন দেখেন। নতুন কোর্স সব ঠিক করে তারপর চালু করুন।</span></span>
          </label>
          <div className="max-w-48">
            <Text label="ক্রম" value={form.position} onChange={(v) => set("position", v)} inputMode="numeric" hint="ছোট সংখ্যা আগে দেখায়" />
          </div>
        </Card>

        <div className="sticky bottom-0 z-10 -mx-4 border-t border-outline-variant/30 bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-2xl md:border dark:bg-on-background/95">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SaveBar pending={pending} dirty={dirty} savedAt={state?.savedAt} error={state?.error} label={course ? "সেভ করুন" : "কোর্স তৈরি করুন"} />
            {course?.is_published && !dirty && (
              <Link href={`/courses/${course.slug}`} target="_blank" className="btn-ghost py-2!"><span className="icon text-[18px]">open_in_new</span>সাইটে দেখুন</Link>
            )}
          </div>
        </div>
      </form>

      {course && <DeleteCourse id={course.id} title={course.title} />}
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4 p-5 md:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold"><span className="icon text-primary dark:text-primary-fixed">{icon}</span>{title}</h2>
      {children}
    </section>
  );
}

function DeleteCourse({ id, title }: { id: number; title: string }) {
  const [state, action, pending] = useActionState(deleteCourse, undefined);
  const [onSubmit, node] = useConfirmSubmit(() => ({ title: "কোর্স মুছে ফেলবেন?", sub: title, tone: "danger", icon: "delete", ok: "হ্যাঁ, মুছুন",
    body: "কোর্সের সব লেসন, ম্যাটেরিয়াল আর পরীক্ষাও মুছে যাবে। এটা ফেরানো যায় না। ভর্তি বা পেমেন্ট থাকলে মোছা যায় না।" }));
  return (
    <form action={action} onSubmit={onSubmit} className="card flex flex-wrap items-center justify-between gap-3 border-error/30! p-5">
      {node}
      <input type="hidden" name="id" value={id} />
      <Field label="কোর্স মোছা" hint="ভর্তি বা পেমেন্ট থাকলে মোছা যায় না; তখন প্রকাশ বন্ধ করে রাখুন।" error={state?.error}><span /></Field>
      <button type="submit" disabled={pending} className="btn border border-error/40 text-error hover:bg-error/10">
        <span className="icon text-[18px]">delete</span>{pending ? "মোছা হচ্ছে…" : "মুছে ফেলুন"}
      </button>
    </form>
  );
}
