import type { Metadata } from "next";
import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { QaStudentView } from "./view";

export const metadata: Metadata = { title: "প্রশ্নোত্তর" };

export default function QaPage() {
  return <Suspense fallback={<div className="card h-64 animate-pulse" />}><Guarded /></Suspense>;
}
async function Guarded() {
  await requireProfile("/dashboard/qa");
  return <QaStudentView />;
}
