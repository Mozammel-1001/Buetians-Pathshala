import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Supabase এর auth hook (Standard Webhooks): সত্যিই Supabase পাঠিয়েছে কিনা যাচাই।
// সই = base64(HMAC-SHA256(secret, `${id}.${timestamp}.${body}`)), header এ "v1,<সই>" (একাধিক থাকতে পারে, ফাঁকা দিয়ে আলাদা)।
// secret Supabase দেয় "v1,whsec_<base64>" রূপে
const TOLERANCE_S = 5 * 60; // পুরনো request আবার পাঠিয়ে (replay) ঠকানো আটকাতে

export function verifyWebhook(secret: string, headers: Headers, body: string, nowMs = Date.now()): boolean {
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sigHeader = headers.get("webhook-signature");
  if (!id || !ts || !sigHeader || !secret) return false;

  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(nowMs / 1000 - t) > TOLERANCE_S) return false;

  const key = Buffer.from(secret.replace(/^v1,/, "").replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest();
  return sigHeader.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const got = Buffer.from(sig, "base64");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}
