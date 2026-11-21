// পাতা বদলালে ভেতরের অংশ নিচ থেকে উঠে আসে (অ্যাডমিন প্যানেলের মতো)
export default function ManagerTemplate({ children }: { children: React.ReactNode }) {
  return <div className="view-in">{children}</div>;
}
