import type { Metadata } from "next";
import { PaymentsScreen } from "./screen";

export const metadata: Metadata = { title: "পেমেন্ট অনুমোদন" };

export default function PaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  return <PaymentsScreen searchParams={searchParams} root="/admin" />;
}
