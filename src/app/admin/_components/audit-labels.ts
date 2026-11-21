import type { Tone } from "./ui";

// অডিট লগের কাজের নাম আর রঙ (admin_dashboard.html এর ACTIONS)
export const AUDIT: Record<string, { label: string; dot: string; tone: Tone }> = {
  "payment.approve": { label: "পেমেন্ট অনুমোদন", dot: "bg-emerald-500", tone: "green" },
  "payment.reject": { label: "পেমেন্ট বাতিল", dot: "bg-red-500", tone: "red" },
  "payment.duplicate_trx": { label: "আগের TrxID দিয়ে চেষ্টা", dot: "bg-red-500", tone: "red" },
  "role.change": { label: "রোল বদল", dot: "bg-purple-500", tone: "purple" },
  "enrollment.manual": { label: "ম্যানুয়াল এনরোল", dot: "bg-blue-500", tone: "blue" },
  "enrollment.extend": { label: "মেয়াদ বাড়ানো", dot: "bg-blue-500", tone: "blue" },
  "enrollment.revoke": { label: "এনরোল বাতিল", dot: "bg-red-500", tone: "red" },
  "courses.insert": { label: "কোর্স তৈরি", dot: "bg-emerald-500", tone: "green" },
  "courses.update": { label: "কোর্স বদল", dot: "bg-amber-500", tone: "amber" },
  "courses.delete": { label: "কোর্স মোছা", dot: "bg-red-500", tone: "red" },
  "admission_circulars.insert": { label: "বিজ্ঞপ্তি প্রকাশ", dot: "bg-emerald-500", tone: "green" },
  "admission_circulars.update": { label: "বিজ্ঞপ্তি আপডেট", dot: "bg-amber-500", tone: "amber" },
  "admission_circulars.delete": { label: "বিজ্ঞপ্তি মুছে ফেলা", dot: "bg-red-500", tone: "red" },
  "site_content.insert": { label: "সাইটের লেখা", dot: "bg-amber-500", tone: "amber" },
  "site_content.update": { label: "সাইটের লেখা বদল", dot: "bg-amber-500", tone: "amber" },
};
export const auditLabel = (a: string) => AUDIT[a] ?? { label: a, dot: "bg-outline", tone: "gray" as Tone };
