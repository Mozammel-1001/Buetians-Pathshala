// Supabase এর ঠিকানা আর publishable key (Project Settings → API Keys)। দুটোই browser এ যায়, গোপন নয়;
// নিরাপত্তা আসে database এর RLS থেকে। secret key কখনো NEXT_PUBLIC_ এ নয়
export const supabaseUrl = () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const supabaseKey = () =>
  required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export const hasSupabase = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} সেট করা নেই। .env.example দেখে .env.local বানান`);
  return value;
}
