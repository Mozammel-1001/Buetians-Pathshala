import type { Metadata } from "next";
import { QaView } from "./view";

export const metadata: Metadata = { title: "পড়াশোনার প্রশ্ন" };

export default function Page() {
  return <QaView />;
}
