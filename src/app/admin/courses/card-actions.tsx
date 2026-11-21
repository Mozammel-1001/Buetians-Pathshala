"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { deleteCourse, setCoursePublished } from "../actions";
import { useConfirmSubmit, useToast } from "../_components/kit";

// কোর্সের কার্ডের নিচের চারটা বোতাম, ডেমোর মতো: সম্পাদনা, কন্টেন্ট, প্রকাশ/ড্রাফট, মোছা (নিশ্চিত করে)
export function CourseCardActions({ id, title, published }: { id: number; title: string; published: boolean }) {
  const [pub, pubAction, pubPending] = useActionState(setCoursePublished, undefined);
  const [del, delAction, delPending] = useActionState(deleteCourse, undefined);
  const [toast, toastNode] = useToast();
  const [onPub, pubNode] = useConfirmSubmit(() => published
    ? { title: "কোর্সটা ড্রাফট করবেন?", tone: "amber", icon: "visibility_off", ok: "হ্যাঁ, ড্রাফট করুন", body: `"${title}" ওয়েবসাইটে আর দেখা যাবে না। ভর্তি থাকা শিক্ষার্থীরা আগের মতোই পড়তে পারবে।` }
    : { title: "কোর্সটা প্রকাশ করবেন?", icon: "publish", ok: "হ্যাঁ, প্রকাশ করুন", body: `"${title}" ওয়েবসাইটের কোর্স তালিকায় সবাই দেখতে পাবে।` });
  const [onDel, delNode] = useConfirmSubmit(() => ({ title: "কোর্স মুছবেন?", tone: "danger", icon: "delete", ok: "হ্যাঁ, মুছুন", body: `"${title}" স্থায়ীভাবে মুছে যাবে। এই কোর্সে ভর্তি, পেমেন্ট বা পরীক্ষা থাকলে মোছা যাবে না, তখন ড্রাফট করে রাখুন।` }));

  useEffect(() => { if (pub?.ok) toast(published ? "কোর্স প্রকাশিত হয়েছে" : "কোর্স ড্রাফট করা হয়েছে"); }, [pub?.savedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const e = pub?.error ?? del?.error; if (e) toast(e, "info"); }, [pub?.error, del?.error]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mt-auto flex w-full gap-2">
      <Link href={`/admin/courses/${id}`} className="flex-1 rounded-xl bg-primary py-2.5 text-center text-xs font-bold text-on-primary transition-colors hover:bg-on-primary-fixed-variant sm:text-sm">সম্পাদনা</Link>
      <Link href={`/admin/content?course=${id}`} className="flex-1 rounded-xl border border-outline-variant/30 bg-surface-container-high py-2.5 text-center text-xs font-bold text-on-surface transition-colors hover:bg-surface-variant sm:text-sm dark:bg-white/10 dark:text-white dark:hover:bg-white/20">কন্টেন্ট</Link>
      <form action={pubAction} onSubmit={onPub}>
        <input type="hidden" name="id" value={id} /><input type="hidden" name="published" value={published ? "0" : "1"} />
        <button type="submit" disabled={pubPending} className="icon-btn h-10! w-10! border border-outline-variant/30" title={published ? "ড্রাফট করুন" : "প্রকাশ করুন"} aria-label={published ? "ড্রাফট করুন" : "প্রকাশ করুন"}>
          <span className="icon text-[20px]">{published ? "visibility_off" : "publish"}</span>
        </button>
      </form>
      <form action={delAction} onSubmit={onDel}>
        <input type="hidden" name="id" value={id} />
        <button type="submit" disabled={delPending} className="icon-btn h-10! w-10! border border-outline-variant/30 hover:text-error!" title="মুছুন" aria-label="মুছুন">
          <span className="icon text-[20px]">delete</span>
        </button>
      </form>
      {pubNode}{delNode}{toastNode}
    </div>
  );
}
