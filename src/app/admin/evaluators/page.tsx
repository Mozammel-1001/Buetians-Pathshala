import type { Metadata } from "next";
import { EvaluatorsView } from "./view";

export const metadata: Metadata = { title: "খাতা মূল্যায়ন" };

export default function Page() {
  return <EvaluatorsView />;
}
