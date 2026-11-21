import type { Metadata } from "next";
import { ContentView } from "./view";

export const metadata: Metadata = { title: "ভিডিও ও ম্যাটেরিয়াল" };

export default function Page() {
  return <ContentView />;
}
