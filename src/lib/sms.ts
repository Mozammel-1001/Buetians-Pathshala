import "server-only";

// SMS পাঠানো: বাংলাদেশের gateway। কোনটা চলবে তা SMS_PROVIDER বলে:
//   log       কিছু পাঠায় না, server log এ লেখে (development; Vercel এর Logs এ কোড দেখা যায়)
//   smsnetbd  sms.net.bd (Alpha SMS)   https://api.sms.net.bd/sendsms
//   bulksmsbd BulkSMSBD                https://bulksmsbd.net/api/smsapi
// নতুন gateway: নিচের PROVIDERS এ একটা function যোগ করলেই হয়।
// নম্বর 8801XXXXXXXXX ধাঁচে আসে (দুটো gateway ই এভাবে নেয়)

export type SmsResult = { ok: true; id?: string } | { ok: false; error: string };
type Provider = (to: string, text: string) => Promise<SmsResult>;

const TIMEOUT_MS = 4000; // Supabase এর auth hook ৫ সেকেন্ড অপেক্ষা করে

async function postForm(url: string, body: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const text = await res.text();
  try {
    return { status: res.status, json: JSON.parse(text) as Record<string, unknown> };
  } catch {
    return { status: res.status, json: { raw: text.slice(0, 200) } as Record<string, unknown> };
  }
}

const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} দেওয়া নেই`);
  return v;
};

const PROVIDERS: Record<string, Provider> = {
  async log(to, text) {
    console.info(`[sms:log] ${to}: ${text}`);
    return { ok: true };
  },

  // সফল হলে { error: 0, msg, data: { request_id } }; ভুল হলে error এ 4xx কোড (417 = ব্যালান্স নেই)
  async smsnetbd(to, text) {
    const body: Record<string, string> = { api_key: env("SMS_API_KEY"), msg: text, to };
    if (process.env.SMS_SENDER_ID) body.sender_id = process.env.SMS_SENDER_ID;
    const { json } = await postForm("https://api.sms.net.bd/sendsms", body);
    if (json.error === 0) return { ok: true, id: String((json.data as { request_id?: unknown })?.request_id ?? "") };
    return { ok: false, error: `sms.net.bd ${json.error}: ${json.msg ?? JSON.stringify(json)}` };
  },

  // সফল হলে response_code 202 (1007 = ব্যালান্স নেই, 1032 = IP whitelist এ নেই)
  async bulksmsbd(to, text) {
    const { json } = await postForm("https://bulksmsbd.net/api/smsapi", {
      api_key: env("SMS_API_KEY"),
      senderid: env("SMS_SENDER_ID"),
      type: "text",
      number: to,
      message: text,
    });
    if (Number(json.response_code) === 202) return { ok: true, id: json.message_id ? String(json.message_id) : undefined };
    return { ok: false, error: `bulksmsbd ${json.response_code}: ${json.error_message ?? json.success_message ?? JSON.stringify(json)}` };
  },
};

export async function sendSms(to: string, text: string): Promise<SmsResult> {
  const name = process.env.SMS_PROVIDER || "log";
  const provider = PROVIDERS[name];
  if (!provider) return { ok: false, error: `অজানা SMS_PROVIDER: ${name}` };
  try {
    return await provider(to, text);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// লগইনের কোডের SMS। ইংরেজিতে: বাংলা (Unicode) SMS এ এক ভাগে ৭০ অক্ষর, ইংরেজিতে ১৬০; খরচ কম থাকে।
// শেষ লাইনটা WebOTP এর জন্য (Android এর Chrome কোড নিজে বসিয়ে দেয়); ঠিকানা সাইটের সাথে না মিললে কাজ করে না,
// তাই localhost এ বাদ
export function otpMessage(otp: string) {
  const lines = [`Buetian's Pathshala code: ${otp}`, "Do not share it with anyone."];
  try {
    const host = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").hostname;
    if (host && host !== "localhost" && !/^\d+\.\d+\.\d+\.\d+$/.test(host)) lines.push("", `@${host} #${otp}`);
  } catch {
    // ঠিকানা না থাকলে WebOTP লাইন ছাড়া
  }
  return lines.join("\n");
}
