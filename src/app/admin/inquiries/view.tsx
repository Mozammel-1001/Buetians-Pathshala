"use client";

import { QaBoard } from "../qa/view";

// ভর্তির প্রশ্ন: পড়াশোনার প্রশ্নের একই বোর্ড, উত্তর দেন ম্যানেজার
export function InquiriesView() {
  return <QaBoard kind="enrollment" />;
}
