import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "টার্মস অফ সার্ভিস" };

export default function TermsPage() {
  return <ComingSoon icon="gavel" title="টার্মস অফ সার্ভিস শীঘ্রই আসছে" text="প্ল্যাটফর্ম ব্যবহারের শর্ত, পেমেন্ট আর রিফান্ডের নিয়ম এখানে থাকবে।" />;
}
