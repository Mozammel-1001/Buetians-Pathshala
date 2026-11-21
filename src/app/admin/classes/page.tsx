import type { Metadata } from "next";
import { ClassesView } from "./view";

export const metadata: Metadata = { title: "ক্লাস অ্যাসাইন" };

export default function Page() {
  return <ClassesView />;
}
