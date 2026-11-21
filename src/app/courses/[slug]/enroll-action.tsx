import Link from "next/link";
import { getAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSiteContent } from "@/lib/content";
import type { Course } from "@/lib/content-schema";
import { enrollFree } from "../actions";
import { EnrollButton } from "./enroll-modal";

// কোর্সের পাতায় ভর্তির জায়গা, প্রতিজনের আলাদা (তাই Suspense এর ভেতরে, cookie পড়ে):
//   লগইন নেই → লগইন/সাইন আপ, ফিরে এসে modal নিজে খোলে (?enroll=1)
//   ভর্তি আছেন → ড্যাশবোর্ডের লিংক; আবেদন যাচাই বাকি → সেই খবর; নইলে ভর্তির modal
export async function EnrollAction({ course }: { course: Course }) {
  const back = `/courses/${course.slug}?enroll=1`;
  const { uid, profile } = await getAuth();
  if (!uid || !profile) {
    return (
      <div className="mb-3 md:mb-6 space-y-2">
        <Link href={`/sign-in?next=${encodeURIComponent(back)}`} className="btn-primary enroll-cta w-full py-3!"><span className="icon text-[20px]">add</span>কোর্সে ভর্তি হোন</Link>
        <p className="text-center text-xs muted">
          ভর্তির আগে লগইন লাগবে। নতুন? <Link href={`/sign-up?next=${encodeURIComponent(back)}`} className="font-bold text-primary dark:text-primary-fixed">সাইন আপ করুন</Link>
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: enr }, { data: pays }, content] = await Promise.all([
    supabase.from("enrollments").select("status, expires_at").eq("user_id", profile.id).eq("course_id", course.id).maybeSingle(),
    supabase.from("payments").select("status, trx_id, reject_reason, created_at").eq("user_id", profile.id).eq("course_id", course.id).order("created_at", { ascending: false }).limit(1),
    getSiteContent(),
  ]);
  const active = enr?.status === "active" && (!enr.expires_at || new Date(enr.expires_at) > new Date());
  const last = pays?.[0];

  if (active) {
    return (
      <div className="mb-3 md:mb-6 rounded-2xl bg-primary/10 p-4 text-sm">
        <p className="flex items-center gap-2 font-bold text-primary dark:text-primary-fixed"><span className="icon">task_alt</span>আপনি এই কোর্সে ভর্তি আছেন</p>
        <Link href="/dashboard" className="btn-primary mt-3 w-full">ড্যাশবোর্ডে যান</Link>
      </div>
    );
  }
  if (enr?.status === "revoked") {
    return <p className="mb-3 md:mb-6 rounded-2xl bg-error/10 p-4 text-sm text-error dark:text-red-300">এই কোর্সে আপনার ভর্তি বাতিল করা আছে। বিস্তারিত জানতে আমাদের সাথে যোগাযোগ করুন।</p>;
  }
  if (last?.status === "pending") {
    return (
      <div className="mb-3 md:mb-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-100" data-testid="enroll-pending">
        <p className="flex items-center gap-2 font-bold"><span className="icon">hourglass_top</span>আবেদন যাচাইয়ের অপেক্ষায়</p>
        <p className="mt-1">TrxID <span className="font-mono font-bold">{last.trx_id}</span>। {content.payment.review_time || "শীঘ্রই যাচাই হবে।"}</p>
      </div>
    );
  }
  if (Number(course.price) === 0) {
    return (
      <form action={enrollFree}>
        <input type="hidden" name="course_id" value={course.id} />
        <button type="submit" className="btn-primary enroll-cta w-full py-3!"><span className="icon text-[20px]">school</span>ফ্রি ভর্তি হোন</button>
      </form>
    );
  }
  return (
    <EnrollButton
      course={{ id: course.id, title: course.title, price: Number(course.price) }}
      pay={content.payment}
      userCode={profile.user_code}
      phone={profile.phone}
      rejectedNote={last?.status === "rejected" ? last.reject_reason || "কারণ জানানো হয়নি" : null}
    />
  );
}
