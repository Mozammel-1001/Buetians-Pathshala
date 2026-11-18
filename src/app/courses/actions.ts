"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSessionReplaced } from "@/lib/auth";
import { str, toAsciiDigits } from "@/lib/validation";

// ভর্তির আবেদন: যাচাই সব database এর submit_payment এ (TrxID এর duplicate, আগেই ভর্তি, আগের আবেদন বাকি ইত্যাদি),
// এখানে শুধু ডেকে ফল ফেরত দেওয়া, যাতে modal সাথে সাথে বলতে পারে
export type PayResult = {
  status: "pending" | "duplicate" | "enrolled" | "pending_exists" | "invalid" | "too_many" | "error";
  reason?: string;
  field?: "sender" | "trx";
  trx_id?: string;
  amount?: number;
  at?: number;   // প্রতিবার আলাদা (একই ফল দুবার এলেও modal নতুন করে দেখায়)
  values?: { sender: string; trx: string };
} | undefined;

export async function submitPayment(_prev: PayResult, formData: FormData): Promise<PayResult> {
  const courseId = Number(formData.get("course_id"));
  const values = { sender: str(formData, "sender"), trx: str(formData, "trx") };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect(`/sign-in`);

  const { data, error } = await supabase.rpc("submit_payment", {
    p_course_id: courseId,
    p_sender: toAsciiDigits(values.sender),
    p_trx_id: values.trx,
  });
  if (isSessionReplaced(error)) redirect("/auth/replaced");
  if (error) return { status: "error", reason: "আবেদন জমা হয়নি, আবার চেষ্টা করুন। (" + error.message + ")", values, at: Date.now() };
  // সফল হলেও এখানে পাতা নতুন করে আঁকা হয় না: modal এর "জমা হয়েছে" বার্তা দেখানোর পর বন্ধ করলে browser নিজে নতুন করে
  return { ...(data as NonNullable<PayResult>), values, at: Date.now() };
}

export async function enrollFree(formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("enroll_free", { p_course_id: Number(formData.get("course_id")) });
  if (isSessionReplaced(error)) redirect("/auth/replaced");
  if (error || (data as { status: string }).status !== "enrolled") redirect(`/dashboard?enroll_error=1`);
  redirect("/dashboard?enrolled=1");
}
