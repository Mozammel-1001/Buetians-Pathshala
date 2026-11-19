import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "অনুশীলন" };

export default function PracticePage() {
  return <ComingSoon icon="timer" title="অনুশীলন পরীক্ষা শীঘ্রই আসছে" text="অধ্যায়ভিত্তিক MCQ আর মডেল টেস্ট দিয়ে নিজেকে যাচাই করার ব্যবস্থা তৈরি হচ্ছে।" />;
}
