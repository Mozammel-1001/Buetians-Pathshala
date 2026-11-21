import type { Metadata } from "next";
import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { ReportView } from "../report/view";

export const metadata: Metadata = { title: "লিডারবোর্ড" };

export default function LeaderboardPage() {
  return <Suspense fallback={<div className="card h-64 animate-pulse" />}><Guarded /></Suspense>;
}
async function Guarded() {
  await requireProfile("/dashboard/leaderboard");
  return <ReportView initialTab="board" />;
}
