import type { Metadata } from "next";
import { SettingsView } from "./view";

export const metadata: Metadata = { title: "সেটিংস" };

export default function Page() {
  return <SettingsView />;
}
