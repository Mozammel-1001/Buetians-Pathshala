import type { Metadata } from "next";
import { PayoutsView } from "../../admin/payouts/view";

export const metadata: Metadata = { title: "সম্মানী" };

export default function Page() {
  return <PayoutsView />;
}
