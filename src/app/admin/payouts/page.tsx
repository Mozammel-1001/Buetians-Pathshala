import type { Metadata } from "next";
import { PayoutsView } from "./view";

export const metadata: Metadata = { title: "সম্মানী" };

export default function Page() {
  return <PayoutsView />;
}
