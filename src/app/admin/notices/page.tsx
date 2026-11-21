import type { Metadata } from "next";
import { NoticesView } from "./view";

export const metadata: Metadata = { title: "নোটিশ ও SMS" };

export default function Page() {
  return <NoticesView />;
}
