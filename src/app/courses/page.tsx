import type { Metadata } from "next";
import { getPublishedCourses, getSiteContent } from "@/lib/content";
import { CoursesBrowser } from "@/components/courses-browser";

export const metadata: Metadata = { title: "কোর্সসমূহ" };

// সব প্রকাশিত কোর্স, হুবহু ডেমোর (courses.html) মতো: শিরোনাম, বাঁয়ে খোঁজা ও ফিল্টার, ডানে কোর্সের কার্ড আর পাতা নম্বর।
// শিরোনাম আর বর্ণনা অ্যাডমিন প্যানেল → সাইটের লেখা → কোর্স অংশ থেকে, কার্ড আসে কোর্স থেকে
export default async function CoursesPage() {
  const [content, courses] = await Promise.all([getSiteContent(), getPublishedCourses()]);
  const cs = content.courses;
  return (
    <main className="mx-auto w-full max-w-[1440px] px-margin-mobile pt-2.5 pb-5 md:px-margin-desktop md:pt-5 md:pb-xl">
      <div className="reveal mt-10 mb-5 md:mt-20 md:mb-10">
        <h1 className="mb-2 text-3xl font-bold md:text-4xl">
          {cs.page_title} <span className="text-primary dark:text-primary-fixed">{cs.page_highlight}</span>
        </h1>
        {cs.page_subtitle && <p className="max-w-3xl text-sm text-on-surface-variant md:text-base dark:text-surface-variant">{cs.page_subtitle}</p>}
      </div>
      <CoursesBrowser courses={courses ?? []} failed={courses === null} />
    </main>
  );
}
