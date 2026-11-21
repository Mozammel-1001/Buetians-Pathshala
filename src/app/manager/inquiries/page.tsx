import type { Metadata } from "next";
import { QaBoard } from "../../admin/qa/view";

export const metadata: Metadata = { title: "ভর্তির প্রশ্ন" };

// ম্যানেজার উত্তর দেন; কাউকে জানানো বা মোছা নেই, অ্যাডমিনের রিমাইন্ডার উপরে দেখায়
export default function Page() {
  return <QaBoard kind="enrollment" panel="manager" />;
}
