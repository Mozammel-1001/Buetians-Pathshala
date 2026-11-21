import type { Metadata } from "next";
import { PaymentsScreen } from "../../admin/payments/screen";

export const metadata: Metadata = { title: "পেমেন্ট অনুমোদন" };

export default function Page({ searchParams }: PageProps<"/manager/payments">) {
  return <PaymentsScreen searchParams={searchParams} root="/manager" />;
}
