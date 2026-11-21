import type { Metadata } from "next";
import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { displayPhone } from "@/lib/validation";
import { SettingsView } from "../../admin/settings/view";

export const metadata: Metadata = { title: "সেটিংস" };

// ম্যানেজারের সেটিংস: শুধু নিজের প্রোফাইল আর পাসওয়ার্ড (manager_dashboard.html এর মতো)
export default function Page() {
  return <Suspense fallback={<div className="card h-64 animate-pulse" />}><Settings /></Suspense>;
}

async function Settings() {
  const me = await requireStaff("/manager/settings");
  return <SettingsView panel="manager" name={me.full_name} phone={displayPhone(me.phone)} />;
}
