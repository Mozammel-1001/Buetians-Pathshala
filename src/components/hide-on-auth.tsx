"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";

// লগইন/সাইন আপ/রিসেট পাতায় header এ "Log In" বোতাম থাকে না (ডেমোর sign_in পাতায়ও নেই): পাতাতেই ফর্ম আছে
const AUTH_PATHS = ["/sign-in", "/sign-up", "/forgot-password"];

function Inner({ children }: { children: ReactNode }) {
  const path = usePathname();
  return AUTH_PATHS.includes(path) ? null : <>{children}</>;
}

export function HideOnAuth({ children }: { children: ReactNode }) {
  return <Suspense fallback={children}><Inner>{children}</Inner></Suspense>;
}
