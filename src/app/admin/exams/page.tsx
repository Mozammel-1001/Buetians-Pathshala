import type { Metadata } from "next";
import { ExamsView } from "./view";

export const metadata: Metadata = { title: "পরীক্ষা" };

export default function Page() {
  return <ExamsView />;
}
