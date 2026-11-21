"use server";

import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { displayPhone, normalizeBdPhone, normalizeUserCode } from "@/lib/validation";

// উপরের খোঁজার ড্রপডাউন: শিক্ষার্থী/ইউজার (নাম, আইডি, ফোন), পেমেন্ট (TrxID), কোর্স (নাম); প্রতিটায় ৫টা পর্যন্ত।
// অনুমতি database এর RLS দেখে; staff না হলে কিছুই ফেরত দেয় না
export type Hit = { kind: "user" | "payment" | "course"; title: string; sub: string; href: string };

export async function adminSearch(raw: string): Promise<Hit[]> {
  const q = String(raw ?? "").trim().slice(0, 60);
  if (q.length < 2) return [];
  const me = await getProfile();
  if (!me || (me.role !== "admin" && me.role !== "manager")) return [];
  const supabase = await createClient();
  const safe = q.replace(/[%,()]/g, " ");
  const code = normalizeUserCode(q), phone = normalizeBdPhone(q);
  const userQ = supabase.from("profiles").select("full_name, user_code, phone, role").limit(5);
  const [users, pays, courses] = await Promise.all([
    code ? userQ.eq("user_code", code) : phone ? userQ.eq("phone", phone) : userQ.or(`full_name.ilike.%${safe}%,user_code.ilike.%${safe}%`),
    supabase.from("payments").select("trx_id, status, student:profiles!payments_user_id_fkey(full_name)").ilike("trx_id", `%${q.toUpperCase().replace(/[^A-Z0-9]/g, "")}%`).limit(5),
    me.role === "admin" ? supabase.from("courses").select("id, title, is_published").ilike("title", `%${safe}%`).limit(5) : Promise.resolve({ data: [] }),
  ]);
  const hits: Hit[] = [];
  for (const u of (users.data ?? []) as { full_name: string; user_code: string; phone: string }[])
    hits.push({ kind: "user", title: u.full_name, sub: `${u.user_code} · ${displayPhone(u.phone)}`, href: `/admin/users?q=${encodeURIComponent(u.user_code)}` });
  if (/[A-Za-z0-9]{3,}/.test(q))
    for (const p of (pays.data ?? []) as unknown as { trx_id: string; status: string; student: { full_name: string } | null }[])
      hits.push({ kind: "payment", title: p.trx_id, sub: `${p.student?.full_name ?? ""} · ${p.status === "pending" ? "অপেক্ষমাণ" : p.status === "approved" ? "অনুমোদিত" : "বাতিল"}`, href: `/admin/payments?status=all&q=${encodeURIComponent(p.trx_id)}` });
  for (const c of (courses.data ?? []) as { id: number; title: string; is_published: boolean }[])
    hits.push({ kind: "course", title: c.title, sub: c.is_published ? "প্রকাশিত" : "ড্রাফট", href: `/admin/courses/${c.id}` });
  return hits;
}
