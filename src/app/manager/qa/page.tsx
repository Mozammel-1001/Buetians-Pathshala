import type { Metadata } from "next";
import { QaBoard } from "../../admin/qa/view";

export const metadata: Metadata = { title: "পড়াশোনার প্রশ্ন" };

// ম্যানেজার উত্তর দেন না; দেরি হলে শিক্ষককে জানান
export default function Page() {
  return <QaBoard kind="study" panel="manager" />;
}
