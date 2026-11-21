// শিক্ষকের ড্যাশবোর্ডের ছোট হিসাব: সংখ্যা আর সময় খাতা মূল্যায়নের পাতার মতোই (বাংলাদেশ সময়)
import { bn } from "../evaluator/lib";
export { ago, bn, fmtDate, num } from "../evaluator/lib";
const BD = 6 * 3600e3;
// "১০:৩০ এএম"
export const clockBd = (ts: number) => { const d = new Date(ts + BD), h = d.getUTCHours(); return bn(String(h % 12 || 12).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0")) + (h < 12 ? " এএম" : " পিএম"); };
// "১২ অক্টো, ২০২৪"
const SHORT = ["জানু", "ফেব্রু", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টে", "অক্টো", "নভে", "ডিসে"];
export const dateBd = (ts: number) => { const d = new Date(ts + BD); return bn(d.getUTCDate()) + " " + SHORT[d.getUTCMonth()] + ", " + bn(d.getUTCFullYear()); };
