import { NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/webhook";
import { otpMessage, sendSms } from "@/lib/sms";
import { normalizeBdPhone } from "@/lib/validation";

// Supabase এর Send SMS hook: লগইনের OTP Supabase নিজে বানায়, পাঠানোর কাজ এখানে, বাংলাদেশের gateway দিয়ে।
// Supabase → Authentication → Hooks → Send SMS → HTTPS: <সাইট>/api/hooks/send-sms (README দেখুন)
//
// কোন নম্বরে: user.phone। Google এর অ্যাকাউন্টে নম্বর যোগ করার সময় (phone_change) user.phone ফাঁকা থাকে,
// নতুন নম্বর আসে user.new_phone এ। যার আগেই নম্বর আছে তাকে সবসময় সেই নম্বরে (নম্বর বদলের পথ সাইটে নেই;
// থাকলে অযাচাই করা new_phone এ লগইনের কোড চলে যেতে পারত)
type Payload = { user?: { id?: string; phone?: string; new_phone?: string }; sms?: { otp?: string } };

const fail = (status: number, message: string) => NextResponse.json({ error: { http_code: status, message } }, { status });

export async function POST(request: Request) {
  const body = await request.text();
  if (!verifyWebhook(process.env.SEND_SMS_HOOK_SECRET ?? "", request.headers, body)) return fail(401, "invalid signature");

  let payload: Payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return fail(400, "invalid json");
  }
  const otp = payload.sms?.otp ?? "";
  const to = normalizeBdPhone(payload.user?.phone || payload.user?.new_phone || "");
  if (!/^\d{4,10}$/.test(otp)) return fail(400, "missing otp");
  if (!to) return fail(400, "শুধু বাংলাদেশের মোবাইল নম্বরে SMS যায়");

  const result = await sendSms(to, otpMessage(otp));
  if (!result.ok) {
    console.error(`[send-sms] ${payload.user?.id ?? "?"}: ${result.error}`);
    return fail(502, "SMS পাঠানো যায়নি");
  }
  return NextResponse.json({});
}
