import type { Metadata } from "next";
import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { MaterialsView } from "./view";

export const metadata: Metadata = { title: "স্টাডি ম্যাটেরিয়ালস" };

export default function Page() {
  return <Suspense fallback={<div className="card h-64 animate-pulse" />}><Guarded /></Suspense>;
}
async function Guarded() {
  await requireProfile("/dashboard/materials");
  return <MaterialsView />;
}
