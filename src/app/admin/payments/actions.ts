"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSessionReplaced } from "@/lib/auth";
import { str } from "@/lib/validation";

// পেমেন্ট যাচাই (admin বা manager): database এর approve_payment / reject_payment নিজেই অনুমতি দেখে,
// অনুমোদন হলে ভর্তি চালু করে আর audit_logs এ লেখে
export type ReviewState = { ok?: boolean; error?: string; at?: number } | undefined;

export async function approvePayment(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_payment", { p_payment_id: Number(formData.get("id")) });
  if (isSessionReplaced(error)) redirect("/auth/replaced");
  if (error) return { error: error.message, at: Date.now() };
  refresh();
  return { ok: true, at: Date.now() };
}

export async function rejectPayment(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const reason = str(formData, "reason").slice(0, 300);
  if (reason.length < 3) return { error: "বাতিলের কারণ লিখুন (শিক্ষার্থী এটা দেখবে)", at: Date.now() };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_payment", { p_payment_id: Number(formData.get("id")), p_reason: reason });
  if (isSessionReplaced(error)) redirect("/auth/replaced");
  if (error) return { error: error.message, at: Date.now() };
  refresh();
  return { ok: true, at: Date.now() };
}
