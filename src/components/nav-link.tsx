"use client";

import { Suspense, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  href: string;
  className: string;          // দুই অবস্থায় এক (মাপ, ফন্ট, transition)
  idleClassName: string;      // এই পাতায় না থাকলে লেখার রং (hover এর রংসহ)
  activeClassName: string;    // এই পাতায় থাকলে লেখার রং: hover এ যে রং আসে, সেটাই স্থায়ী
  style?: CSSProperties;
  onClick?: () => void;
  children: ReactNode;
};

function Active({ href, className, idleClassName, activeClassName, style, onClick, children }: Props) {
  const pathname = usePathname();
  // /courses এ থাকলে "কোর্সসমূহ", /courses/hsc-math এও তাই
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link href={href} onClick={onClick} style={style} aria-current={active ? "page" : undefined} className={`${className} ${active ? activeClassName : idleClassName}`}>
      {children}
    </Link>
  );
}

// মেনুর লিংক: যে পাতায় আছেন সেটার লেখা hover এর রঙে থাকে। pathname পড়ার অংশ <Suspense> এ (Cache Components এর নিয়ম);
// তৈরির সময় আর প্রথম আঁকায় সাধারণ রঙে, ব্রাউজারে পৌঁছেই রং বসে যায়
export function NavLink(props: Props) {
  const { href, className, idleClassName, style, onClick, children } = props;
  return (
    <Suspense fallback={<Link href={href} onClick={onClick} style={style} className={`${className} ${idleClassName}`}>{children}</Link>}>
      <Active {...props} />
    </Suspense>
  );
}
