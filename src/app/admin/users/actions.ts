"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSessionReplaced } from "@/lib/auth";

// রোল বদল (শুধু admin): database এর set_role নিজেই অনুমতি দেখে, admin রোল দেওয়া/নেওয়া আটকায়, audit_logs এ লেখে
export type RoleState = { ok?: boolean; error?: string; at?: number } | undefined;

export async function changeRole(_prev: RoleState, formData: FormData): Promise<RoleState> {
  const role = String(formData.get("role") ?? "");
  if (!["student", "teacher", "manager", "evaluator"].includes(role)) return { error: "রোল ঠিক নেই", at: Date.now() };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_role", { p_user_id: String(formData.get("id")), p_role: role });
  if (isSessionReplaced(error)) redirect("/auth/replaced");
  if (error) return { error: error.message, at: Date.now() };
  refresh();
  return { ok: true, at: Date.now() };
}
