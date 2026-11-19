// "আমাকে মনে রাখুন" বন্ধ থাকলে লগইনের cookie ব্রাউজার বন্ধ করলেই মুছে যায় (session cookie: max-age ছাড়া)।
// এই cookie (bp_so=1) মনে রাখে যে কোন ব্রাউজারে সেটা বন্ধ, যাতে পরের প্রতিটি নবায়নেও (proxy, ব্রাউজারের client)
// মেয়াদ জুড়ে না দেয়। সার্ভারে বা ব্রাউজারে, দুই জায়গা থেকেই পড়া যায় (httpOnly নয়, গোপন কিছু নেই)
export const SESSION_ONLY_COOKIE = "bp_so";

type CookieOptions = { maxAge?: number; expires?: Date | number; [k: string]: unknown };

// cookie এর option থেকে মেয়াদ বাদ: ফল session cookie
export function withoutExpiry<T extends CookieOptions | undefined>(options: T): T {
  if (!options) return options;
  const { maxAge: _m, expires: _e, ...rest } = options;
  void _m; void _e;
  return rest as T;
}
