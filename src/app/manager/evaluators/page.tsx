import type { Metadata } from "next";
import { EvaluatorsView } from "../../admin/evaluators/view";

export const metadata: Metadata = { title: "খাতা মূল্যায়ন" };

export default function Page() {
  return <EvaluatorsView panel="manager" />;
}
