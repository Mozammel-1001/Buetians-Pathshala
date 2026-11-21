import type { Metadata } from "next";
import { InquiriesView } from "./view";

export const metadata: Metadata = { title: "ভর্তির প্রশ্ন" };

export default function Page() {
  return <InquiriesView />;
}
