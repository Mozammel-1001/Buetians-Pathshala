// ধাপ ১ এর নমুনা তথ্য (শুধু ডিজাইন দেখার জন্য, database এর নয়)
export const COURSES = [
  { id: 1, title: "জুনিয়র স্কলারশিপ এক্সাম ব্যাচ" },
  { id: 2, title: "প্রগ্রেসিভ এইচএসসি ২৮ এক্সাম ব্যাচ" },
  { id: 3, title: "কলেজ অ্যাডমিশন প্রোগ্রাম ২০২৫" },
  { id: 4, title: "ইঞ্জিনিয়ারিং প্রস্তুতি" },
];
export const courseName = (id: number) => COURSES.find((c) => c.id === id)?.title ?? "—";
export const TEACHERS = [
  { id: 1, name: "রাফিউল ইসলাম", dept: "BUET CSE" },
  { id: 2, name: "তাসনিম আহমেদ", dept: "BUET EEE" },
  { id: 3, name: "ফারহানা ইয়াসমিন", dept: "ঢাকা বিশ্ববিদ্যালয়" },
  { id: 4, name: "মাহমুদুল হাসান", dept: "BUET ME" },
];
export const teacherName = (id: number) => TEACHERS.find((t) => t.id === id)?.name ?? "—";
