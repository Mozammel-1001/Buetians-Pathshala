import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "প্রাইভেসি পলিসি" };

export default function PrivacyPage() {
  return <ComingSoon icon="policy" title="প্রাইভেসি পলিসি শীঘ্রই আসছে" text="আপনার তথ্য আমরা কীভাবে সংগ্রহ, ব্যবহার আর সুরক্ষিত রাখি, তা এখানে বিস্তারিত থাকবে।" />;
}
