import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "ভর্তি পরীক্ষার বিজ্ঞপ্তি" };

export default function AdmissionPage() {
  return <ComingSoon icon="campaign" title="ভর্তি পরীক্ষার বিজ্ঞপ্তি শীঘ্রই আসছে" text="বিশ্ববিদ্যালয় আর কলেজের ভর্তি পরীক্ষার বিজ্ঞপ্তি, আবেদনের শেষ তারিখসহ, এখানে এক জায়গায় পাবেন।" />;
}
