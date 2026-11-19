import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "ক্যারিয়ার" };

export default function CareersPage() {
  return <ComingSoon icon="work" title="ক্যারিয়ার শীঘ্রই আসছে" text="আমাদের সাথে কাজ করার সুযোগ আর খোলা পদের তালিকা এখানে দেওয়া হবে।" />;
}
