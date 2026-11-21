import type { Metadata } from "next";
import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { ReportView } from "./view";

export const metadata: Metadata = { title: "পরীক্ষার রিপোর্ট" };

export default function ReportPage() {
  return <Suspense fallback={<div className="card h-64 animate-pulse" />}><Guarded /></Suspense>;
}
async function Guarded() {
  await requireProfile("/dashboard/report");
  return <ReportView initialTab="report" />;
}
