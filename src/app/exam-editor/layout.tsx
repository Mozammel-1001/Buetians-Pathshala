import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { EdChrome } from "./chrome";

// প্রশ্নপত্র সম্পাদক (exam_editor.html): শুধু অ্যাডমিন (সব কোর্সে) আর শিক্ষক (নিজের কোর্সে)।
// পাতার উপরের বার ডেমোর মতো আলাদা (সাইটের মেনু আর footer এখানে নেই)
export default function Layout({ children }: LayoutProps<"/exam-editor">) {
  return (
    <Suspense fallback={null}>
      <Guard>{children}</Guard>
    </Suspense>
  );
}

async function Guard({ children }: { children: ReactNode }) {
  const me = await requireProfile("/exam-editor");
  if (me.role !== "admin" && me.role !== "teacher") redirect("/dashboard");
  return (
    <>
      <EdChrome name={me.full_name} admin={me.role === "admin"} />
      {children}
    </>
  );
}
