import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { SessionGuard } from "@/components/session-guard";
import { CourseEditor } from "../../_components/course-editor";

export const metadata: Metadata = { title: "নতুন কোর্স" };

export default function NewCourse() {
  return (
    <div className="space-y-6">
      <nav className="text-sm muted"><Link href="/admin/courses" className="hover:text-primary">কোর্স</Link> / নতুন</nav>
      <h1 className="text-3xl font-bold">নতুন কোর্স</h1>
      <Suspense fallback={<div className="card h-96 animate-pulse" />}>
        <Editor />
      </Suspense>
    </div>
  );
}

async function Editor() {
  await requireAdmin("/admin/courses/new");
  return (
    <>
      <SessionGuard />
      <CourseEditor course={null} />
    </>
  );
}
