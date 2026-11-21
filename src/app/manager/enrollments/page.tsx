import type { Metadata } from "next";
import { EnrollmentsScreen } from "../../admin/enrollments/screen";

export const metadata: Metadata = { title: "এনরোলমেন্ট" };

export default function Page({ searchParams }: PageProps<"/manager/enrollments">) {
  return <EnrollmentsScreen searchParams={searchParams} root="/manager" />;
}
