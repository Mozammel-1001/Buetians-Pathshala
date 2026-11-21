import type { Metadata } from "next";
import { NoticesView } from "../../admin/notices/view";

export const metadata: Metadata = { title: "নোটিশ ও SMS" };

export default function Page() {
  return <NoticesView />;
}
