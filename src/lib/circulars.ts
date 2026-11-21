// বিজ্ঞপ্তির শেষ তারিখ থেকে "আর কত দিন" (ঢাকার দিন ধরে); null মানে তারিখ নেই
export function daysLeft(deadline: string | null, nowMs: number): number | null {
  if (!deadline) return null;
  const end = Date.parse(`${deadline}T23:59:59+06:00`);
  return Math.floor((end - nowMs) / 86400000);
}
