// পাতা বদলালে ভেতরের অংশ নিচ থেকে উঠে আসে (template প্রতিবার নতুন করে বসে, layout বসে না)
export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return <div className="view-in">{children}</div>;
}
