import type { Metadata } from "next";
import { EnrollmentsScreen } from "./screen";

export const metadata: Metadata = { title: "এনরোলমেন্ট" };

export default function EnrollmentsPage({ searchParams }: PageProps<"/admin/enrollments">) {
  return <EnrollmentsScreen searchParams={searchParams} root="/admin" />;
}
